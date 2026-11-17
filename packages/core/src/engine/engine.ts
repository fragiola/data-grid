import type { Axis } from "../axis/axis";
import type {
    DataGridFeatures,
    EngineKit,
    FeatureState,
    PinnedColumns,
} from "../feature/feature";
import { featureEngine, featuresOf } from "../feature/registry";
import {
    columnPart,
    headerRowCount,
    isHeaderRow,
    pinnedEndFrom,
} from "../header/header";
import { detailsChanged } from "../model/expansion";
import { cellKeyAt, shownColumnOf } from "../model/layout";
import type { DataGridModel } from "../model/model";
import {
    cellKeysAt,
    groupExpanded,
    groupKeyAt,
    loadedRowKey,
    rowAt,
    rowLoaded,
    rowMetaAt,
    sameKnownKeys,
} from "../model/source";
import { hasColumnSpans, spanAt } from "../model/spans";
import { summaryRowAt } from "../model/summary";
import type {
    CellKeys,
    CellPosition,
    Column,
    ColumnWidths,
    DataGridState,
    GridDirection,
    HeaderCellLayout,
    PinnedSide,
    RowKey,
} from "../model/types";
import {
    autoWidthsOf,
    columnTraits,
    hasEngineSized,
    NO_WIDTHS,
    sameWidths,
    withinLimits,
} from "../model/widths";
import { sameCell } from "../navigation/navigation";
import { clamp, indexAfterMove, isIndex } from "../utils/utils";
import {
    createScrollMapping,
    DEFAULT_MAX_SCROLL_SIZE,
    ScrollAxisState,
    type ScrollMapping,
    sameMapping,
} from "../viewport/scaling";
import { scrollTargetForSpan } from "../viewport/scroll-target";
import {
    type AxisWindow,
    EMPTY_WINDOW,
    overlaps,
    type Range,
    sameRange,
    sameWindow,
    windowFor,
} from "../viewport/window";
import {
    CELL_SELECTOR,
    CLICK_SLOP,
    cellSelector,
    FILL_HANDLE_ATTRIBUTE,
    GROUP_LABEL_ATTRIBUTE,
    GROUP_TOGGLE_ATTRIBUTE,
    HOSTS,
    inlineKey,
    isAltCharacter,
    isCellNode,
    isComposing,
    isControl,
    isEditable,
    isElement,
    isPagelessControl,
    isResizer,
    KEYS,
    LINE_HEIGHT,
    maxContentWidths,
    movesWithArrows,
    NESTINGS,
    type NestingHost,
    ownerViewport,
    PAGE_KEYS,
    ROW_DRAG_HANDLE_ATTRIBUTE,
    rehostWithin,
    scrollerBefore,
    TAB_STOP_ATTRIBUTE,
    VIEWPORTS,
    WHEEL_GESTURE,
    type WheelStyles,
} from "./dom";
import {
    type Drag,
    type DragEnd,
    dropTargetOf,
    edgeStep,
    type FeatureDrag,
    landingIndex,
    type RowDrag,
} from "./drag";
import {
    type AxisAnchor,
    anchoredOffset,
    anchorOf,
    cellSpan,
    cellsSizeOf,
    columnSide,
    endPartFrom,
    inlineSign,
    inlineStart,
    pinnedEndShift,
    pinnedInset,
    summaryHeight,
} from "./geometry";
import { createHeights, measuring } from "./heights";
import { createInteraction } from "./interaction";
import { rowsMove } from "./parts";
import type {
    DataGridEngine,
    DataGridEngineOptions,
    EngineActionKey,
    EngineActionMap,
    EngineAdapter,
    EngineEventKey,
    EngineEventMap,
    EngineLayer,
    EngineQueryKey,
    EngineQueryMap,
    FeatureActionKey,
    FeatureQueryKey,
    GridView,
    RowMove,
    RowReorder,
} from "./types";
import {
    buildView,
    columnAxisOf,
    columnToScrollTo,
    createHeaderRows,
    elementPosition,
    rowAxisOf,
    scrollingWindow,
    viewChanged,
    withDetails,
} from "./view";

// The engine (D3): one grid on screen. It owns the scroll element, the sizes, the windows, scroll
// scaling, keyboard handling and focus; the adapter (React) renders the view the engine reports
// and never reconciles what the engine writes (the layers' transforms, D9).
//
// The DOM it expects, whatever the elements (a `<table>` or `<div>`s):
//
//   viewport (the scroll container: overflow auto, sized by the app)
//     grid    (the sizer: header height + summary rows' + physical body height, physical width)
//       header layer   (sticky at the top; translated on x)
//       top summary rows (sticky under the header; translated on x, as the header's rows)
//       body layer     (below them; translated on x and y)
//       bottom summary rows (sticky at the view's bottom edge; translated on x)
//
// Every DOM access goes through the viewport's ownerDocument/defaultView, never the globals.
//
// Right to left (E1.1), the engine works in inline offsets from the view's start as it does left
// to right, and mirrors only where it meets the DOM: the scroll it reads and sets (negative
// `scrollLeft`, every current browser's), the pointer's x, the layers' transform and the side of
// the insets it writes (`inlineSign`, `inlineStart`), and the arrows (`inlineKey`). The direction
// is the model's, else the viewport's own as the page lays it out (a computed style read).

/** The layers whose elements get an inset of the engine's (`left`), not a transform. */
type InsetLayer = "pinned" | "detail" | "label";

const INSET_LAYERS: readonly InsetLayer[] = ["pinned", "detail", "label"];

function isInsetLayer(layer: EngineLayer): layer is InsetLayer {
    return INSET_LAYERS.some((inset) => inset === layer);
}

/** Physical scroll moves, on either axis or both. */
type ScrollMoves = { top?: number | undefined; left?: number | undefined };

/** No overscan option: the defaults (one object, not one per update). */
const NO_OVERSCAN: NonNullable<DataGridEngineOptions["overscan"]> = {};

/** No column pinned in effect: a grid without pinning (Epic #148), or none that fits. */
const NO_PINNED: PinnedColumns = Object.freeze({
    startCount: 0,
    startWidth: 0,
    endCount: 0,
    endWidth: 0,
});

/** Creates the engine of one grid on screen. */
export function createDataGridEngine<
    TRow,
    TNode = unknown,
    TFeatures extends DataGridFeatures = DataGridFeatures,
>(
    gridModel: DataGridModel<TRow, TNode, TFeatures>,
    initialOptions: DataGridEngineOptions = {},
): DataGridEngine<TRow, TNode> {
    // the engine runs the core's commands; the features' handlers run their own (Epic #141)
    const model = gridModel as unknown as DataGridModel<TRow, TNode, []>;
    /** the model's installed features, composed once */
    const features = featuresOf(model);
    let options = initialOptions;
    let viewport: HTMLElement | null = null;
    /** the layers' elements: the header layer has one per header row */
    const layers: Record<EngineLayer, Set<HTMLElement>> = {
        grid: new Set(),
        header: new Set(),
        body: new Set(),
        pinned: new Set(),
        detail: new Set(),
        label: new Set(),
        row: new Set(),
        empty: new Set(),
    };
    /**
     * Whether an element is the viewport or one of the layers that hold rows (the grid, the
     * header's, the body): a key on one is the grid's (a detail's are its content's). Set lookups:
     * nothing allocated, no DOM read (the wheel asks it of every event).
     */
    const isOwnLayer = (element: Element) =>
        element === viewport ||
        (layers.grid as ReadonlySet<Element>).has(element) ||
        (layers.header as ReadonlySet<Element>).has(element) ||
        (layers.body as ReadonlySet<Element>).has(element);
    let detachViewport: (() => void) | null = null;

    let state = model.state;
    /** the direction in effect: the model's, else the viewport's (`updateDirection`) */
    let direction: GridDirection = state.direction ?? "ltr";
    /** the rows and details measured (`"auto"`, Epic #86, E2.2) */
    const heights = createHeights<TRow, TNode>({
        getViewport: () => viewport,
        getState: () => state,
        rows: layers.row,
        details: layers.detail,
        remeasured,
    });
    /** the rows' own heights (measured ones at their estimate); `rowAxis` adds the details */
    let baseRowAxis = rowAxisOf(state);
    let rowAxis = rowAxisFor();
    let width = 0;
    /** the automatic widths measured for `autoSize` columns, by key (A5): kept across new columns */
    let automatic: ColumnWidths = NO_WIDTHS;
    /** the `autoSize` columns measured since the viewport attached: once each */
    const autoSized = new Set<string>();
    /** the columns whose `autoSize` ones are all measured: a commit has nothing to measure */
    let autoSizedFor: readonly Column<TRow, TNode>[] | null = null;
    /** the engine's widths in effect: automatic widths and flex shares (`column-auto-widths`) */
    let autoWidths: ColumnWidths = NO_WIDTHS;
    updateAutoWidths();
    let columnAxis = columnAxisOf(state, overridesOf(state), autoWidths);
    /** the columns pinned in effect (pinning's, Epic #148: none without it) */
    let pinning = NO_PINNED;
    /** the pinned columns in effect, at the start and at the end, and their widths */
    let pinnedCount = 0;
    let pinnedWidth = 0;
    let pinnedEndCount = 0;
    let pinnedEndWidth = 0;
    updatePinning();
    let height = 0;

    const maxScroll = () => options.maxScrollSize ?? DEFAULT_MAX_SCROLL_SIZE;
    const headerHeight = () => headerRowCount(state) * state.headerRowHeight;
    /** where the body starts in the view: under the header and the top summary rows (E2.1) */
    const bodyTop = () => headerHeight() + summaryHeight(state, "top");
    // the summary rows (E2.1) are always in view: the body is what they leave
    const bodyHeight = () =>
        Math.max(0, height - bodyTop() - summaryHeight(state, "bottom"));
    /** the width of the columns that scroll: the view's between the pinned ones */
    const scrollingWidth = () => width - pinnedWidth - pinnedEndWidth;
    /** the virtual row offset under a pointer at `y` in the view, kept over the body */
    const rowOffsetAt = (y: number) =>
        rowsY.virtual + clamp(y - bodyTop(), 0, bodyHeight());
    /** the edge scroll's step for a pointer at `y` over the body, `x` over the columns that scroll */
    const rowEdgeStepAt = (y: number) => edgeStep(y, bodyTop(), bodyHeight());
    const columnEdgeStepAt = (x: number) =>
        edgeStep(x, pinnedWidth, scrollingWidth());
    const rowMapping = () =>
        createScrollMapping(rowAxis.totalSize, bodyHeight(), maxScroll());
    const columnMapping = () =>
        createScrollMapping(columnAxis.totalSize, width, maxScroll());
    const rowsY = new ScrollAxisState(createScrollMapping(0, 0));
    const columnsX = new ScrollAxisState(createScrollMapping(0, 0));

    /** The header rows for the rendered columns: laid out again only when they change. */
    const headerRowsFor = createHeaderRows<TRow, TNode>();

    let rowWindow: AxisWindow = EMPTY_WINDOW;
    let columnWindow: AxisWindow = EMPTY_WINDOW;
    /** the view's `rowsRevision`: only a change to rows on screen moves it */
    let rowsRevision = 0;
    /**
     * something the view shows besides the rendered ranges changed (the model, the sizes, the
     * interaction): the next update builds a view, which it skips otherwise (D9)
     */
    let viewStale = false;
    /** the row a drag is moving (Epic #86, E2.3), the drag (a feature's: Epic #144) */
    let rowReorder: RowReorder | null = null;
    let drag: Drag | null = null;
    /**
     * whether the grid's tab stop is in the page's tab order (`view.tabbable`, Epic #89, E5.2):
     * nested in another grid, only while the outer grid's active cell holds it or focus is in it
     */
    let tabbable = true;
    /** the grid this one is nested in (its host, found once attached), and its unsubscribe */
    let host: NestingHost | null = null;
    let unlistenHost: (() => void) | null = null;
    /** the grids nested in this one, told when its active cell, or what is at it, changes */
    const nestedListeners = new Set<() => void>();
    /** they are to be told at the next commit (its cells' indexes rendered) */
    let nestedStale = false;
    const ownHost: NestingHost = {
        holds: holdsNested,
        listen(listener) {
            nestedListeners.add(listener);
            return () => {
                nestedListeners.delete(listener);
            };
        },
    };
    /** the last press the grid took (its drag, over or not): once it dragged, its click is its */
    let lastPress: Drag | null = null;
    /**
     * what the engine lends its features' handlers (Epic #144): each read when it is called, the
     * engine's state as it is then
     */
    const kit: EngineKit = {
        viewport: () => viewport,
        options: () => options,
        direction: () => direction,
        cellOf,
        isCellElement,
        bodyCellOf,
        pressedBodyCellOf,
        cellElement,
        inViewport,
        markedOf,
        same,
        keptAt,
        pageSize,
        visibleColumns: () => columnWindow.visible,
        focusFirstVisibleCell,
        scrollToCell: (position) => scrollToCell(scrollPayloadFor(position)),
        followFocus: (move) => {
            pendingFocus = true;
            move();
            flushFocus();
        },
        activate: (position) => activate(position),
        move: (direction) => featureHandlers.move?.(direction),
        leaveInteraction: () => {
            if (interaction.cell) interaction.leaveCell(false);
        },
        emit: (event, value) => emit(event as EngineEventKey, value as never),
        refresh: () => {
            viewStale = true;
            update();
        },
        press: (event, next) => press(event, next),
        capture: (next) => capture(next),
        askFrame: (next) => askFrame(next),
        drag: () => drag,
        endDrag: (how) => endDrag(how),
        stopDrag: () => {
            stopDrag();
        },
        cellDragStep,
        cellUnder: (current, known) =>
            cellAtView(viewXOf(current.x), viewYOf(current.y), known),
        columnAxis: () => columnAxis,
        viewportWidth: () => width,
        pinned: () => pinning,
        scrollLeft: () => columnsX.virtual,
        viewX: viewXOf,
        columnOffsetAt: partOffsetAt,
        columnEdgeStep: columnEdgeStepAt,
        edgeScroll: edgeScrollBy,
        committed: () => committed as GridView<unknown, unknown> | null,
        measureColumns: (shown, columnIndexes) =>
            measureColumns(shown as GridView<TRow, TNode>, columnIndexes),
        autoWidths: (overrides) =>
            overrides === undefined
                ? autoWidths
                : autoWidthsOf(state.columns, overrides, automatic, width),
    };
    /** the features' keys, presses and clicks, made once with what the engine hands them */
    const featureHandlers = featureEngine(
        features,
        model as unknown as DataGridModel<unknown, unknown>,
        {
            headerCellOf: (target) =>
                (headerCellOf(target)?.cell as
                    | HeaderCellLayout<unknown, unknown>
                    | undefined) ?? null,
            engine: kit,
        },
    );
    /** the cell whose controls have the keys, and an entry waiting for its cell (Epic #52) */
    const interaction = createInteraction({
        getViewport: () => viewport,
        cellElement,
        cellOf,
        isCellElement,
        same,
        isActive: (position) => same(state.activePosition, position),
        activate,
        changed: () => {
            viewStale = true;
            update();
            emit("interaction", interaction.cell);
        },
    });
    let view: GridView<TRow, TNode> = makeView();
    let committed: GridView<TRow, TNode> | null = null;
    let endReachedAt = -1;
    /** physical scroll positions waiting for the sizer to have its new size (applied on commit) */
    let pendingScroll: ScrollMoves = {};
    let pendingFocus = false;
    /** focus was in the grid when a new view went out to render */
    let focusBeforeRender = false;
    /** a pointer is down in the viewport: focus it causes is a click, not a Tab */
    let pointerDown = false;
    /** where the last press started, to tell a click from a drag */
    let pressedAt: { x: number; y: number } | null = null;
    /** whether the wheel listener is on: only while an axis is scaled */
    let wheelOn = false;
    const viewListeners = new Set<() => void>();
    /** each event's listeners, by its name (a feature's events too: `fill`, `range-paste`, …) */
    const eventListeners = new Map<string, Set<(value: unknown) => void>>();

    function emit<K extends EngineEventKey>(
        event: K,
        value: EngineEventMap[K],
    ) {
        const listeners = eventListeners.get(event);
        if (listeners) for (const listener of [...listeners]) listener(value);
    }

    /** Whether the keys taken at a body cell may still be there (`sameKnownKeys`). */
    function keptAt(position: CellPosition, keys: CellKeys | undefined) {
        return sameKnownKeys(keys, cellKeysAt(state, position));
    }

    /** Whether `a` is the cell `b` (a header cell spanning rows is the same on each of them). */
    function same(a: CellPosition | null, b: CellPosition): boolean {
        return a !== null && sameCell(a, b, state.header.cellAt);
    }

    /**
     * Makes a cell active, unless it is already: the navigation's (Epic #144); without it, no
     * cell is ever active. Returns whether it is.
     */
    function activate(position: CellPosition): boolean {
        if (same(state.activePosition, position)) return true;
        return featureHandlers.activate?.(position) === true;
    }

    /**
     * The widths a feature gives columns over their declared sizing (a resize's, Epic #148), none
     * without one.
     */
    function overridesOf(of: DataGridState<TRow, TNode>): ColumnWidths {
        return features.columnWidths?.(of as FeatureState) ?? NO_WIDTHS;
    }

    function makeView(): GridView<TRow, TNode> {
        return buildView({
            state,
            rowWindow,
            columnWindow,
            rowAxis,
            columnAxis,
            width: columnsX.mapping.physicalSize,
            height: rowsY.mapping.physicalSize,
            headerHeight: headerHeight(),
            viewportWidth: width,
            viewportBodyHeight: bodyHeight(),
            pinnedColumnCount: pinnedCount,
            pinnedWidth,
            pinnedEndColumnCount: pinnedEndCount,
            pinnedEndWidth,
            rowsRevision,
            interaction: interaction.cell,
            tabbable,
            emptyShown: layers.empty.size > 0,
            reorderableRows: options.reorderableRows === true,
            rowReorder,
            direction,
            headerRowsFor,
            features,
            featureFields: featureView(),
        });
    }

    /** The view's fields the features' engines hold (a fill's drag), or `null` without any. */
    function featureView(): Readonly<Record<string, unknown>> | null {
        const fields = featureHandlers.view;
        if (fields.length === 0) return null;
        let merged = {};
        for (const field of fields) merged = { ...merged, ...field() };
        return merged;
    }

    /**
     * The rows' axis for the state: their own heights, measured ones over the estimate (E2.2),
     * then the expanded rows' details (M2).
     */
    function rowAxisFor(): Axis {
        return withDetails(
            state.rowHeight === "auto"
                ? heights.rows.axis(state.rowCount, state.estimatedRowHeight)
                : baseRowAxis,
            state,
            heights.details,
        );
    }

    /** Takes a new mapping into an axis; returns the physical scroll it needs when that moves. */
    function remapAxis(
        axis: ScrollAxisState,
        mapping: ScrollMapping,
        physical: number,
    ): number | undefined {
        if (sameMapping(axis.mapping, mapping)) return undefined;
        const moved = axis.remap(mapping);
        return Math.abs(moved - physical) > 0.5 ? moved : undefined;
    }

    /** The viewport's scroll from its inline start: right to left, `scrollLeft` mirrored. */
    function scrollX(element: HTMLElement | null): number {
        return element ? inlineSign(direction) * element.scrollLeft : 0;
    }

    /** the viewport's own direction as the page lays it out, last read (`readPageDirection`) */
    let pageDirection: GridDirection = "ltr";
    /**
     * the model's direction changed: the adapter renders it as `dir` (`givenDirection`), and the
     * engine takes it at the commit of that render, the page's read then when it was taken back
     */
    let directionPending = false;

    /**
     * Reads the viewport's own direction as the page lays it out (a computed style, from its
     * window), while the model gives none: on attach, and at the commit after a given direction
     * is taken back (the adapter has removed the `dir` it rendered by then). Never per command,
     * frame or resize: a page direction changed later is the next attach's.
     */
    function readPageDirection() {
        if (!viewport || state.direction !== undefined) return;
        pageDirection =
            viewport.ownerDocument.defaultView?.getComputedStyle(viewport)
                .direction === "rtl"
                ? "rtl"
                : "ltr";
    }

    /**
     * Takes the direction in effect: the model's (which the adapter renders as the viewport's
     * `dir`, the engine writing none), else the page's as last read; a new one given or taken back
     * waits for the commit that renders it (`directionPending`). A change mirrors whatever the
     * engine writes from now on (the layers' transforms, the insets' side), before anything is
     * written for it, and, with `follow`, sets the scroll at the same distance from the start on
     * the new side. Returns whether it changed.
     */
    function updateDirection(follow: boolean): boolean {
        if (directionPending) return false;
        const next = state.direction ?? pageDirection;
        if (next === direction) return false;
        direction = next;
        layerX = Number.NaN;
        if (follow) {
            scrollWhenReady({ left: columnsX.scrollTo(columnsX.virtual) });
        }
        return true;
    }

    /** Takes the current sizes into the scroll mappings; returns the physical moves needed. */
    function remap(): ScrollMoves {
        const moves = {
            top: remapAxis(rowsY, rowMapping(), viewport?.scrollTop ?? 0),
            left: remapAxis(columnsX, columnMapping(), scrollX(viewport)),
        };
        listenToWheel();
        return moves;
    }

    /**
     * Recomputes the windows and the view from the scroll state; tells the window listeners and
     * the view listeners what changed; writes the layers' offsets. A relayout (`layout`: the
     * sizes or the content changed) works the rendered ranges out again, from scratch when
     * `fresh`; any other update (a scroll, a state of the engine's) changes no size, and keeps a
     * rendered range while it covers the view (`windowFor`'s `scrolled`).
     */
    function update(layout?: "fresh" | "trim") {
        const overscan = options.overscan ?? NO_OVERSCAN;
        const scrolled = layout === undefined;
        const nextRows = windowFor(
            rowAxis,
            rowsY.virtual,
            bodyHeight(),
            overscan.rows ?? 4,
            layout === "fresh" ? undefined : rowWindow,
            scrolled,
        );
        // the columns that scroll, in the view between the pinned ones
        const nextColumns = scrollingWindow(
            windowFor(
                columnAxis,
                columnsX.virtual + pinnedWidth,
                scrollingWidth(),
                overscan.columns ?? 2,
                layout === "fresh" ? undefined : columnWindow,
                scrolled,
            ),
            pinnedCount,
            endFrom(),
        );
        const rowsMoved = !sameWindow(rowWindow, nextRows);
        const columnsMoved = !sameWindow(columnWindow, nextColumns);
        // the visible ranges moving inside the rendered ones keep the same view: none is built
        const build =
            viewStale ||
            !sameRange(rowWindow.rendered, nextRows.rendered) ||
            !sameRange(columnWindow.rendered, nextColumns.rendered);
        rowWindow = nextRows;
        columnWindow = nextColumns;
        if (build) {
            viewStale = false;
            const next = makeView();
            if (viewChanged(view, next)) {
                view = next;
                // a render may remove the focused cell (a row remounting as it loads): commit restores it
                focusBeforeRender ||= focusInside();
                for (const listener of [...viewListeners]) listener();
            }
        }
        writeLayers();
        if (rowsMoved) emit("row-window", rowWindow);
        if (columnsMoved) emit("column-window", columnWindow);
        const threshold = options.endReachedThreshold ?? 10;
        if (
            state.rowCount > 0 &&
            rowWindow.visible.end > 0 &&
            rowWindow.visible.end >= state.rowCount - threshold &&
            endReachedAt !== state.rowCount
        ) {
            endReachedAt = state.rowCount;
            emit("rows-end-reached", { rowCount: state.rowCount });
        }
    }

    const written = new WeakMap<HTMLElement, string>();

    function setTransform(layer: EngineLayer, transform: string) {
        for (const element of layers[layer]) write(element, transform);
    }

    function write(element: HTMLElement, transform: string) {
        if (written.get(element) === transform) return;
        written.set(element, transform);
        element.style.transform = transform;
    }

    /**
     * The layers' offsets for a view on screen in `element` (the viewport): what is in view is the
     * virtual offset's content, wherever the physical scroll stands.
     */
    function offsetX(shown: GridView<TRow, TNode>, element: HTMLElement) {
        return columnsX.layerOffset(shown.columnBase, scrollX(element));
    }

    function offsetY(shown: GridView<TRow, TNode>, element: HTMLElement) {
        return rowsY.layerOffset(shown.rowBase, element.scrollTop);
    }

    /**
     * A layer's transform for offsets `x` (inline: mirrored right to left) and `y`: the header
     * moves with the columns only.
     */
    function layerTransform(
        layer: "body" | "header",
        x: number,
        y: number,
    ): string {
        return `translate3d(${inlineSign(direction) * x}px, ${layer === "body" ? y : 0}px, 0px)`;
    }

    /**
     * the layers' offsets last written (NaN: the next write goes to every layer, where `written`
     * skips the elements that hold it already)
     */
    let layerX = Number.NaN;
    let layerY = Number.NaN;
    /**
     * what the pinned cells' insets were last written for: the layers' `x`, the columns, the
     * view's width (where the ones pinned at the end show) and the side they are on
     */
    let insetsFor: {
        x: number;
        columnAxis: Axis;
        width: number;
        side: "left" | "right";
    } | null = null;

    /**
     * Writes a pinned cell's sticky inset on `side` for the layers' `x`: its column's offset less
     * `x`, and for a column pinned at the end (from `shownEndFrom`) `endShift` to the view's end.
     * Sticky is resolved in layout, before the layer's transform moves it by `x`, so it shows at
     * its offset from the view's start, on every frame the browser paints while it scrolls. An
     * element without its column (`data-column-index`) is left alone. A group's label (E1.3) is
     * held the same way at the start of the columns that scroll (right of the ones pinned at the
     * start), its header cell's box keeping it from leaving its group: none in a pinned group,
     * always in view.
     */
    function writeInset(
        layer: InsetLayer,
        element: HTMLElement,
        x: number,
        side: "left" | "right",
        shown: GridView<TRow, TNode>,
        shownEndFrom: number,
        endShift: number,
    ) {
        if (layer === "detail") {
            // the view's start: what a column at offset 0 shows at
            element.style[side] = `${-x}px`;
            return;
        }
        if (layer === "label") {
            const cell = shown.header.cellByKey(
                element.getAttribute(GROUP_LABEL_ATTRIBUTE) ?? "",
            );
            element.style[side] =
                cell && columnSide(shown, cell.columnIndex) === undefined
                    ? `${shown.pinnedWidth - x}px`
                    : "";
            return;
        }
        const attribute = element.getAttribute("data-column-index");
        const columnIndex = attribute === null ? Number.NaN : Number(attribute);
        if (!Number.isInteger(columnIndex)) return;
        element.style[side] = `${pinnedInset(
            shown.columnAxis,
            columnIndex,
            x,
            columnPart(columnIndex, shown.pinnedColumnCount, shownEndFrom) ===
                "end"
                ? endShift
                : 0,
        )}px`;
    }

    /**
     * Writes the pinned cells' insets when the layers' `x`, the columns, the view's width or the
     * direction moved, and only then: unscaled, `x` is the base, which moves with a new view,
     * never with a scroll frame. On a new side, the other one is cleared.
     */
    function writeInsets(x: number, shown: GridView<TRow, TNode>) {
        const { columnAxis } = shown;
        const side = inlineStart(direction);
        if (
            insetsFor?.x === x &&
            insetsFor.columnAxis === columnAxis &&
            insetsFor.width === width &&
            insetsFor.side === side
        ) {
            return;
        }
        // the other side, cleared when the insets may be there (nothing changes where they are not)
        const other =
            insetsFor?.side === side
                ? null
                : side === "left"
                  ? "right"
                  : "left";
        insetsFor = { x, columnAxis, width, side };
        const shownEndFrom = endPartFrom(shown);
        const endShift = pinnedEndShift(columnAxis, width);
        for (const layer of INSET_LAYERS) {
            for (const element of layers[layer]) {
                if (other) element.style[other] = "";
                writeInset(
                    layer,
                    element,
                    x,
                    side,
                    shown,
                    shownEndFrom,
                    endShift,
                );
            }
        }
    }

    /** Writes the layers' offsets for the view on screen (none before one), when they moved. */
    function writeLayers() {
        if (!viewport || !committed) return;
        const x = offsetX(committed, viewport);
        const y = offsetY(committed, viewport);
        if (x !== layerX || y !== layerY) {
            layerX = x;
            layerY = y;
            setTransform("body", layerTransform("body", x, y));
            setTransform("header", layerTransform("header", x, y));
        }
        writeInsets(x, committed);
    }

    /**
     * Sets the physical scroll, now or, while a view the adapter has not committed yet is waiting
     * (its sizer may not have its size), when it commits; a later move replaces an earlier one.
     */
    function scrollWhenReady(moves: ScrollMoves) {
        if (view === committed) {
            applyScroll(moves);
            return;
        }
        if (moves.top !== undefined) pendingScroll.top = moves.top;
        if (moves.left !== undefined) pendingScroll.left = moves.left;
    }

    /** Writes the physical scroll: whole pixels, as the axes hold it (Epic #89). */
    function applyScroll(moves: ScrollMoves) {
        if (!viewport) return;
        if (moves.top !== undefined) viewport.scrollTop = moves.top;
        if (moves.left !== undefined) {
            viewport.scrollLeft = inlineSign(direction) * moves.left;
        }
    }

    /** Reads the physical scroll into both axes (both, always); returns whether either moved. */
    function syncScroll(): boolean {
        const rows = rowsY.sync(viewport?.scrollTop ?? 0);
        const columns = columnsX.sync(scrollX(viewport));
        return rows || columns;
    }

    function readSize() {
        if (!viewport) return;
        width = viewport.clientWidth;
        height = viewport.clientHeight;
        updatePinning();
    }

    /** The first column pinned at the end in effect (`pinnedEndFrom`): the count without one. */
    function endFrom(): number {
        return pinnedEndFrom(columnAxis.count, pinnedEndCount);
    }

    /**
     * The pinned columns in effect (pinning's, Epic #148: none without it, every column
     * scrolling), for the columns and the view's width: what the layers, the windows and the
     * insets are laid out by, zeros without pinning.
     */
    function updatePinning() {
        pinning =
            features.pinnedColumns?.(
                state.columns as readonly Column<unknown, unknown>[],
                columnAxis,
                width,
            ) ?? NO_PINNED;
        pinnedCount = pinning.startCount;
        pinnedWidth = pinning.startWidth;
        pinnedEndCount = pinning.endCount;
        pinnedEndWidth = pinning.endWidth;
    }

    /**
     * The engine's widths for the state and the view's width (A1, A5): computed only while a
     * column flexes or fits itself. Returns whether they changed.
     */
    function updateAutoWidths(): boolean {
        const next = hasEngineSized(state.columns)
            ? autoWidthsOf(state.columns, overridesOf(state), automatic, width)
            : NO_WIDTHS;
        if (sameWidths(next, autoWidths)) return false;
        autoWidths = next;
        return true;
    }

    /** The column the view shows first right of the pinned ones, and how far into it (W8). */
    function columnAnchor() {
        return anchorOf(
            columnAxis,
            columnsX.virtual,
            columnsX.virtual + pinnedWidth,
        );
    }

    /**
     * The column the view shows first across a collapse (E1.3), by key in the new layout: itself
     * as far into it as it was, else (hidden) where the active cell would go (`shownColumnOf`),
     * from its start: the group whose toggle the view showed stays near it.
     */
    function collapseAnchor(
        before: DataGridModel<TRow, TNode>["state"],
        after: DataGridModel<TRow, TNode>["state"],
    ): AxisAnchor | null {
        const anchor = columnAnchor();
        if (!anchor) return null;
        const kept = after.header.cellByKey(
            before.columns[anchor.index]?.key ?? "",
        );
        if (kept) return { index: kept.columnIndex, within: anchor.within };
        const index = shownColumnOf(before, after.header, anchor.index);
        return index === undefined ? null : { index, within: 0 };
    }

    /** Keeps the view on an anchor's column, as far into it as it was, on a new column axis. */
    function keepColumnAnchor(anchor: AxisAnchor) {
        columnsX.virtual = Math.max(
            0,
            anchoredOffset(columnAxis, anchor) - pinnedWidth,
        );
    }

    /** The physical scroll follows a kept anchor, even when the total did not change. */
    function followColumnAnchor() {
        const left = columnsX.scrollTo(columnsX.virtual);
        if (Math.abs(left - scrollX(viewport)) > 0.5) {
            scrollWhenReady({ left });
        }
    }

    /**
     * Lays the columns out again after the view's width or the automatic widths changed: when the
     * engine's widths moved, a new column axis, the view kept on the column it shows first (as for
     * a resize), and their event. Returns whether they moved: the view is laid out, else it is the
     * caller's to.
     */
    function relayoutColumns(): boolean {
        if (!updateAutoWidths()) return false;
        const anchor = columnAnchor();
        columnAxis = columnAxisOf(state, overridesOf(state), autoWidths);
        updatePinning();
        if (anchor) keepColumnAnchor(anchor);
        relayout(true);
        if (anchor) followColumnAnchor();
        emit("column-auto-widths", autoWidths);
        return true;
    }

    /** The sizes or the content changed: remap, then update; scroll once the sizer has its size. */
    function relayout(fresh: boolean) {
        // a new direction (the model's) first: nothing is written for the old one
        updateDirection(true);
        viewStale = true;
        const moves = remap();
        update(fresh ? "fresh" : "trim");
        // the sizer gets its new size when the adapter commits this view
        scrollWhenReady(moves);
    }

    // ── scroll and wheel ─────────────────────────────────────────────────────

    function onScroll() {
        const top = rowsY.virtual;
        const left = columnsX.virtual;
        // the scroll the engine made itself lands where it is: the layers only
        if (syncScroll()) {
            // one it did not make, on either axis, leaves the cell it scrolled to (E2.2)
            if (
                Math.abs(rowsY.virtual - top) > 1 ||
                Math.abs(columnsX.virtual - left) > 1
            ) {
                cellScroll = null;
            }
            update();
        } else {
            writeLayers();
        }
        retargetAfterScroll();
    }

    /**
     * A scroll during a header cell's or a row's drag (the wheel, the scrollbar, the edge
     * scroll): its target is worked out again from the pointer's last place, in the next frame.
     */
    function retargetAfterScroll() {
        if (drag?.dragged && !(drag.kind === "feature" && drag.fixed)) {
            askFrame(drag);
        }
    }

    /**
     * Listens to the wheel while an axis is scaled, and only then: a listener that is not passive
     * makes the browser wait for it before it scrolls.
     */
    function listenToWheel() {
        const scaled = rowsY.mapping.scaled || columnsX.mapping.scaled;
        if (!viewport || scaled === wheelOn) return;
        wheelOn = scaled;
        if (scaled) {
            viewport.addEventListener("wheel", onWheel, { passive: false });
        } else {
            viewport.removeEventListener("wheel", onWheel);
        }
    }

    /** Under scaling, the wheel moves the content by exactly its delta (the native scroll would not). */
    function onWheel(event: WheelEvent) {
        const target = event.target;
        const yScaled = rowsY.mapping.scaled;
        const xScaled = columnsX.mapping.scaled;
        if (
            (!yScaled && !xScaled) ||
            !viewport ||
            event.ctrlKey ||
            event.defaultPrevented ||
            !isElement(target)
        ) {
            return;
        }
        const unit =
            event.deltaMode === 1
                ? LINE_HEIGHT
                : event.deltaMode === 2
                  ? bodyHeight()
                  : 1;
        let dy = event.deltaY * unit;
        // physical: right to left, a move to the right is one toward the start
        let dx = event.deltaX * unit;
        if (event.shiftKey && dx === 0) {
            dx = dy;
            dy = 0;
        }
        // a wheel along no scaled axis is the browser's own scroll
        if (!(yScaled && dy !== 0) && !(xScaled && dx !== 0)) return;
        // each axis's part is what still scrolls its way inside the grid (a nested grid, a notes
        // panel or a field in a cell, Epic #89, E5.2), as the browser would give it; at its end the
        // browser would chain it here as a native scroll, a scaled jump: the grid takes it,
        // exactly. Not asked of the grid's own cells, rows and layers
        // (a cell's ownership walks up to its viewport: asked only of a cell)
        const plain = isOwnLayer(target) || isCellElement(target);
        if (!plain && event.timeStamp - wheelAt > WHEEL_GESTURE) {
            // a new gesture: the styles read in the last one may have changed
            wheelStyles = new WeakMap();
        }
        wheelAt = event.timeStamp;
        const innerY =
            plain || dy === 0
                ? null
                : scrollerBefore(target, viewport, false, dy, wheelStyles);
        const innerX =
            plain || dx === 0
                ? null
                : scrollerBefore(target, viewport, true, dx, wheelStyles);
        if ((dy === 0 || innerY) && (dx === 0 || innerX)) return;
        event.preventDefault();
        // a person's scroll: the cell it scrolled to is left (E2.2)
        cellScroll = null;
        // each axis by its own rule: whole pixels, an unscaled one keeping a delta's fraction for
        // the next delta (Epic #89: WebKit drops a fraction written to the scroll); a part an
        // element inside took, scrolled there, as the browser would have
        if (innerY) innerY.scrollTop += dy;
        else if (dy !== 0) viewport.scrollTop = rowsY.scrollBy(dy);
        if (innerX) innerX.scrollLeft += dx;
        else if (dx !== 0) {
            const sign = inlineSign(direction);
            viewport.scrollLeft = sign * columnsX.scrollBy(sign * dx);
        }
        // the scroll event follows (or not, for a sub-pixel move): update now either way
        syncScroll();
        update();
        retargetAfterScroll();
    }

    /** when the last wheel came (its `timeStamp`), and the styles read during its gesture */
    let wheelAt = Number.NEGATIVE_INFINITY;
    let wheelStyles: WheelStyles = new WeakMap();

    /** a scroll to a cell asked for before the viewport attached: applied on attach */
    let pendingCellScroll: EngineActionMap["scroll-to-cell"] | null = null;

    function scrollToCell(payload: EngineActionMap["scroll-to-cell"]) {
        if (!viewport) {
            pendingCellScroll = payload;
            return;
        }
        const { rowIndex, columnIndex, align } = payload;
        cellScroll = rowIndex === undefined ? null : { rowIndex, align };
        const moves: ScrollMoves = {};
        if (
            rowIndex !== undefined &&
            rowIndex >= 0 &&
            rowIndex < rowAxis.count
        ) {
            // the row's cells: its detail below them is not what a move goes to
            const start = rowAxis.offsetOf(rowIndex);
            const target = scrollTargetForSpan(
                start,
                start + cellsSizeOf(rowAxis, rowIndex),
                rowsY.virtual,
                bodyHeight(),
                rowAxis.totalSize,
                align,
            );
            // compared with what the axis would hold: a move to the end it is at is no move
            if (rowsY.moves(target)) {
                moves.top = rowsY.scrollTo(target);
            }
        }
        if (
            columnIndex !== undefined &&
            columnPart(columnIndex, pinnedCount, endFrom()) === undefined
        ) {
            // into the view between the pinned columns; a pinned one is always in view. Worked
            // out in the scroll's own space (the column's offset less the pinned width), so its
            // edges are rounded where the scroll is whole pixels, a fractional pinned width too
            const start = columnAxis.offsetOf(columnIndex) - pinnedWidth;
            const target = scrollTargetForSpan(
                start,
                start + columnAxis.sizeOf(columnIndex),
                columnsX.virtual,
                scrollingWidth(),
                columnAxis.totalSize - pinnedEndWidth - pinnedWidth,
                align,
            );
            if (columnsX.moves(target)) {
                moves.left = columnsX.scrollTo(target);
            }
        }
        if (moves.top === undefined && moves.left === undefined) return;
        update();
        scrollWhenReady(moves);
    }

    function scrollTo({ top, left }: EngineActionMap["scroll-to"]) {
        cellScroll = null;
        const moves: ScrollMoves = {};
        if (top !== undefined) moves.top = rowsY.scrollTo(top);
        if (left !== undefined) moves.left = columnsX.scrollTo(left);
        update();
        scrollWhenReady(moves);
    }

    /**
     * What scrolls a cell into view: its row (a body row; the header's and the summary rows are
     * always in view), its column.
     */
    function scrollPayloadFor(
        position: CellPosition,
    ): EngineActionMap["scroll-to-cell"] {
        const { rowIndex } = position;
        return {
            rowIndex:
                rowIndex >= 0 && rowIndex < state.rowCount
                    ? rowIndex
                    : undefined,
            columnIndex: columnToScrollTo(
                position,
                state.header,
                pinnedCount,
                columnWindow.visible,
                endFrom(),
                // a body or summary row cell spanning columns (E1.2) is in view while any of
                // them is
                !isHeaderRow(rowIndex, state.header) &&
                    hasColumnSpans(state.columns)
                    ? spanAt(state, rowIndex, position.columnIndex)
                    : undefined,
            ),
        };
    }

    // ── focus ────────────────────────────────────────────────────────────────

    function focusInside(): boolean {
        const active = viewport?.ownerDocument.activeElement;
        return Boolean(viewport && active && viewport.contains(active));
    }

    function flushFocus() {
        if (!pendingFocus || !viewport) return;
        const position = state.activePosition;
        if (!position) {
            pendingFocus = false;
            return;
        }
        // its own cell: a nested grid may have one at the same indexes; a header cell spanning
        // rows carries its top row
        const cell = cellElement(position);
        if (!cell) return;
        pendingFocus = false;
        const doc = viewport.ownerDocument;
        const focused = doc.activeElement;
        // focus that left the grid for something else stays there
        if (focused && focused !== doc.body && !viewport.contains(focused)) {
            return;
        }
        // focus already in the cell (on it, or on a control inside it) stays where it is
        if (!focused || !cell.contains(focused)) {
            // the engine scrolled it into view already, through the scaling-aware mapping
            cell.focus({ preventScroll: true });
        }
    }

    /** The first cell in view: where focus lands when the grid itself gets it. */
    function firstVisibleCell(): CellPosition | null {
        if (state.columns.length === 0) return null;
        const rowIndex =
            state.rowCount > 0
                ? firstRowWithCellsInView()
                : state.headerRowHeight > 0
                  ? -1
                  : null;
        if (rowIndex === null) return null;
        return {
            rowIndex,
            columnIndex: pinnedCount > 0 ? 0 : columnWindow.visible.start,
        };
    }

    /**
     * Makes the first cell in view active, to focus it; refused (or none, or no navigation),
     * nothing to focus.
     */
    function focusFirstVisibleCell() {
        const first = firstVisibleCell();
        // refused: a middleware, a controlled parent
        if (!first || !activate(first)) pendingFocus = false;
    }

    /**
     * The first row in view whose cells are: one whose cells scrolled above the view while its
     * detail shows is passed over (when a row follows it).
     */
    function firstRowWithCellsInView(): number {
        const first = rowWindow.visible.start;
        const cellsEnd = rowAxis.offsetOf(first) + cellsSizeOf(rowAxis, first);
        // the next row only when it is in view too (a detail may fill the view)
        return cellsEnd <= rowsY.virtual && first + 1 < rowWindow.visible.end
            ? first + 1
            : first;
    }

    /** Whether an event comes from this grid itself, not from a grid nested in one of its cells. */
    function inViewport(target: EventTarget | null): boolean {
        return (
            viewport !== null &&
            isElement(target) &&
            ownerViewport(target) === viewport
        );
    }

    /** Whether a key from `target` is the grid's: from one of its cells, its viewport or a layer. */
    function ownsKeysOf(target: Element): boolean {
        return isOwnLayer(target) || cellOf(target) !== null;
    }

    /**
     * The cell of this grid an event happened in. Inside a nested grid, it is the cell of this
     * grid that holds the nested one: the nested grid's own cells are not this grid's.
     */
    function cellOf(target: EventTarget | null): CellPosition | null {
        const cell = cellNodeOf(target);
        return cell && positionOf(cell);
    }

    /** The element of the cell `cellOf` finds. */
    function cellNodeOf(target: EventTarget | null): Element | null {
        if (!viewport || !isElement(target)) return null;
        let cell: Element | null = null;
        let node: Element | null = target;
        for (; node && node !== viewport; node = node.parentElement) {
            // below another grid's viewport: whatever was found belongs to that grid
            if (VIEWPORTS.has(node)) cell = null;
            else if (!cell && isCellNode(node)) cell = node;
        }
        return node === viewport ? cell : null;
    }

    /** A cell element's position, from its indexes. */
    function positionOf(cell: Element): CellPosition | null {
        const rowIndex = Number(cell.getAttribute("data-row-index"));
        const columnIndex = Number(cell.getAttribute("data-column-index"));
        return Number.isInteger(rowIndex) && Number.isInteger(columnIndex)
            ? { rowIndex, columnIndex }
            : null;
    }

    // ── nesting: an inner grid's tab stop is its holder's (Epic #89, E5.2) ────

    /**
     * Whether this grid's active cell holds `element` (an inner grid's viewport): the cell of this
     * grid it is in, or, in a row's detail (a row index and no column), its row. One outside any
     * row (in the empty state, beside the grid's layers) is no cell's: always held, its own tab
     * stop.
     */
    function holdsNested(element: Element): boolean {
        for (
            let node = element.parentElement;
            node && node !== viewport;
            node = node.parentElement
        ) {
            if (!node.hasAttribute("data-row-index")) continue;
            const active = state.activePosition;
            if (!active) return false;
            if (!node.hasAttribute("data-column-index")) {
                return (
                    Number(node.getAttribute("data-row-index")) ===
                    active.rowIndex
                );
            }
            const position = positionOf(node);
            return position !== null && same(active, position);
        }
        return true;
    }

    /**
     * Finds the grid this one is nested in: the nearest attached viewport above its own. Asked on
     * its attach, and when a viewport around it attaches or detaches (`NESTINGS`): an outer
     * viewport attaches after its cells', a grid between two others may attach after both,
     * nearer than the host found before, and a host detaching leaves it to the next one out.
     */
    function findHost() {
        const parent = viewport?.parentElement;
        const outer = parent ? ownerViewport(parent) : null;
        const found = (outer && HOSTS.get(outer)) ?? null;
        if (found === host) return;
        unlistenHost?.();
        unlistenHost = null;
        host = found;
        if (found) unlistenHost = found.listen(updateTabStop);
        updateTabStop();
    }

    /**
     * Whether the grid's tab stop is in the page's tab order now: always on its own (or with
     * `ownTabStop`); nested, while focus is in it (`focused`) or its holder's active cell holds it.
     */
    function updateTabStop(focused = focusInside()) {
        const next =
            options.ownTabStop === true ||
            host === null ||
            viewport === null ||
            focused ||
            host.holds(viewport);
        if (next === tabbable) return;
        tabbable = next;
        viewStale = true;
        update();
    }

    // ── interaction: a cell's controls have the keys (Epic #52) ──────────────

    /** This grid's own element of a cell (a nested grid may have one at the same indexes). */
    function cellElement(position: CellPosition): HTMLElement | null {
        if (!viewport) return null;
        const selector = cellSelector(elementPosition(position, state));
        for (const element of viewport.querySelectorAll<HTMLElement>(
            selector,
        )) {
            if (ownerViewport(element) === viewport) return element;
        }
        return null;
    }

    /** Whether an element is one of this grid's cells (or header cells) itself. */
    function isCellElement(element: Element): boolean {
        return isCellNode(element) && ownerViewport(element) === viewport;
    }

    /**
     * The position of the cell an element is, when it is one of this grid's body row cells itself
     * (not a control inside it, a header cell nor a summary row's): where the row keys act.
     */
    function bodyCellOf(element: Element): CellPosition | null {
        const position = isCellElement(element) ? cellOf(element) : null;
        return position && isIndex(position.rowIndex, state.rowCount)
            ? position
            : null;
    }

    function onPointerDown(event: PointerEvent) {
        pointerDown = true;
        pressedAt = { x: event.clientX, y: event.clientY };
        lastPress = null;
    }

    // ── drags: a row's, a feature's (Epics #86, #144) ──────────────────────────

    /**
     * This grid's element marked with `attribute` an event happened in, and the mark's value (a
     * nested grid's is that grid's): a row's drag handle, a feature's (a column resizer).
     */
    function markedOf(
        target: EventTarget | null,
        attribute: string,
    ): { element: HTMLElement; value: string } | null {
        if (!isElement(target)) return null;
        const element = target.closest<HTMLElement>(`[${attribute}]`);
        const value = element?.getAttribute(attribute);
        return element && value && ownerViewport(element) === viewport
            ? { element, value }
            : null;
    }

    /** A row's drag's state changed: a new view, and its event. */
    function setRowReorder(next: RowReorder | null) {
        rowReorder = next;
        viewStale = true;
        update();
        emit("row-reorder", next);
    }

    /**
     * A press in the grid, after the consumer's own handlers (`preventDefault` cancels it): the
     * features' first (Epic #144: a fill handle's, a body cell's range; Epic #148: a resizer's, a
     * reorderable header cell's), then a primary press on a row's drag handle may become a drag
     * (E2.3). With rows that do not move and no feature's, there is none.
     */
    function pointerdown(event: PointerEvent): boolean {
        if (event.defaultPrevented || event.button !== 0 || drag || !viewport) {
            return false;
        }
        // the features' presses: a resizer's, a fill handle's (before a row's handle around it,
        // as ever), a body cell's range (which leaves a row's handle and the header cells alone),
        // a header cell's move
        for (const featurePress of featureHandlers.pointerdown) {
            if (featurePress(event)) return true;
        }
        const handle = options.reorderableRows
            ? markedOf(event.target, ROW_DRAG_HANDLE_ATTRIBUTE)
            : null;
        if (!handle) return false;
        // a row that cannot move (sorted, not loaded): a plain press
        const rowIndex = Number(handle.value);
        const rowKey = loadedRowKey(state, rowIndex);
        if (rowKey === undefined || !rowsOrderedMove()) return false;
        // a handle's press is not prevented: under the slop it is a click
        return press(event, {
            kind: "row",
            dragged: false,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            doc: viewport.ownerDocument,
            x: event.clientX,
            y: event.clientY,
            frame: null,
            rowIndex,
            rowKey,
            element: handle.element,
            viewY: 0,
        });
    }

    /**
     * A press the grid takes: its drag (or a press that may become one) followed wherever the
     * pointer goes, and held by its element at once when it drags from the start.
     */
    function press(event: PointerEvent, next: Drag): true {
        drag = next;
        lastPress = next;
        listen(next, event.pointerType === "touch");
        if (next.dragged) capture(next);
        return true;
    }

    /**
     * The body cell of this grid a press happened in (E4.1), at its element's position: `null`
     * outside one (a header, a summary row, a detail, a nested grid's cell), and on a control
     * inside it (it acts on its own), a column resizer or a row's drag handle.
     */
    function pressedBodyCellOf(
        target: EventTarget | null,
    ): CellPosition | null {
        if (!isElement(target) || !inViewport(target)) return null;
        const element = cellNodeOf(target);
        const position = element && positionOf(element);
        if (!position || !isIndex(position.rowIndex, state.rowCount)) {
            return null;
        }
        for (
            let node: Element | null = target;
            node && node !== element;
            node = node.parentElement
        ) {
            if (
                isControl(node) ||
                isResizer(node) ||
                node.hasAttribute(ROW_DRAG_HANDLE_ATTRIBUTE) ||
                node.hasAttribute(FILL_HANDLE_ATTRIBUTE)
            ) {
                return null;
            }
        }
        return position;
    }

    /**
     * Follows a press's pointer and keys wherever they go, and keeps the page's own drags (a text
     * selection, a native drag of an image or a link) out of it, and, for a touch, its long press
     * (Epic #89: the menu it would open; a mouse's context menu, a Ctrl+click on macOS too, stays
     * the app's).
     */
    function listen(current: Drag, touch: boolean) {
        const { doc } = current;
        doc.addEventListener("pointermove", onDragMove, true);
        // a press the grid never heard released: the next one ends it
        doc.addEventListener("pointerdown", onNextPress, true);
        // Escape ends it wherever focus is (the page, outside the grid), after the app's own
        // handlers: the grid's `keydown` takes it first when focus is in the grid
        doc.addEventListener("keydown", onDragKey);
        doc.addEventListener("selectstart", preventDefault, true);
        doc.addEventListener("dragstart", preventDefault, true);
        if (touch) doc.addEventListener("contextmenu", preventDefault, true);
        doc.defaultView?.addEventListener("blur", onWindowBlur);
    }

    /** The moves come to the drag's element wherever the pointer goes. */
    function capture(current: Drag) {
        current.element.addEventListener("lostpointercapture", onLostCapture);
        try {
            current.element.setPointerCapture(current.pointerId);
        } catch {
            // no pointer to capture (a press the page made up, a DOM without capture): the
            // document still hears the moves and the release
        }
    }

    /** Whether a drag is on: one past the slop, or dragging from its press (Escape is its). */
    function dragging(): boolean {
        return drag?.dragged === true;
    }

    /** A move of the dragging pointer: one step a frame, however often it moves. */
    function onDragMove(event: PointerEvent) {
        if (!drag || event.pointerId !== drag.pointerId) return;
        // no button down any more (a release the page never heard): the drag ends where it is
        if (event.buttons === 0) {
            endDrag("lost");
            return;
        }
        if (!drag.dragged) {
            // past a click's slop, the press drags its row, or a feature's (a header cell's)
            if (
                Math.hypot(
                    event.clientX - drag.startX,
                    event.clientY - drag.startY,
                ) > CLICK_SLOP
            ) {
                drag.x = event.clientX;
                drag.y = event.clientY;
                if (drag.kind === "row") startRowDrag(drag);
                else drag.start?.();
            }
            return;
        }
        // a row's drag follows the pointer's y, a feature's its axis (a column's: x) or both
        const axis = drag.kind === "row" ? "y" : drag.axis;
        if (
            axis === "x"
                ? event.clientX === drag.x
                : axis === "y"
                  ? event.clientY === drag.y
                  : event.clientX === drag.x && event.clientY === drag.y
        ) {
            return;
        }
        drag.x = event.clientX;
        drag.y = event.clientY;
        if (!askFrame(drag)) dragTo(drag);
    }

    /**
     * Another press while one is on: a press still under the slop is over (its release was never
     * heard), and so is a drag whose own pointer presses again.
     */
    function onNextPress(event: PointerEvent) {
        if (drag && (!drag.dragged || event.pointerId === drag.pointerId)) {
            endDrag("lost");
        }
    }

    /** The window lost focus: a press still under the slop will not be released here. */
    function onWindowBlur() {
        if (drag && !drag.dragged) endDrag("lost");
    }

    /** Asks for the drag's next frame, once; `false` in a DOM without animation frames. */
    function askFrame(current: Drag): boolean {
        if (current.frame !== null) return true;
        const win = current.doc.defaultView;
        if (!win || !("requestAnimationFrame" in win)) return false;
        current.frame = win.requestAnimationFrame(onDragFrame);
        return true;
    }

    function onDragFrame() {
        if (!drag) return;
        drag.frame = null;
        dragTo(drag);
    }

    /**
     * A drag's step to its pointer: a row's target, or a feature's own (a range's focus, a fill's
     * target, a column's width or target).
     */
    function dragTo(current: Drag) {
        if (current.kind === "feature") current.step();
        else rowDragStep(current);
    }

    /** The drag's element lost the pointer (removed, or taken by the page). */
    function onLostCapture(event: Event) {
        if (
            drag &&
            "pointerId" in event &&
            event.pointerId === drag.pointerId
        ) {
            endDrag("lost");
        }
    }

    /**
     * Escape during a drag (focus anywhere, the app's handlers first) cancels it (W4, O3), once:
     * a handled Escape is prevented, and skipped from then on.
     */
    function onDragKey(event: KeyboardEvent) {
        if (!dragging() || event.key !== "Escape" || event.defaultPrevented) {
            return;
        }
        event.preventDefault();
        endDrag("cancel");
    }

    function preventDefault(event: Event) {
        event.preventDefault();
    }

    /** Stops listening to the drag, its frame cancelled; returns it. */
    function stopDrag(): Drag | null {
        const ended = drag;
        if (!ended) return null;
        const { doc } = ended;
        if (ended.frame !== null) {
            doc.defaultView?.cancelAnimationFrame(ended.frame);
        }
        doc.removeEventListener("pointermove", onDragMove, true);
        doc.removeEventListener("pointerdown", onNextPress, true);
        doc.removeEventListener("keydown", onDragKey);
        doc.removeEventListener("selectstart", preventDefault, true);
        doc.removeEventListener("dragstart", preventDefault, true);
        doc.removeEventListener("contextmenu", preventDefault, true);
        doc.defaultView?.removeEventListener("blur", onWindowBlur);
        ended.element.removeEventListener("lostpointercapture", onLostCapture);
        drag = null;
        return ended;
    }

    /**
     * Ends the drag. A row's tells its move on a release only, once, and not when it would land
     * where it is. A feature's (a range's, a fill's: Epic #144; a column's resize or move: Epic
     * #148) is told how it ended.
     */
    function endDrag(how: DragEnd) {
        const ended = stopDrag();
        if (ended?.kind === "feature") {
            ended.end(how);
        } else if (ended?.kind === "row" && ended.dragged) {
            const target =
                how === "release"
                    ? rowReorderTarget(ended, viewYOf(ended.y))
                    : null;
            setRowReorder(null);
            if (target && target.targetIndex !== null) {
                moveRow(
                    ended.rowIndex,
                    landingIndex(
                        ended.rowIndex,
                        target.targetIndex,
                        target.side,
                    ),
                    ended.rowKey,
                );
            }
        }
    }

    // ── measuring columns' content (Epic #80): the automatic widths, a resize's fit ─

    /**
     * The columns' content widths (A3), measured in one layout: for each column index (in
     * `shown`, the view on screen), the widest of this grid's own rendered header cell of the
     * column, its body cells of loaded rows and its summary rows' cells (E2.1), at `max-content`.
     * A column with none rendered has none.
     */
    function measureColumns(
        shown: GridView<TRow, TNode>,
        columnIndexes: Iterable<number>,
    ): Map<number, number> {
        const measured = new Map<number, number>();
        if (!viewport) return measured;
        const elements: HTMLElement[] = [];
        const columnOf: number[] = [];
        for (const columnIndex of columnIndexes) {
            const key = shown.columnDefs[columnIndex]?.key;
            for (const element of viewport.querySelectorAll<HTMLElement>(
                `[data-row-index][data-column-index="${columnIndex}"]`,
            )) {
                const rowIndex = Number(element.getAttribute("data-row-index"));
                const header = isHeaderRow(rowIndex, shown.header)
                    ? shown.header.cellAt(rowIndex, columnIndex)
                    : undefined;
                if (
                    Number.isInteger(rowIndex) &&
                    ownerViewport(element) === viewport &&
                    // a body cell of a loaded row (a group row's, Epic #87), a summary row's
                    // cell, or the column's own header cell (not a group's starting at it);
                    // never a cell spanning columns (E1.2): wider than its column
                    (header
                        ? header.key === key && header.columnSpan === 1
                        : (summaryRowAt(shown, rowIndex) !== undefined ||
                              (rowIndex >= 0 &&
                                  rowLoaded(shown.source, rowIndex))) &&
                          cellSpan(shown, rowIndex, columnIndex) === 1)
                ) {
                    elements.push(element);
                    columnOf.push(columnIndex);
                }
            }
        }
        maxContentWidths(elements, layers.pinned, viewport).forEach(
            (width, index) => {
                const columnIndex = columnOf[index];
                if (columnIndex === undefined) return;
                measured.set(
                    columnIndex,
                    Math.max(width, measured.get(columnIndex) ?? 0),
                );
            },
        );
        return measured;
    }

    /** A measured content width as a column's width: rounded up, within its limits. */
    function fittedWidth(
        column: Column<TRow, TNode>,
        measured: number,
    ): number {
        return withinLimits(column, Math.ceil(measured));
    }

    /**
     * Fits the `autoSize` columns a committed view renders with loaded rows (A5), each once per
     * attach, in one layout: their widths are the engine's (`automatic`), never the model's. Not
     * while the grid is not laid out (no size: a hidden tab, a closed dialog): the first commit
     * where it is measures them. A column measured 0 wide keeps its width. Once every one of a
     * list of columns is measured, a commit returns at once.
     */
    function autoSize(shown: GridView<TRow, TNode>) {
        const columns = shown.columnDefs;
        if (autoSizedFor === columns || width === 0 || height === 0) return;
        const { autoSizeKeys } = columnTraits(columns);
        if (autoSizeKeys.every((key) => autoSized.has(key))) {
            autoSizedFor = columns;
            return;
        }
        const indexes: number[] = [];
        for (const columnIndex of shown.columns) {
            const column = columns[columnIndex];
            if (column?.autoSize === true && !autoSized.has(column.key)) {
                indexes.push(columnIndex);
            }
        }
        if (
            indexes.length === 0 ||
            // a loaded data row: group rows alone (all collapsed) would fit it to their cells
            !shown.rows.some(
                (rowIndex) => rowAt(shown.source, rowIndex) !== undefined,
            )
        ) {
            return;
        }
        let next: Record<string, number> | null = null;
        for (const [columnIndex, measured] of measureColumns(shown, indexes)) {
            const column = columns[columnIndex];
            if (!column) continue;
            autoSized.add(column.key);
            if (measured <= 0) continue;
            next ??= { ...automatic };
            next[column.key] = fittedWidth(column, measured);
        }
        if (next) {
            automatic = next;
            relayoutColumns();
        }
    }

    // ── the pointer over the view: its place, the edge scroll (Epics #75, #88) ─

    /**
     * Where a pointer's x is in the view: from its inline start, inside its border and a
     * scrollbar on that side (a layout read). Right to left, from its right edge.
     */
    function viewXOf(clientX: number): number {
        if (!viewport) return clientX;
        const left =
            viewport.getBoundingClientRect().left + viewport.clientLeft;
        const start =
            inlineStart(direction) === "left"
                ? left
                : left + viewport.clientWidth;
        return inlineSign(direction) * (clientX - start);
    }

    /**
     * The virtual column offset under a pointer at `x` in the view, kept over a part of it: the
     * strip pinned at the start, the one pinned at the end (at the view's end, or where the
     * columns end in a narrower grid), or (`undefined`) the columns that scroll between them.
     */
    function partOffsetAt(part: PinnedSide | undefined, x: number): number {
        if (part === undefined) {
            return (
                columnsX.virtual + clamp(x, pinnedWidth, width - pinnedEndWidth)
            );
        }
        if (part === "start") return clamp(x, 0, pinnedWidth);
        const end = columnAxis.totalSize;
        const shown = Math.min(width, end) - pinnedEndWidth;
        return end - pinnedEndWidth + clamp(x - shown, 0, pinnedEndWidth);
    }

    /**
     * A frame of a row's drag: the pointer's place in the view read once (before the scroll
     * writes; kept as `viewY`), the edge scroll, then the target; the pointer held near an edge
     * keeps scrolling, a frame at a time.
     */
    function rowDragStep(current: RowDrag) {
        const at = viewYOf(current.y);
        current.viewY = at;
        const scrolled = edgeScrollBy(rowEdgeStepAt(at), 0);
        const target = rowReorderTarget(current, at);
        if (target !== rowReorder) setRowReorder(target);
        if (scrolled) askFrame(current);
    }

    /**
     * Scrolls the rows by an edge scroll's step (`top`) and the columns by another (`left`; 0 for
     * none), in one move through the engine's own scroll (scaled or not); returns whether they
     * moved.
     */
    function edgeScrollBy(top: number, left: number): boolean {
        if (top === 0 && left === 0) return false;
        const y = rowsY.virtual;
        const x = columnsX.virtual;
        scrollTo({
            top: top === 0 ? undefined : y + top,
            left: left === 0 ? undefined : x + left,
        });
        return rowsY.virtual !== y || columnsX.virtual !== x;
    }

    // ── a cell drag's frame: the edge scroll, the cell under the pointer (Epic #88) ─

    /**
     * A frame of a feature's cell drag (a range's, a fill's: E4.1, E4.4): the pointer's place in
     * the view read once, the edge scroll on both axes in one move (near the body's top or bottom
     * edge, or past it; near the scrolling columns' start or end edge, or past it, but never over
     * a pinned strip: a range among the pinned columns scrolls nothing sideways), then the cell
     * under the pointer (`known` when it is that one); held near an edge, it scrolls on, a frame
     * at a time.
     */
    function cellDragStep(
        current: FeatureDrag,
        known: CellPosition | null,
    ): CellPosition | null {
        const x = viewXOf(current.x);
        const y = viewYOf(current.y);
        const part = columnPartAt(x);
        const scrolled = edgeScrollBy(
            rowEdgeStepAt(y),
            part === undefined ? columnEdgeStepAt(x) : 0,
        );
        if (scrolled) askFrame(current);
        return cellAtView(x, y, known, part);
    }

    /** The part of the view a pointer at `x` is over: a pinned strip, or the columns that scroll. */
    function columnPartAt(x: number): PinnedSide | undefined {
        if (pinnedCount > 0 && x < pinnedWidth) return "start";
        return pinnedEndCount > 0 &&
            x >= Math.min(width, columnAxis.totalSize) - pinnedEndWidth
            ? "end"
            : undefined;
    }

    /**
     * The body cell under a pointer at `x` and `y` in the view, from the axes (not the DOM: rows
     * and columns off screen, measured or scaled alike), the pointer kept over the body and the
     * part of the view it is over: `known` itself when it is that cell (a drag frame allocates
     * only when the cell changes); `null` without rows or columns.
     */
    function cellAtView(
        x: number,
        y: number,
        known: CellPosition | null,
        part = columnPartAt(x),
    ): CellPosition | null {
        if (state.rowCount === 0 || columnAxis.count === 0) return null;
        const rowIndex = rowAxis.indexAt(rowOffsetAt(y));
        const columnIndex = columnAxis.indexAt(partOffsetAt(part, x));
        return known &&
            known.rowIndex === rowIndex &&
            known.columnIndex === columnIndex
            ? known
            : { rowIndex, columnIndex };
    }

    /**
     * Escape's last meaning (Epic #113): focus leaves the grid, the active position kept (Tab
     * comes back to it). A nested grid hands it to the outer cell holding it; else it is blurred.
     */
    function releaseFocus(target: Element) {
        pendingFocus = false;
        const outer = host ? viewport?.parentElement : null;
        const holder = outer?.closest(CELL_SELECTOR);
        if (outer && holder && ownerViewport(holder) === ownerViewport(outer)) {
            (holder as HTMLElement).focus({ preventScroll: true });
        } else {
            (target as HTMLElement).blur();
        }
    }

    // ── row reordering: the drag, the edge scroll, the keys (Epic #86, E2.3) ─

    /**
     * A press on a row's handle moved past the slop: its row drags, holding the pointer. The view
     * keeps it rendered (`buildView`, as the active row) while the edge scroll takes it out of the
     * rendered rows: the active cell is left as it is.
     */
    function startRowDrag(current: RowDrag) {
        current.dragged = true;
        capture(current);
        current.viewY = viewYOf(current.y);
        setRowReorder(rowReorderTarget(current, current.viewY));
        scrollAtEdge(current);
    }

    /** Asks for a row's drag's next frame while its pointer is in an edge zone: it scrolls on. */
    function scrollAtEdge(current: RowDrag) {
        if (rowEdgeStepAt(current.viewY) !== 0) {
            askFrame(current);
        }
    }

    /** Where a pointer's y is in the view: from its top, inside its border (a layout read). */
    function viewYOf(clientY: number): number {
        if (!viewport) return clientY;
        return (
            clientY - viewport.getBoundingClientRect().top - viewport.clientTop
        );
    }

    /**
     * Where a drop would move a drag's row, its pointer at `y` in the view: beside the row under
     * it, on the side of its cells' middle (a detail below them is after it), the pointer kept
     * over the body (the edge scroll reaches further). From the row axis, not the DOM: a row
     * scrolled out of the rendered ones counts, measured, expanded and scaled alike. No target
     * when it would land where it is or on a row not loaded (rows that stop moving end the drag:
     * `followRowDrag`); the current state while the same.
     */
    function rowReorderTarget(current: RowDrag, y: number): RowReorder {
        const offset = rowOffsetAt(y);
        const at = rowAxis.indexAt(offset);
        const start = rowAxis.offsetOf(at);
        const { rowIndex, rowKey } = current;
        return dropTargetOf<RowReorder>(
            rowReorder,
            offset,
            rowIndex,
            at,
            start,
            start + cellsSizeOf(rowAxis, at),
            at >= 0 && loadedRowKey(state, at) !== undefined,
            (side) =>
                side
                    ? { rowIndex, rowKey, targetIndex: at, side }
                    : { rowIndex, rowKey, targetIndex: null, side: null },
        );
    }

    /**
     * After a change of the model, laid out (the offset clamped to the new rows): a row's drag
     * follows its row, its target worked out again from the pointer's last y in the view (no
     * layout read), and ends when its row is no longer at its index (by key) or rows no longer
     * move. Held in an edge zone, the edge scroll goes on (rows added at the end come into reach).
     */
    function followRowDrag(current: RowDrag) {
        if (
            !rowsOrderedMove() ||
            loadedRowKey(state, current.rowIndex) !== current.rowKey
        ) {
            stopDrag();
            setRowReorder(null);
            return;
        }
        const target = rowReorderTarget(current, current.viewY);
        if (target !== rowReorder) setRowReorder(target);
        scrollAtEdge(current);
    }

    /**
     * the last move told, until the app moved its row: the active cell as it was then and its
     * row's key, which it follows once the moved key is where the move put it
     * (`followMovedRow`); only with `rowKey` (a row keyed by its index cannot be told from
     * another) and an active body row
     */
    let movedRow: {
        readonly move: RowMove;
        readonly active: CellPosition;
        readonly activeKey: RowKey;
    } | null = null;

    /** A row moves (a drop, the keys): the app is told, and the active cell will follow its row. */
    function moveRow(fromIndex: number, toIndex: number, rowKey: RowKey) {
        const move = { fromIndex, toIndex, rowKey };
        const active = state.activePosition;
        const activeKey =
            state.rowKey && active
                ? loadedRowKey(state, active.rowIndex)
                : undefined;
        movedRow =
            active && activeKey !== undefined
                ? { move, active, activeKey }
                : null;
        emit("row-move", move);
    }

    /**
     * After a change of the model: once the rows changed (a new source, `rows.changed`) and the
     * moved key is where the last move put it (the app moved it), the active cell goes where its
     * row went: the moved row's to `toIndex`, a row between the two indexes one place toward
     * `fromIndex`, when its key is there (else it stays), as a command after this change. Kept
     * through rows that change otherwise (a server answering in pieces); forgotten once followed,
     * once the active cell changed otherwise (the person or the app moved it) or rows are no
     * longer keyed, at the next move and when the viewport detaches.
     */
    function followMovedRow(
        before: DataGridModel<TRow, TNode>["state"],
        after: DataGridModel<TRow, TNode>["state"],
    ) {
        if (!movedRow) return;
        const { move, active, activeKey } = movedRow;
        if (after.activePosition !== active || !after.rowKey) {
            movedRow = null;
            return;
        }
        if (
            (after.source === before.source &&
                after.rowsChanged === before.rowsChanged) ||
            loadedRowKey(after, move.toIndex) !== move.rowKey
        ) {
            return;
        }
        movedRow = null;
        const rowIndex = indexAfterMove(
            active.rowIndex,
            move.fromIndex,
            move.toIndex,
        );
        if (
            rowIndex !== active.rowIndex &&
            loadedRowKey(after, rowIndex) === activeKey
        ) {
            activate({ rowIndex, columnIndex: active.columnIndex });
        }
    }

    /**
     * Ctrl/⌘+Shift+↑/↓ on a body cell in navigation, rows moving: one move of its row by one,
     * up or down, the active cell following it (once the app moved it), once per press (a held
     * key repeats: it would move the row on and on). Handled even when nothing moves (the first
     * or last row, a neighbour not loaded, the grid sorted, a repeat): the page never gets them.
     */
    function rowMoveKey(event: KeyboardEvent, target: Element): boolean {
        const up = event.key === "ArrowUp";
        if (
            !options.reorderableRows ||
            (!up && event.key !== "ArrowDown") ||
            !event.shiftKey ||
            !(event.ctrlKey || event.metaKey)
        ) {
            return false;
        }
        const position = bodyCellOf(target);
        if (!position) return false;
        event.preventDefault();
        if (event.repeat) return true;
        const { rowIndex } = position;
        const toIndex = rowIndex + (up ? -1 : 1);
        const rowKey = loadedRowKey(state, rowIndex);
        if (
            rowKey !== undefined &&
            loadedRowKey(state, toIndex) !== undefined &&
            rowsOrderedMove()
        ) {
            moveRow(rowIndex, toIndex, rowKey);
        }
        return true;
    }

    // ── clicks, presses and keys ─────────────────────────────────────────────

    /**
     * The header cell an event happened in, and its element, or `null`: not a header cell, or a
     * control inside the cell (it acts on its own; a resizer is one).
     */
    function headerCellOf(target: EventTarget | null): {
        readonly cell: HeaderCellLayout<TRow, TNode>;
        readonly element: Element;
    } | null {
        const element = cellNodeOf(target);
        const position = element && positionOf(element);
        if (!position || position.rowIndex >= 0 || !isElement(target)) {
            return null;
        }
        for (
            let node: Element | null = target;
            node && !isCellNode(node);
            node = node.parentElement
        ) {
            if (isControl(node) || isResizer(node)) return null;
        }
        const cell = state.header.cellAt(
            position.rowIndex,
            position.columnIndex,
        );
        return cell ? { cell, element } : null;
    }

    /** Whether the grid's rows move now (`rowsMove`): reorderable, in no feature's order. */
    function rowsOrderedMove(): boolean {
        return rowsMove(
            options.reorderableRows,
            features.rowsOrdered(state as FeatureState),
            state.source,
        );
    }

    function click(event: MouseEvent): boolean {
        if (
            event.defaultPrevented ||
            event.button !== 0 ||
            !inViewport(event.target)
        ) {
            return false;
        }
        // a press that moved is a drag (selecting the header's text), not a click. A click with
        // no press (`detail` 0: a screen reader, `element.click()`) has nothing to compare
        const press = pressedAt;
        pressedAt = null;
        // the click ending a drag is the drag's, never a sort: a feature's tells it (a resizer's
        // double click fits its column to its content, A4; a header cell's move, O3)
        const last = lastPress;
        lastPress = null;
        if (last?.dragged && event.detail > 0) {
            if (last.kind === "feature") last.click?.(event);
            return true;
        }
        if (
            event.detail > 0 &&
            press &&
            Math.hypot(event.clientX - press.x, event.clientY - press.y) >
                CLICK_SLOP
        ) {
            return false;
        }
        // a row group's toggle (Epic #87): a control of its cell, never a sort or a selection,
        // whatever the modifiers
        const toggle = markedOf(event.target, GROUP_TOGGLE_ATTRIBUTE);
        if (toggle) {
            model.run("row-groups.toggle", { rowIndex: Number(toggle.value) });
            return true;
        }
        // the installed features' clicks (Epic #141): a sortable header cell's sort, a double
        // click's edit (Epic #146)
        for (const featureClick of featureHandlers.click) {
            if (featureClick(event)) return true;
        }
        return false;
    }

    /** A release anywhere (or a pointer the browser took over for a scroll) ends the press. */
    function onPointerEnd(event: PointerEvent) {
        pointerDown = false;
        // the features' (Epic #146: a press that committed an edit holding focus, focus nowhere
        // comes back)
        for (const pointerEnd of featureHandlers.pointerEnd) pointerEnd(event);
        const cancelled = event.type === "pointercancel";
        // a press the browser took over makes no click
        if (cancelled) pressedAt = null;
        if (drag && event.pointerId === drag.pointerId) {
            // a release ends the drag where it happened; a pointer taken over cancels it
            if (!cancelled) {
                drag.x = event.clientX;
                drag.y = event.clientY;
            }
            endDrag(cancelled ? "cancel" : "release");
        }
    }

    function onFocusOut(event: FocusEvent) {
        const next = event.relatedTarget;
        // the features' (Epic #146: focus leaving an edit commits it)
        for (const focusout of featureHandlers.focusout) focusout(event);
        const inside = isElement(next) && viewport?.contains(next) === true;
        // focus leaving the cell in interaction (elsewhere in the page, a portal): navigation
        // focus gone from the grid: an entry waiting for its cell would pull it back, it is dropped
        if (!inside && viewport?.ownerDocument.hasFocus() !== false) {
            interaction.cancelPending();
        }
        // (the window losing focus, alt-tab or the devtools, is no leaving: focus comes back)
        const windowBlur =
            next === null && viewport?.ownerDocument.hasFocus() === false;
        if (interaction.cell && !windowBlur) {
            const cell = cellElement(interaction.cell);
            if (!cell || !(isElement(next) && cell.contains(next))) {
                interaction.leaveCell(false);
            }
        }
        if (viewport && next && !inside) pendingFocus = false;
        // focus leaving a nested grid: its tab stop is its holder's again (E5.2); not the window
        // losing focus, which leaves focus where it is
        if (!windowBlur) updateTabStop(inside);
    }

    function onFocusIn(event: FocusEvent) {
        const target = event.target;
        // focus in a nested grid keeps its tab stop (E5.2)
        updateTabStop(true);
        const cell = cellOf(target);
        if (cell) {
            if (rowsY.mapping.scaled || columnsX.mapping.scaled) {
                // the browser scrolled the focused cell into view itself (a Tab): under scaling its
                // scroll would map to a far jump, so the engine makes the move, exact, instead
                scrollToCell(scrollPayloadFor(cell));
            }
            // without navigation (Epic #144), a control focused in a cell is the page's own: no
            // cell is active, no interaction
            if (!features.navigable) return;
            // a header cell spanning rows is already active on any of its rows
            activate(cell);
            // focus a feature holds (Epic #146: the edited cell's editor), never an interaction
            for (const focusin of featureHandlers.focusin) {
                if (focusin(cell)) return;
            }
            if (
                isElement(target) &&
                !isCellElement(target) &&
                !target.hasAttribute(TAB_STOP_ATTRIBUTE)
            ) {
                // a control took focus (a click, a Tab in the cell): its cell is in interaction;
                // the activation was asked above: not twice (a controlled parent reports it)
                if (!same(interaction.cell, cell))
                    interaction.enterCell(cell, false, false);
            } else if (interaction.cell) {
                // the cell itself (or another one) took focus: back to navigation
                interaction.leaveCell(false);
            }
            return;
        }
        // the grid or the scroll container itself took focus (Tab into the grid; Firefox makes a
        // scroll container a tab stop): hand it to the active cell, or the first in view
        if (
            target !== viewport &&
            !(
                isElement(target) &&
                (layers.grid as ReadonlySet<Element>).has(target)
            )
        ) {
            return;
        }
        // a click on empty space focuses the container: that is no reason to activate a cell (nor
        // anything without navigation: no cell takes focus from the grid)
        if (pointerDown || !features.navigable) return;
        pendingFocus = true;
        if (state.activePosition) flushFocus();
        else focusFirstVisibleCell();
    }

    /**
     * A row group's keys on a body cell in navigation (Epic #87, the APG treegrid), rows having
     * kinds: Enter on a group row toggles it, and Space on any row that expands (a tree's parent too,
     * Enter staying its cell's), once per press; on the cell holding the row's toggle (else, the row
     * rendering none, its first column), →
     * expands a collapsed row group and ← collapses an expanded one, or, from a row that is not
     * an expanded group, goes to the row it is under (the same column). Each through a command,
     * so a middleware can refuse it; any other arrow, or one with nothing to do here, moves.
     */
    function rowGroupKey(event: KeyboardEvent, target: Element): boolean {
        if (
            !state.source.getRowMeta ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey
        ) {
            return false;
        }
        const position = bodyCellOf(target);
        if (!position) return false;
        const { rowIndex } = position;
        const meta = rowMetaAt(state.source, rowIndex);
        const groupKey = groupKeyAt(state, rowIndex, meta);
        // Enter on a group row only (a data row's Enter is its cell's: its controls, editing);
        // Space on any row that expands (a tree's parent too)
        if (
            (event.key === "Enter" && meta?.group) ||
            (event.key === " " && groupKey !== undefined)
        ) {
            event.preventDefault();
            // a held key repeats: it would open and close the group
            if (!event.repeat) model.run("row-groups.toggle", { rowIndex });
            return true;
        }
        const move = KEYS[inlineKey(event.key, direction)];
        const parentIndex = meta?.parentIndex;
        // a row that neither expands nor sits under one: plain arrows, nothing looked for; else
        // on its tree cell only (`onTreeColumn`)
        if (
            (move !== "left" && move !== "right") ||
            (groupKey === undefined && parentIndex === undefined) ||
            !onTreeColumn(rowIndex, target, position.columnIndex)
        ) {
            return false;
        }
        // → on a collapsed row group expands it, ← on an expanded one collapses it
        if (
            groupKey !== undefined &&
            groupExpanded(state, groupKey) === (move === "left")
        ) {
            event.preventDefault();
            model.run("row-groups.toggle", { rowIndex });
            return true;
        }
        if (
            move === "right" ||
            parentIndex === undefined ||
            !isIndex(parentIndex, state.rowCount)
        ) {
            return false;
        }
        event.preventDefault();
        pendingFocus = true;
        // the same column: the tree's (a parent's toggle is where its rows' is)
        activate({ rowIndex: parentIndex, columnIndex: position.columnIndex });
        flushFocus();
        return true;
    }

    /**
     * Whether a cell is on its row's tree cell (Epic #87): the cell holding the row's group
     * toggle; for a row rendering none (a leaf, a row loading), the column this grid's toggles are
     * in: one rendered now, else the one they were last found in (`treeColumn`, while the columns
     * stay), else the first column. The app keeps its toggles in one column.
     */
    function onTreeColumn(
        rowIndex: number,
        cell: Element,
        columnIndex: number,
    ): boolean {
        const own = toggleCellOf(`="${rowIndex}"`);
        const found = own ?? toggleCellOf("");
        const column = found ? positionOf(found)?.columnIndex : undefined;
        if (column !== undefined) treeColumn = column;
        if (own) return own === cell;
        return columnIndex === (treeColumn ?? 0);
    }

    /** The cell of this grid holding a group toggle (`value`: its attribute's, or any), or `null`. */
    function toggleCellOf(value: string): Element | null {
        if (!viewport) return null;
        for (const toggle of viewport.querySelectorAll(
            `[${GROUP_TOGGLE_ATTRIBUTE}${value}]`,
        )) {
            if (ownerViewport(toggle) === viewport) return cellNodeOf(toggle);
        }
        return null;
    }

    /** the column the grid's group toggles were last found in, while the columns stay (Epic #87) */
    let treeColumn: number | null = null;

    /** A page of rows for the keys: the rows in view less one, at least one. */
    function pageSize(): number {
        return Math.max(1, rowWindow.visible.end - rowWindow.visible.start - 1);
    }

    /** The features' start keys (`FeatureEngine.startKeydown`): whether one took the key. */
    function startKey(event: KeyboardEvent, target: Element): boolean {
        for (const featureKey of featureHandlers.startKeydown) {
            if (featureKey(event, target)) return true;
        }
        return false;
    }

    function keydown(event: KeyboardEvent): boolean {
        const target = event.target;
        const ctrl = event.ctrlKey || event.metaKey;
        // the features' keys before any guard, never taken (Epic #144): the clipboard's Ctrl/⌘+C
        // and Ctrl/⌘+V on one of the grid's cells, the page's own copy or paste following
        if (isElement(target) && isCellElement(target)) {
            for (const featureKey of featureHandlers.beforeKeydown) {
                featureKey(event, target);
            }
        }
        // a key typed into a field inside a cell is the field's, a key from outside the grid (a
        // menu portalled out of a cell, whose events still bubble through the cell) is not ours,
        // and neither is one from the app's content beside the cells (an empty state's action)
        // with Alt, only a character typed (AltGr, Option) is the grid's: it may start an edit
        if (
            event.defaultPrevented ||
            (event.altKey && !isAltCharacter(event)) ||
            !isElement(target) ||
            !inViewport(target)
        ) {
            return false;
        }
        // Escape during a drag cancels it (a resize back to the width it started from, W4),
        // before it leaves interaction; prevented, the document's listener skips it
        if (dragging() && event.key === "Escape") {
            event.preventDefault();
            endDrag("cancel");
            return true;
        }
        // the elements a feature holds (Epic #146: in an edit, its editor has the keys, the
        // grid taking Enter, Tab and Escape only, from the editor or its cell)
        for (const featureKey of featureHandlers.guardKeydown) {
            const taken = featureKey(event, target);
            if (taken !== undefined) return taken;
        }
        // in interaction, the cell's controls have the keys: the grid takes Escape (back to the
        // cell) and Tab (the cell's next control, wrapping) only, from a field too
        if (
            interaction.cell &&
            !isCellElement(target) &&
            // the app's own tab stop and a composition in progress (an IME) keep their keys
            !target.hasAttribute(TAB_STOP_ATTRIBUTE) &&
            !isComposing(event)
        ) {
            const cell = cellElement(interaction.cell);
            if (cell?.contains(target)) {
                if (event.key === "Escape") {
                    event.preventDefault();
                    interaction.leaveCell(true);
                    return true;
                }
                if (event.key === "Tab" && !ctrl) {
                    event.preventDefault();
                    interaction.cycleControls(cell, target, event.shiftKey);
                    return true;
                }
                // the features' keys on the cell's controls (Epic #148: a column resizer's keys
                // resize its column, W6)
                for (const featureKey of featureHandlers.interactionKeydown) {
                    if (featureKey(event, target)) return true;
                }
                // a button or a link has no use for the page keys: the container would page
                // itself, a far jump under scaling. A field keeps them (its caret)
                // a radio, a menu item or a tab keeps its arrows (its group's own moves)
                if (
                    (PAGE_KEYS.has(event.key) ||
                        (event.key === " " &&
                            target.tagName.toUpperCase() === "A")) &&
                    isPagelessControl(target) &&
                    !(event.key.startsWith("Arrow") && movesWithArrows(target))
                ) {
                    event.preventDefault();
                    return true;
                }
                return false;
            }
        }
        if (isEditable(target) || !ownsKeysOf(target)) return false;
        // a character typed with Alt (AltGr, Option) may start an edit (Epic #146), and is
        // nothing else of the grid's
        if (event.altKey) return startKey(event, target);
        // the installed features' keys (Epic #141), before the grid's own: Enter or Space on a
        // sortable column's header cell, Ctrl/⌘+Shift+←/→ on a reorderable one (Epic #148)
        for (const featureKey of featureHandlers.keydown) {
            if (featureKey(event, target)) return true;
        }
        // a row group's keys (Epic #87): Enter and Space toggle a group row (its controls get the
        // keys by F2), the arrows on a row's first column expand, collapse or go up the tree
        if (rowGroupKey(event, target)) return true;
        // the features' start keys (Epic #146: Enter, F2 or a printable key on a cell that can
        // be edited edits it), before the interaction's Enter and F2, which stay a cell's
        if (startKey(event, target)) return true;
        // Enter or F2 on a cell itself hand the keys to its controls (a sortable header cell's
        // Enter sorted above, sorting installed: F2 enters it); a cell without controls lets the
        // key through
        if (
            (event.key === "Enter" || event.key === "F2") &&
            !ctrl &&
            !event.shiftKey &&
            isCellElement(target)
        ) {
            const position = cellOf(target);
            // a held Enter repeats: once the first entered, the rest would press the control
            if (event.repeat && interaction.cell) {
                event.preventDefault();
                return true;
            }
            if (position && interaction.enterCell(position, true)) {
                event.preventDefault();
                return true;
            }
        }
        if (rowMoveKey(event, target)) return true;
        // the features' later keys (Epic #144): a range's, the rows' selection's
        for (const featureKey of featureHandlers.laterKeydown) {
            if (featureKey(event, target)) return true;
        }
        // Escape with nothing else to end (a drag, an edit, controls, a range) gives focus up
        // (Epic #113): never prevented, so a dialog or a popover around the grid still closes
        if (event.key === "Escape" && !ctrl && !event.shiftKey) {
            releaseFocus(target);
            return true;
        }
        if (event.key === " " && !ctrl && rowsY.mapping.scaled) {
            // the browser would page the container natively, a far jump under scaling
            event.preventDefault();
            scrollTo({
                top: rowsY.virtual + (event.shiftKey ? -1 : 1) * bodyHeight(),
            });
            return true;
        }
        // the features' last keys (Epic #144): the navigation's arrows, Home, End and pages
        for (const featureKey of featureHandlers.lastKeydown) {
            if (featureKey(event, target)) return true;
        }
        return false;
    }

    // ── measured heights (Epic #86, E2.2) ────────────────────────────────────

    /**
     * the row of the last scroll to a cell, until a scroll the engine did not make (either axis):
     * scrolled to again when heights change, so the cell lands where its measured height puts it;
     * its row only, the columns left where they are
     */
    let cellScroll: Pick<
        EngineActionMap["scroll-to-cell"],
        "rowIndex" | "align"
    > | null = null;

    /**
     * Lays the rows out again for new heights (of the rows at `changed`): the view kept on the
     * first row it shows whose height stayed, as far from the view's top (M2): what a person saw
     * stays where a scroll put it, and the rows a scroll brought into view take the room they
     * need (none stayed: the first row it shows). The offset stays inside the rows. The row a
     * cell was just scrolled to is scrolled to again.
     */
    function remeasured(changed: readonly number[]) {
        const anchor = measureAnchor(changed);
        rowAxis = rowAxisFor();
        if (anchor) {
            rowsY.virtual = clamp(
                anchoredOffset(rowAxis, anchor),
                0,
                Math.max(0, rowAxis.totalSize - bodyHeight()),
            );
        }
        relayout(true);
        if (anchor) followRowAnchor();
        if (cellScroll) scrollToCell(cellScroll);
    }

    /** The row `remeasured` keeps the view on, and how far into it the view starts. */
    function measureAnchor(changed: readonly number[]): AxisAnchor | null {
        const first = anchorOf(rowAxis, rowsY.virtual);
        if (!first) return null;
        const resized = new Set(changed);
        for (let index = first.index; index < rowWindow.visible.end; index++) {
            if (!resized.has(index)) {
                return {
                    index,
                    within: rowsY.virtual - rowAxis.offsetOf(index),
                };
            }
        }
        return first;
    }

    // ── the model ────────────────────────────────────────────────────────────

    /**
     * Whether the view renders a row of the range: in the rendered rows, the active row, or the
     * row a drag is moving (E2.3, kept rendered as the active one).
     */
    function rendersRows(range: Range): boolean {
        const active = state.activePosition;
        return (
            overlaps(view.renderedRows, range.start, range.end) ||
            (active !== null &&
                overlaps(range, active.rowIndex, active.rowIndex + 1)) ||
            (rowReorder !== null &&
                overlaps(range, rowReorder.rowIndex, rowReorder.rowIndex + 1))
        );
    }

    /** The physical scroll follows a kept row anchor, even when the total did not change. */
    function followRowAnchor() {
        const top = rowsY.scrollTo(rowsY.virtual);
        if (Math.abs(top - (viewport?.scrollTop ?? 0)) > 0.5) {
            scrollWhenReady({ top });
        }
    }

    /**
     * The active cell's element positions before and after a change that only moved it (the same
     * cell at new indexes), else `null`: its column (a new order: the same row, the same column or
     * header cell by key), or its summary row (E2.1: the same position and index, its row index
     * following the header's depth and the rows', the same column by key).
     */
    function followedActive(
        before: DataGridModel<TRow, TNode>["state"],
        after: DataGridModel<TRow, TNode>["state"],
    ): { from: CellPosition; to: CellPosition } | null {
        const from = before.activePosition;
        const to = after.activePosition;
        if (!from || !to || from === to) return null;
        if (from.rowIndex !== to.rowIndex) {
            const was = summaryRowAt(before, from.rowIndex);
            const is = summaryRowAt(after, to.rowIndex);
            if (
                !was ||
                !is ||
                was.position !== is.position ||
                was.summaryIndex !== is.summaryIndex
            ) {
                return null;
            }
        } else if (after.header === before.header) {
            return null;
        }
        const key = cellKeyAt(before, from);
        return key !== undefined && key === cellKeyAt(after, to)
            ? {
                  from: elementPosition(from, before),
                  to: elementPosition(to, after),
              }
            : null;
    }

    const unsubscribeModel = model.subscribe(({ before, after }) => {
        state = after;
        // the features' own first (Epic #144: a range's presses and drag, a fill's source), so
        // the view the engine builds for the change shows theirs
        for (const changed of featureHandlers.changed) {
            changed(
                before as DataGridState<unknown, unknown>,
                after as DataGridState<unknown, unknown>,
            );
        }
        followModel(before, after);
        // and what ends with the change, the engine laid out (a feature's drag)
        for (const followed of featureHandlers.followed) {
            followed(
                before as DataGridState<unknown, unknown>,
                after as DataGridState<unknown, unknown>,
            );
        }
    });

    /** After a committed change of the model: the engine follows it (the features' before). */
    function followModel(
        before: DataGridState<TRow, TNode>,
        after: DataGridState<TRow, TNode>,
    ) {
        // the grids nested in its cells read which one holds them from the cells' indexes: told at
        // the commit that renders them, when the active cell, or what is at it, can have changed
        // (a sort, a move, rows inserted above: a new source; a new order; its row's data)
        if (
            nestedListeners.size > 0 &&
            (after.activePosition !== before.activePosition ||
                after.source !== before.source ||
                after.columns !== before.columns ||
                (after.rowsChanged !== before.rowsChanged &&
                    after.activePosition !== null &&
                    overlaps(
                        after.rowsChanged,
                        after.activePosition.rowIndex,
                        after.activePosition.rowIndex + 1,
                    )))
        ) {
            nestedStale = true;
        }
        if (before.direction !== after.direction) directionPending = true;
        // the app moved the rows a move told it of: the active cell follows its row (E2.3)
        followMovedRow(before, after);
        const changedDetails = detailsChanged(before, after);
        // measured heights follow their rows (E2.2)
        const remeasure = heights.forget(before, after);
        if (after.rowsChanged !== before.rowsChanged) {
            const rendered = rendersRows(after.rowsChanged);
            // rows' data changed, and nothing else did: off screen, there is nothing to do
            if (!rendered && !changedDetails && !remeasure) return;
            if (rendered) rowsRevision += 1;
        }
        const sameHeights =
            after.rowHeight === before.rowHeight &&
            after.estimatedRowHeight === before.estimatedRowHeight;
        const rowsResized = after.rowCount !== before.rowCount || !sameHeights;
        if (rowsResized) {
            baseRowAxis = sameHeights
                ? baseRowAxis.withCount(after.rowCount)
                : rowAxisOf(after);
        }
        // measuring starts or stops with "auto" (E2.2)
        const wasMeasuring = measuring(before);
        if (measuring(after) !== wasMeasuring) {
            if (wasMeasuring) heights.stop();
            else heights.observeRegistered();
        }
        // a row expanding or collapsing grows or shrinks its element: read it again
        if (changedDetails && after.rowHeight === "auto") {
            heights.rereadRows();
        }
        let anchored = false;
        if (rowsResized || changedDetails || remeasure) {
            const anchor = rowsResized
                ? null
                : anchorOf(rowAxis, rowsY.virtual);
            rowAxis = rowAxisFor();
            // a row expanding or collapsing above the view keeps the view where it is (M2)
            if (anchor) {
                rowsY.virtual = anchoredOffset(rowAxis, anchor);
                anchored = true;
            }
        }
        // a resize changes the columns' widths (a feature's, Epic #148): the same path as new
        // columns (W1)
        const resized = overridesOf(after) !== overridesOf(before);
        const columnsChanged = after.columns !== before.columns || resized;
        const engineWidths = autoWidths;
        // a width changing left of the view keeps the view on the column it shows first, right
        // of the pinned ones, as far into it as it was (as a row expanding above it, M2); a
        // collapse too, by its key (E1.3: a feature's say, `columnAnchored`)
        const anchor =
            after.columns === before.columns
                ? resized
                    ? columnAnchor()
                    : null
                : after.columnEntries === before.columnEntries &&
                    featureHandlers.columnAnchored.some((anchored) =>
                        anchored(
                            before as DataGridState<unknown, unknown>,
                            after as DataGridState<unknown, unknown>,
                        ),
                    )
                  ? collapseAnchor(before, after)
                  : null;
        // the toggles' column is found again in the new columns (Epic #87)
        if (after.columns !== before.columns) treeColumn = null;
        if (columnsChanged) {
            // the flex shares follow the columns, their order and the overrides (A1)
            updateAutoWidths();
            columnAxis = columnAxisOf(after, overridesOf(after), autoWidths);
            updatePinning();
            if (anchor) keepColumnAnchor(anchor);
        }
        // the features follow the new layout before the view is built for it (Epic #148: a
        // column's drag follows its column or group, W4, O3)
        if (columnsChanged || after.header !== before.header) {
            for (const columnsFollowed of featureHandlers.columnsFollowed) {
                columnsFollowed(
                    before as DataGridState<unknown, unknown>,
                    after as DataGridState<unknown, unknown>,
                );
            }
        }
        // the active cell's column moved (an order): the same cell at a new index, which is no
        // other cell made active: its interaction goes with it, nothing scrolls
        const followed = followedActive(before, after);
        if (followed) interaction.cellMoved(followed.from, followed.to);
        relayout(
            rowsResized ||
                changedDetails ||
                remeasure ||
                columnsChanged ||
                after.headerRowHeight !== before.headerRowHeight ||
                after.header !== before.header ||
                after.summaryRows !== before.summaryRows ||
                after.summaryRowHeight !== before.summaryRowHeight,
        );
        if (autoWidths !== engineWidths) {
            emit("column-auto-widths", autoWidths);
        }
        // a row's drag follows its row (E2.3), on the rows as laid out now
        if (drag?.kind === "row" && drag.dragged) followRowDrag(drag);
        // the physical scroll follows even when the total did not change (no remap moved it)
        if (anchored) followRowAnchor();
        if (anchor) followColumnAnchor();
        if (followed) {
            // focus goes to its element once the cells render in their new order (the commit)
            if (focusInside()) pendingFocus = true;
            return;
        }
        // another cell made active (the app, a middleware): the interaction ends, and an entry
        // waiting for another cell is dropped
        interaction.activeChanged(
            after.activePosition !== before.activePosition,
        );
        const active = after.activePosition;
        if (active && active !== before.activePosition) {
            if (focusInside()) pendingFocus = true;
            scrollToCell(scrollPayloadFor(active));
        }
    }

    // ── the adapter ──────────────────────────────────────────────────────────

    const adapter: EngineAdapter<TRow, TNode> = {
        attach(element) {
            if (viewport === element && detachViewport) return detachViewport;
            detachViewport?.();
            viewport = element;
            VIEWPORTS.add(element);
            // a host for the grids nested in it, asked again, and its own host (it may be nested
            // in a grid attached already)
            HOSTS.set(element, ownHost);
            NESTINGS.set(element, findHost);
            findHost();
            rehostWithin(element);
            const doc = element.ownerDocument;
            const defaultView = doc.defaultView;
            readSize();
            // the direction first: the scroll already set is read on its side (the adapter has
            // rendered the `dir` of a given one by now)
            directionPending = false;
            readPageDirection();
            updateDirection(false);
            const observer =
                defaultView && "ResizeObserver" in defaultView
                    ? new defaultView.ResizeObserver(() => {
                          const before = width;
                          readSize();
                          // the flex columns follow the view's width (A1), and only they
                          if (
                              width === before ||
                              !columnTraits(state.columns).flex ||
                              !relayoutColumns()
                          ) {
                              relayout(false);
                          }
                      })
                    : null;
            observer?.observe(element);
            // the controls the cells render, now and later (a commit, the app's own re-render):
            // kept out of the tab order outside interaction (only cells that changed are read)
            // (with navigation only, Epic #144: without it the grid has no tab stop of its own, and
            // its cells' controls are the page's own tab stops)
            const mutations =
                features.navigable &&
                defaultView &&
                "MutationObserver" in defaultView
                    ? new defaultView.MutationObserver(interaction.onMutations)
                    : null;
            mutations?.observe(element, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: [
                    "tabindex",
                    "href",
                    "disabled",
                    "contenteditable",
                    "hidden",
                    "inert",
                    TAB_STOP_ATTRIBUTE,
                    "data-row-index",
                    "data-column-index",
                ],
            });
            if (features.navigable) interaction.manageCellsUnder(element);
            // the rows and details measured (E2.2), from the next frame on
            heights.observeRegistered();
            // the features' listeners (Epic #144): a range's presses outside the grid, an edit
            // given to start with listening to the page's presses (Epic #146)
            const featureDetaches = featureHandlers.attach.map((attach) =>
                attach(element),
            );
            // the wheel's listener follows the scaling (`listenToWheel`)
            element.addEventListener("scroll", onScroll, { passive: true });
            element.addEventListener("focusin", onFocusIn);
            element.addEventListener("pointerdown", onPointerDown, {
                capture: true,
            });
            doc.addEventListener("pointerup", onPointerEnd, true);
            doc.addEventListener("pointercancel", onPointerEnd, true);
            element.addEventListener("focusout", onFocusOut);
            // the real mappings first, so a scroll already set (restored) is read, not reset
            rowsY.mapping = rowMapping();
            columnsX.mapping = columnMapping();
            syncScroll();
            // pinned cells may have registered while it was detached: write them all
            insetsFor = null;
            // the `autoSize` columns fit again once in this attach (A5); the flex columns take
            // the view's width
            autoSized.clear();
            autoSizedFor = null;
            if (!relayoutColumns()) relayout(true);
            writeLayers();
            // what was asked before the grid had a size: a scroll to a cell, or the active cell
            const active = state.activePosition;
            const initial =
                pendingCellScroll ?? (active ? scrollPayloadFor(active) : null);
            pendingCellScroll = null;
            if (initial) scrollToCell(initial);
            let attached = true;
            const detach = () => {
                if (!attached) return;
                attached = false;
                observer?.disconnect();
                mutations?.disconnect();
                element.removeEventListener("scroll", onScroll);
                element.removeEventListener("wheel", onWheel);
                element.removeEventListener("focusin", onFocusIn);
                element.removeEventListener("pointerdown", onPointerDown, {
                    capture: true,
                });
                doc.removeEventListener("pointerup", onPointerEnd, true);
                doc.removeEventListener("pointercancel", onPointerEnd, true);
                element.removeEventListener("focusout", onFocusOut);
                // a drag ends where it is (a reorder moves nothing), its frame cancelled
                endDrag("lost");
                // a move told is no longer followed (E2.3)
                movedRow = null;
                // the features' listeners go (a range's presses, a copy's held selection)
                for (const featureDetach of featureDetaches) featureDetach();
                heights.stop();
                pointerDown = false;
                pendingFocus = false;
                // nested no more: a grid on its own until it is attached again
                HOSTS.delete(element);
                NESTINGS.delete(element);
                unlistenHost?.();
                unlistenHost = null;
                host = null;
                if (!tabbable) {
                    tabbable = true;
                    viewStale = true;
                }
                if (viewport === element) {
                    // the committed view stays: a re-attach (StrictMode) shows the same layers
                    VIEWPORTS.delete(element);
                    viewport = null;
                    detachViewport = null;
                    wheelOn = false;
                }
                // the grids it hosted: hosted by the next grid out, or on their own
                rehostWithin(element);
                nestedListeners.clear();
            };
            detachViewport = detach;
            return detach;
        },
        registerLayer(layer, element) {
            layers[layer].add(element);
            // an empty state mounted (or gone): its row counts in ARIA, a new view
            if (layer === "empty") {
                viewStale = true;
                update();
                return () => {
                    layers.empty.delete(element);
                    viewStale = true;
                    update();
                };
            }
            // a measured row is only read (E2.2)
            if (layer === "row") {
                heights.observeLater(element);
                return () => {
                    layers.row.delete(element);
                    heights.unobserve(element);
                };
            }
            if (layer === "detail") heights.observeLater(element);
            written.delete(element);
            // only this element: a row of pinned cells mounting does not rewrite every other one
            if (!isInsetLayer(layer)) {
                // the next write is for every layer: this one may miss what the last one wrote
                layerX = Number.NaN;
                if (viewport && committed && layer !== "grid") {
                    write(
                        element,
                        layerTransform(
                            layer,
                            offsetX(committed, viewport),
                            offsetY(committed, viewport),
                        ),
                    );
                }
            } else if (viewport && committed) {
                writeInset(
                    layer,
                    element,
                    offsetX(committed, viewport),
                    inlineStart(direction),
                    committed,
                    endPartFrom(committed),
                    pinnedEndShift(committed.columnAxis, width),
                );
            } else {
                // nothing to write for yet (a detached viewport: a root re-mounting while its
                // cells stay): the next write is for every pinned cell
                insetsFor = null;
            }
            return () => {
                layers[layer].delete(element);
                written.delete(element);
                if (layer === "detail") heights.unobserve(element);
                // a cell no longer pinned keeps no inset of the engine's, on either side: its
                // adapter places it
                if (isInsetLayer(layer)) {
                    element.style.left = "";
                    element.style.right = "";
                }
            };
        },
        getView: () => view,
        subscribe(listener) {
            viewListeners.add(listener);
            return () => {
                viewListeners.delete(listener);
            };
        },
        commit(rendered) {
            committed = rendered;
            // a direction given or taken back, now that the adapter rendered its `dir` (or removed
            // it: the page's is read)
            if (directionPending) {
                directionPending = false;
                readPageDirection();
                if ((state.direction ?? pageDirection) !== direction) {
                    relayout(false);
                }
            }
            if (focusBeforeRender && state.activePosition) {
                const focused = viewport?.ownerDocument.activeElement;
                // the focused cell was removed by the render: focus fell to the document
                if (!focused || focused === viewport?.ownerDocument.body) {
                    pendingFocus = true;
                }
            }
            focusBeforeRender = false;
            const moves = pendingScroll;
            pendingScroll = {};
            const moved = moves.top !== undefined || moves.left !== undefined;
            if (moved) applyScroll(moves);
            // the scroll as it is now: one the browser made before its event reached the engine
            // (a scroll and a click in one task) is read here, so the layers are written for it,
            // never against the scroll the engine last knew
            if (syncScroll() || moved) update();
            writeLayers();
            interaction.committed();
            // the grids nested in its cells, now that their indexes are rendered (E5.2)
            if (nestedStale) {
                nestedStale = false;
                for (const listener of [...nestedListeners]) listener();
            }
            flushFocus();
            // the features' (Epic #146: an edit's editor, rendered now, takes focus)
            for (const featureRendered of featureHandlers.rendered) {
                featureRendered(rendered as GridView<unknown, unknown>);
            }
            autoSize(rendered);
            // the rows and details rendered for the first time, read before the browser paints;
            // not while a new view waits (widths an automatic width changed): its commit reads
            if (view === committed) heights.take();
        },
        keydown,
        click,
        pointerdown,
        copy: (event) => {
            for (const featureCopy of featureHandlers.copy) {
                if (featureCopy(event)) return true;
            }
            return false;
        },
        paste: (event) => {
            for (const featurePaste of featureHandlers.paste) {
                if (featurePaste(event)) return true;
            }
            return false;
        },
        setOptions(next) {
            const changed =
                next.maxScrollSize !== options.maxScrollSize ||
                next.overscan?.rows !== options.overscan?.rows ||
                next.overscan?.columns !== options.overscan?.columns ||
                next.endReachedThreshold !== options.endReachedThreshold ||
                next.reorderableRows !== options.reorderableRows ||
                next.fillable !== options.fillable;
            options = next;
            // rows that stop moving end a row's drag, moving nothing (cells that stop filling, a
            // fill's: the fill handle's own)
            if (!next.reorderableRows && drag?.kind === "row") endDrag("lost");
            for (const optionsChanged of featureHandlers.optionsChanged) {
                optionsChanged(next);
            }
            if (changed) relayout(true);
            updateTabStop();
        },
    };

    const queries: {
        [K in Exclude<
            EngineQueryKey,
            FeatureQueryKey
        >]: () => EngineQueryMap[K];
    } = {
        "row-window": () => rowWindow,
        "column-window": () => columnWindow,
        "scroll-position": () => ({
            top: rowsY.virtual,
            left: columnsX.virtual,
        }),
        "viewport-size": () => ({ width, height, bodyHeight: bodyHeight() }),
        "scroll-scaled": () => ({
            rows: rowsY.mapping.scaled,
            columns: columnsX.mapping.scaled,
        }),
        interaction: () => interaction.cell,
        "row-reorder": () => rowReorder,
        "column-auto-widths": () => autoWidths,
    };
    /** the features' `get` keys (Epic #144: a fill's), after the engine's own */
    const allQueries: Readonly<Record<string, () => unknown>> = {
        ...featureHandlers.queries,
        ...queries,
    };

    const actions: {
        [K in Exclude<EngineActionKey, FeatureActionKey>]: (
            payload: EngineActionMap[K],
        ) => void;
    } = {
        "scroll-to-cell": scrollToCell,
        "scroll-to": scrollTo,
        "interact-cell": interaction.interact,
        "leave-cell": () => {
            interaction.cancelPending();
            interaction.leaveCell(true);
        },
    };

    return {
        get(key) {
            // a feature's key not installed (`fill` without the fill handle) reads `undefined`
            return allQueries[key]?.() as never;
        },
        run(action, payload) {
            // a feature's action not installed (`edit-cell` without editing) does nothing
            const handler = (
                Object.hasOwn(actions, action)
                    ? actions[action as keyof typeof actions]
                    : featureHandlers.actions[action]
            ) as ((payload: unknown) => void) | undefined;
            handler?.(payload);
        },
        subscribe(event, listener) {
            let listeners = eventListeners.get(event);
            if (!listeners) {
                listeners = new Set();
                eventListeners.set(event, listeners);
            }
            const added = listener as (value: unknown) => void;
            listeners.add(added);
            return () => {
                listeners.delete(added);
            };
        },
        destroy() {
            unsubscribeModel();
            for (const destroy of featureHandlers.destroy) destroy();
            detachViewport?.();
        },
        adapter,
    };
}
