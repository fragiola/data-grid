import type { Axis } from "../axis/axis";
import {
    columnPart,
    headerRowCount,
    isHeaderRow,
    pinnedEndFrom,
    pinnedPartsOf,
} from "../header/header";
import { shownColumnOf } from "../model/collapse";
import { detailsChanged, newRowsOf } from "../model/expansion";
import type { DataGridModel } from "../model/model";
import {
    cellKeyAt,
    hasReorderable,
    isReorderable,
    landingIndex,
    type Siblings,
    siblingsOf,
} from "../model/order";
import {
    groupExpanded,
    groupKeyAt,
    loadedRowKey,
    rowKeyAt,
    rowLoaded,
    rowMetaAt,
} from "../model/source";
import { hasColumnSpans, spanAt } from "../model/spans";
import { summaryRowAt } from "../model/summary";
import type {
    CellPosition,
    Column,
    ColumnWidths,
    GridDirection,
    HeaderCellLayout,
    HeaderLayout,
    ReorderSide,
    RowKey,
} from "../model/types";
import {
    autoWidthsOf,
    columnTraits,
    hasEngineSized,
    hasResizable,
    isFlex,
    isResizable,
    NO_WIDTHS,
    resizeMaximum,
    type SpanWidths,
    sameWidths,
    spanResizable,
    spanWidths,
    unresizedWidth,
    withinLimits,
    withoutWidths,
} from "../model/widths";
import { sameCell } from "../navigation/navigation";
import {
    clamp,
    indexAfterMove,
    isIndex,
    keptIfSame,
    lowerBound,
} from "../utils";
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
    CLICK_SLOP,
    COLUMN_RESIZER_ATTRIBUTE,
    CTRL_KEYS,
    cellSelector,
    GROUP_LABEL_ATTRIBUTE,
    GROUP_TOGGLE_ATTRIBUTE,
    inlineKey,
    isCellNode,
    isControl,
    isEditable,
    isElement,
    isPagelessControl,
    isResizer,
    KEYS,
    LINE_HEIGHT,
    layoutScale,
    maxContentWidths,
    movesWithArrows,
    ownerViewport,
    PAGE_KEYS,
    ROW_DRAG_HANDLE_ATTRIBUTE,
    TAB_STOP_ATTRIBUTE,
    VIEWPORTS,
} from "./dom";
import {
    cellSpan,
    cellsSizeOf,
    columnPinning,
    endPartFrom,
    inlineSign,
    inlineStart,
    pinnedEndShift,
    pinnedInset,
    resizeEdge,
    summaryHeight,
} from "./geometry";
import { createInteraction } from "./interaction";
import { type HeightObserver, type Measure, MeasuredHeights } from "./measure";
import { rowsMove } from "./parts";
import type {
    ColumnReorder,
    ColumnResize,
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

/**
 * A drag the engine follows with the pointer: where it started, and where the pointer is. A
 * column's drags follow its x, a row's its y.
 */
interface PointerDrag {
    /** it moved past a click's slop (a resizer's at once): Escape and its click are its */
    dragged: boolean;
    readonly pointerId: number;
    readonly startX: number;
    readonly startY: number;
    /** what holds the pointer: the resizer, the dragged header cell, or the row's handle */
    readonly element: Element;
    readonly doc: Document;
    /** the pointer's last place */
    x: number;
    y: number;
    /** the animation frame the next step waits for, if any */
    frame: number | null;
}

/** A drag on a column resizer (W4). */
interface ResizeDrag extends PointerDrag {
    readonly kind: "resize";
    /** the column's or the group's key */
    readonly columnKey: string;
    /** the column's (or the group's) width when it started */
    readonly startWidth: number;
    /** which way it grows on screen (`resizeSign`) */
    readonly sign: number;
    /** the engine's widths when it started: its columns resized back to them need none of theirs */
    readonly autoWidths: ColumnWidths;
    /** the x the last resize was for */
    appliedX: number;
}

/**
 * A drag of a reorderable header cell (Epic #75, O3): a press that drags once it moves past a
 * click's slop (until then, it may be a click), and its siblings, found again when the header
 * changes.
 */
interface ReorderDrag<TRow, TNode> extends PointerDrag {
    readonly kind: "reorder";
    /** the column's or the group's key */
    readonly columnKey: string;
    /** the header its siblings were found in, and them */
    header: HeaderLayout<TRow, TNode> | null;
    siblings: Siblings<TRow, TNode> | null;
}

/**
 * A drag of a row by its handle (Epic #86, E2.3): a press that drags once it moves past a click's
 * slop, the row followed by its key.
 */
interface RowDrag extends PointerDrag {
    readonly kind: "row";
    readonly rowIndex: number;
    readonly rowKey: RowKey;
    /**
     * the pointer's y in the view, as last read (a layout read: at the drag's start, once a frame
     * and on the release, never during a model change)
     */
    viewY: number;
}

type Drag<TRow, TNode> = ResizeDrag | ReorderDrag<TRow, TNode> | RowDrag;

/**
 * How a drag ends: a release, a cancel (Escape, `pointercancel`) or a loss (the capture lost, a
 * move with no button, the viewport detached). A resize keeps its width but on a cancel; a
 * reorder (a column's, a row's) moves only on a release.
 */
type DragEnd = "release" | "cancel" | "lost";

/**
 * How near the view's edges a header cell's drag scrolls the columns (O3), and a row's the rows
 * (E2.3), in pixels.
 */
const EDGE_ZONE = 40;
/** The edge scroll's pixels per frame at the edge or past it; fewer farther from it. */
const EDGE_STEP = 20;

/** The keys a focused resizer resizes with (W6). */
const RESIZE_KEYS: ReadonlySet<string> = new Set([
    "ArrowLeft",
    "ArrowRight",
    "Home",
    "End",
]);

/** The resizer keys' steps in pixels (W6): an arrow, and Shift with it. */
const RESIZE_STEP = 10;
const RESIZE_SHIFT_STEP = 50;

/** No overscan option: the defaults (one object, not one per update). */
const NO_OVERSCAN: NonNullable<DataGridEngineOptions["overscan"]> = {};

/** Creates the engine of one grid on screen. */
export function createDataGridEngine<TRow, TNode = unknown>(
    model: DataGridModel<TRow, TNode>,
    initialOptions: DataGridEngineOptions = {},
): DataGridEngine<TRow, TNode> {
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
    };
    /** the layers that hold rows: a key on one is the grid's (a detail's are its content's) */
    const rowLayers: readonly ReadonlySet<Element>[] = [
        layers.grid,
        layers.header,
        layers.body,
    ];
    let detachViewport: (() => void) | null = null;

    let state = model.state;
    /** the direction in effect: the model's, else the viewport's (`updateDirection`) */
    let direction: GridDirection = state.direction ?? "ltr";
    /** the heights measured of rows and of details (`"auto"`, Epic #86, E2.2) */
    const measuredRows = new MeasuredHeights();
    const measuredDetails = new MeasuredHeights();
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
    let columnAxis = columnAxisOf(state, autoWidths);
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
    /**
     * the column a drag is resizing (Epic #70), the one a drag is moving (Epic #75), the row a
     * drag is moving (Epic #86, E2.3), the drag
     */
    let columnResize: ColumnResize | null = null;
    let columnReorder: ColumnReorder | null = null;
    let rowReorder: RowReorder | null = null;
    let drag: Drag<TRow, TNode> | null = null;
    /** the last press the grid took (its drag, over or not): once it dragged, its click is its */
    let lastPress: Drag<TRow, TNode> | null = null;
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
    const eventListeners: {
        [K in EngineEventKey]: Set<(value: EngineEventMap[K]) => void>;
    } = {
        "row-window": new Set(),
        "column-window": new Set(),
        "rows-end-reached": new Set(),
        interaction: new Set(),
        "column-resize": new Set(),
        "column-reorder": new Set(),
        "row-reorder": new Set(),
        "row-move": new Set(),
        "column-auto-widths": new Set(),
    };

    function emit<K extends EngineEventKey>(
        event: K,
        value: EngineEventMap[K],
    ) {
        for (const listener of [...eventListeners[event]]) listener(value);
    }

    /** Whether `a` is the cell `b` (a header cell spanning rows is the same on each of them). */
    function same(a: CellPosition | null, b: CellPosition): boolean {
        return a !== null && sameCell(a, b, state.header.cellAt);
    }

    /** Makes a cell active, unless it is already. */
    function activate(position: CellPosition) {
        if (!same(state.activePosition, position)) {
            model.run("active-position.set", position);
        }
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
            columnResize,
            columnReorder,
            reorderableRows: options.reorderableRows === true,
            rowReorder,
            direction,
            headerRowsFor,
        });
    }

    /**
     * The rows' axis for the state: their own heights, measured ones over the estimate (E2.2),
     * then the expanded rows' details (M2).
     */
    function rowAxisFor(): Axis {
        return withDetails(
            state.rowHeight === "auto"
                ? measuredRows.axis(state.rowCount, state.estimatedRowHeight)
                : baseRowAxis,
            state,
            measuredDetails,
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
     * the view listeners what changed; writes the layers' offsets.
     */
    function update(fresh = false) {
        const overscan = options.overscan ?? NO_OVERSCAN;
        const nextRows = windowFor(
            rowAxis,
            rowsY.virtual,
            bodyHeight(),
            overscan.rows ?? 4,
            fresh ? undefined : rowWindow,
        );
        // the columns that scroll, in the view between the pinned ones
        const nextColumns = scrollingWindow(
            windowFor(
                columnAxis,
                columnsX.virtual + pinnedWidth,
                width - pinnedWidth - pinnedEndWidth,
                overscan.columns ?? 2,
                fresh ? undefined : columnWindow,
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
                cell &&
                !columnPinning(shown, cell.columnIndex, cell.columnSpan).pinned
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

    /**
     * The pinned columns in effect: the leading ones pinned at the start and the trailing ones
     * pinned at the end, while together they leave part of the view to scroll. As wide as the view
     * or wider (a narrow screen), they would hide every other column: they scroll with the rest
     * until the view is wider again.
     */
    /** The first column pinned at the end in effect (`pinnedEndFrom`): the count without one. */
    function endFrom(): number {
        return pinnedEndFrom(columnAxis.count, pinnedEndCount);
    }

    function updatePinning() {
        const { startCount, endFrom: declaredEndFrom } = pinnedPartsOf(
            state.columns,
        );
        const pinned = columnAxis.offsetOf(startCount);
        const pinnedEnd =
            columnAxis.totalSize - columnAxis.offsetOf(declaredEndFrom);
        const fits = width === 0 || pinned + pinnedEnd < width;
        pinnedCount = fits ? startCount : 0;
        pinnedWidth = fits ? pinned : 0;
        pinnedEndCount = fits ? columnAxis.count - declaredEndFrom : 0;
        pinnedEndWidth = fits ? pinnedEnd : 0;
    }

    /**
     * The engine's widths for the state and the view's width (A1, A5): computed only while a
     * column flexes or fits itself. Returns whether they changed.
     */
    function updateAutoWidths(): boolean {
        const next = hasEngineSized(state.columns)
            ? autoWidthsOf(state.columns, state.columnWidths, automatic, width)
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
    ): { index: number; within: number } | null {
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
    function keepColumnAnchor(anchor: { index: number; within: number }) {
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
        columnAxis = columnAxisOf(state, autoWidths);
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
        update(fresh);
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
        if (drag && drag.kind !== "resize" && drag.dragged) askFrame(drag);
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
        const yScaled = rowsY.mapping.scaled;
        const xScaled = columnsX.mapping.scaled;
        // a wheel over a grid nested in a cell is that grid's (or the browser's, which chains it)
        if (
            (!yScaled && !xScaled) ||
            !viewport ||
            event.ctrlKey ||
            event.defaultPrevented ||
            !inViewport(event.target)
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
        event.preventDefault();
        // a person's scroll: the cell it scrolled to is left (E2.2)
        cellScroll = null;
        if (dy !== 0) {
            if (yScaled) viewport.scrollTop = rowsY.scrollBy(dy);
            else viewport.scrollTop += dy;
        }
        if (dx !== 0) {
            if (xScaled) {
                const sign = inlineSign(direction);
                viewport.scrollLeft = sign * columnsX.scrollBy(sign * dx);
            } else {
                viewport.scrollLeft += dx;
            }
        }
        // the scroll event follows (or not, for a sub-pixel move): update now either way
        syncScroll();
        update();
        retargetAfterScroll();
    }

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
            if (target !== rowsY.virtual) moves.top = rowsY.scrollTo(target);
        }
        if (
            columnIndex !== undefined &&
            columnPart(columnIndex, pinnedCount, endFrom()) === undefined
        ) {
            // into the view between the pinned columns; a pinned one is always in view
            const from = columnsX.virtual + pinnedWidth;
            const start = columnAxis.offsetOf(columnIndex);
            const target = scrollTargetForSpan(
                start,
                start + columnAxis.sizeOf(columnIndex),
                from,
                width - pinnedWidth - pinnedEndWidth,
                columnAxis.totalSize - pinnedEndWidth,
                align,
            );
            // compared where it was computed: a column in view moves nothing, exactly
            if (target !== from) {
                moves.left = columnsX.scrollTo(target - pinnedWidth);
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

    /** Makes the first cell in view active, to focus it; refused (or none), nothing to focus. */
    function focusFirstVisibleCell() {
        const first = firstVisibleCell();
        // refused: a middleware, a controlled parent
        if (!first || !model.run("active-position.set", first).ok) {
            pendingFocus = false;
        }
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
        return (
            target === viewport ||
            rowLayers.some((elements) => elements.has(target)) ||
            cellOf(target) !== null
        );
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

    // ── drags: a resizer's, a header cell's, a row's; resizing's keys (Epics #70, #75, #86) ─

    /**
     * This grid's element marked with `attribute` an event happened in, and the mark's value (a
     * nested grid's is that grid's): a column resizer, a row's drag handle.
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

    /** This grid's column resizer an event happened in. */
    function resizerOf(
        target: EventTarget | null,
    ): { element: HTMLElement; columnKey: string } | null {
        const marked = markedOf(target, COLUMN_RESIZER_ATTRIBUTE);
        return marked && { element: marked.element, columnKey: marked.value };
    }

    /** A column's or a group's width and limits, or `null` when none of its columns resizes. */
    function resizeSpan(columnKey: string): SpanWidths | null {
        const cell = state.header.cellByKey(columnKey);
        return cell && spanResizable(state.columns, cell)
            ? spanWidths(state.columns, columnAxis, cell)
            : null;
    }

    /** A drag's state changed: a new view, and its event. */
    function publish<
        K extends "column-resize" | "column-reorder" | "row-reorder",
    >(event: K, value: EngineEventMap[K]) {
        viewStale = true;
        update();
        emit(event, value);
    }

    function setColumnResize(next: ColumnResize | null) {
        columnResize = next;
        publish("column-resize", next);
    }

    function setColumnReorder(next: ColumnReorder | null) {
        columnReorder = next;
        publish("column-reorder", next);
    }

    function setRowReorder(next: RowReorder | null) {
        rowReorder = next;
        publish("row-reorder", next);
    }

    /**
     * A press in the grid, after the consumer's own handlers (`preventDefault` cancels it): a
     * primary press on a resizer starts a drag (W4), one on a reorderable header cell or on a
     * row's drag handle may become one (O3, E2.3). With no resizable or reorderable column, and
     * rows that do not move, there is none.
     */
    function pointerdown(event: PointerEvent): boolean {
        if (event.defaultPrevented || event.button !== 0 || drag || !viewport) {
            return false;
        }
        const doc = viewport.ownerDocument;
        if (hasResizable(state.columns)) {
            const resizer = resizerOf(event.target);
            const span = resizer && resizeSpan(resizer.columnKey);
            if (resizer && span) {
                const { columnKey, element } = resizer;
                // a press on a resizer is a drag: no focus (which would activate its header cell
                // and scroll it into view, away from the pointer), no text selection
                event.preventDefault();
                drag = {
                    kind: "resize",
                    columnKey,
                    dragged: true,
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    startWidth: span.width,
                    sign: resizeSign(columnKey),
                    autoWidths: resizeFrom(columnKey),
                    element,
                    doc,
                    x: event.clientX,
                    y: event.clientY,
                    appliedX: event.clientX,
                    frame: null,
                };
                lastPress = drag;
                listen(drag);
                capture(drag);
                setColumnResize({ columnKey, width: span.width });
                return true;
            }
        }
        // a header cell's or a handle's press is not prevented: under the slop it is a click
        // (focus, a sort)
        const press = {
            dragged: false,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            doc,
            x: event.clientX,
            y: event.clientY,
            frame: null,
        };
        const handle = options.reorderableRows
            ? markedOf(event.target, ROW_DRAG_HANDLE_ATTRIBUTE)
            : null;
        if (handle) {
            // a row that cannot move (sorted, not loaded): a plain press
            const rowIndex = Number(handle.value);
            const rowKey = loadedRowKey(state, rowIndex);
            if (
                rowKey === undefined ||
                !rowsMove(options.reorderableRows, state)
            )
                return false;
            drag = {
                ...press,
                kind: "row",
                rowIndex,
                rowKey,
                element: handle.element,
                viewY: 0,
            };
        } else {
            const header =
                hasReorderable(state.columnEntries) && inViewport(event.target)
                    ? headerCellOf(event.target)
                    : null;
            if (!header || !isReorderable(header.cell)) return false;
            drag = {
                ...press,
                kind: "reorder",
                columnKey: header.cell.key,
                element: header.element,
                header: null,
                siblings: null,
            };
        }
        lastPress = drag;
        listen(drag);
        return true;
    }

    /**
     * Follows a press's pointer and keys wherever they go, and keeps the page's own drags (a text
     * selection, a native drag of an image or a link) out of it.
     */
    function listen(current: Drag<TRow, TNode>) {
        const { doc } = current;
        doc.addEventListener("pointermove", onDragMove, true);
        // a press the grid never heard released: the next one ends it
        doc.addEventListener("pointerdown", onNextPress, true);
        // Escape ends it wherever focus is (the page, outside the grid), after the app's own
        // handlers: the grid's `keydown` takes it first when focus is in the grid
        doc.addEventListener("keydown", onDragKey);
        doc.addEventListener("selectstart", preventDefault, true);
        doc.addEventListener("dragstart", preventDefault, true);
        doc.defaultView?.addEventListener("blur", onWindowBlur);
    }

    /** The moves come to the drag's element wherever the pointer goes. */
    function capture(current: Drag<TRow, TNode>) {
        current.element.addEventListener("lostpointercapture", onLostCapture);
        try {
            current.element.setPointerCapture(current.pointerId);
        } catch {
            // no pointer to capture (a press the page made up, a DOM without capture): the
            // document still hears the moves and the release
        }
    }

    /** Whether a drag is on: a resize, or a header cell's past the slop (Escape is its). */
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
            // past a click's slop, the press drags its header cell or its row
            if (
                Math.hypot(
                    event.clientX - drag.startX,
                    event.clientY - drag.startY,
                ) > CLICK_SLOP
            ) {
                drag.x = event.clientX;
                drag.y = event.clientY;
                if (drag.kind === "row") startRowDrag(drag);
                else if (drag.kind === "reorder") startReorder(drag);
            }
            return;
        }
        // a column's drags follow the pointer's x, a row's its y
        if (
            drag.kind === "row"
                ? event.clientY === drag.y
                : event.clientX === drag.x
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
    function askFrame(current: Drag<TRow, TNode>): boolean {
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

    /** A drag's step to its pointer: a resize, or a reorder's target (a column's, a row's). */
    function dragTo(current: Drag<TRow, TNode>) {
        if (current.kind === "resize") resizeTo(current);
        else reorderStep(current);
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

    /**
     * Which way a column (or a group) grows on screen, 1 to the right, -1 to the left: toward the
     * end, from its end edge, or for one pinned at the end toward the start, from its start edge
     * (the boundary with the columns that scroll: `columnResizerPart`'s `edge`); mirrored right to
     * left.
     */
    function resizeSign(columnKey: string): number {
        const cell = state.header.cellByKey(columnKey);
        const edge = resizeEdge(
            cell && columnPart(cell.columnIndex, pinnedCount, endFrom()),
        );
        return edge === "start"
            ? -inlineSign(direction)
            : inlineSign(direction);
    }

    /** Resizes a drag's column to its pointer, growing the way `resizeSign` says. */
    function resizeTo(resize: ResizeDrag) {
        resize.appliedX = resize.x;
        // from the engine's widths when it started: dragged back, a column needs no width (A2)
        model.run("column-widths.resize", {
            columnKey: resize.columnKey,
            width: resize.startWidth + resize.sign * (resize.x - resize.startX),
            autoWidths: resize.autoWidths,
        });
    }

    /** Stops listening to the drag, its frame cancelled; returns it. */
    function stopDrag(): Drag<TRow, TNode> | null {
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
        doc.defaultView?.removeEventListener("blur", onWindowBlur);
        ended.element.removeEventListener("lostpointercapture", onLostCapture);
        drag = null;
        return ended;
    }

    /**
     * Ends the drag. A resize ends at the pointer's last place (a move not resized yet resizes
     * now), or on a cancel back to the width it started from: a resize like the drag's own, only
     * its columns change (the others' widths stay as they are now), and what lets the drag
     * resize lets it restore. A header cell's drag moves its column or group on a release only,
     * once, and not when it would land where it is; a row's tells the move the same way.
     */
    function endDrag(how: DragEnd) {
        const ended = stopDrag();
        if (ended?.kind === "resize") {
            if (how === "cancel") ended.x = ended.startX;
            if (ended.x !== ended.appliedX) resizeTo(ended);
            setColumnResize(null);
        } else if (ended?.kind === "reorder" && ended.dragged) {
            const target =
                how === "release"
                    ? reorderTarget(ended, viewXOf(ended.x))
                    : null;
            setColumnReorder(null);
            if (target && target.targetKey !== null) {
                model.run("column-order.move", {
                    columnKey: ended.columnKey,
                    targetKey: target.targetKey,
                    side: target.side,
                });
            }
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

    /**
     * After the widths or the columns changed during a drag: it follows its column or group (a
     * resize reports the width on screen, a header cell's drag its target), and ends when that
     * is gone or can no longer be resized or moved (a row's: `followRowDrag`). The state is set,
     * not published: the model's change publishes it.
     */
    function followDrag(current: ResizeDrag | ReorderDrag<TRow, TNode>) {
        if (current.kind === "resize") {
            const span = resizeSpan(current.columnKey);
            if (span) {
                if (columnResize?.width !== span.width) {
                    columnResize = {
                        columnKey: current.columnKey,
                        width: span.width,
                    };
                }
                return;
            }
        } else {
            const siblings = siblingsFor(current);
            if (siblings && isReorderable(siblings.cell)) {
                columnReorder = reorderTarget(current, viewXOf(current.x));
                return;
            }
        }
        stopDrag();
        columnResize = null;
        columnReorder = null;
    }

    /**
     * A key on a focused resizer (W6): its arrows (Shift: farther), Home and End resize its
     * column, through the column's limits; Enter fits it to its content (A4), once per press; the
     * other page keys and Space are no use to it (the container would page itself). Returns
     * whether the key was the resizer's.
     */
    function resizerKey(event: KeyboardEvent, target: Element): boolean {
        const key = event.key;
        const enter =
            key === "Enter" &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.shiftKey;
        if (!enter && !PAGE_KEYS.has(key) && key !== " ") return false;
        const resizer = resizerOf(target);
        if (!resizer) return false;
        event.preventDefault();
        if (enter) {
            if (!event.repeat) fitColumns([resizer.columnKey]);
            return true;
        }
        const span =
            RESIZE_KEYS.has(key) && !event.ctrlKey && !event.metaKey
                ? resizeSpan(resizer.columnKey)
                : null;
        if (!span) return true;
        const step = event.shiftKey ? RESIZE_SHIFT_STEP : RESIZE_STEP;
        // End: the maximum it reports (`aria-valuemax`), the view's width without one
        const viewWidth = width;
        // an arrow moves the handle its way: wider where the column grows that way (`resizeSign`)
        const to =
            key === "ArrowLeft" || key === "ArrowRight"
                ? span.width +
                  (key === "ArrowRight" ? step : -step) *
                      resizeSign(resizer.columnKey)
                : key === "Home"
                  ? span.minWidth
                  : resizeMaximum(span, viewWidth);
        model.run("column-widths.resize", {
            columnKey: resizer.columnKey,
            width: to,
        });
        return true;
    }

    // ── fitting columns to their content (Epic #80) ──────────────────────────

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
     * The engine's widths a resize or a fit of `columns` starts from (A2): the ones in effect,
     * and for each of them with an override the engine would size otherwise (a flex share, an
     * automatic width), the width it has without that override: back to it, it needs none, by a
     * drag, a key or a fit alike.
     */
    function unresizedWidthsOf(
        columns: readonly Column<TRow, TNode>[],
    ): ColumnWidths {
        if (!hasEngineSized(state.columns)) return NO_WIDTHS;
        let record: Record<string, number> | null = null;
        for (const column of columns) {
            const { key } = column;
            if (
                !isResizable(column) ||
                !Object.hasOwn(state.columnWidths, key) ||
                !(isFlex(column) || column.autoSize === true)
            ) {
                continue;
            }
            const own = autoWidthsOf(
                state.columns,
                withoutWidths(state.columnWidths, [key]),
                automatic,
                width,
            )[key];
            if (own !== undefined) {
                record ??= { ...autoWidths };
                record[key] = own;
            }
        }
        return record ?? autoWidths;
    }

    /** What a resize of a column or a group starts from (`unresizedWidthsOf` its columns). */
    function resizeFrom(columnKey: string): ColumnWidths {
        const cell = state.header.cellByKey(columnKey);
        return cell
            ? unresizedWidthsOf(
                  state.columns.slice(
                      cell.columnIndex,
                      cell.columnIndex + cell.columnSpan,
                  ),
              )
            : autoWidths;
    }

    /**
     * Fits columns to their content (A3, A4): each resizable column of each key (a column, or a
     * group's), or every rendered one without keys, measured on the view on screen in one
     * layout. One `column-widths.set` with the other widths as they are, none when no width
     * changes. A column fitted to the width it has without an override (`unresizedWidth`: its
     * flex share or automatic width as they are without it, else its own) needs none.
     */
    function fitColumns(columnKeys?: readonly string[]) {
        const shown = committed;
        if (!viewport || !shown) return;
        const { columnDefs, header } = shown;
        const indexes = new Set<number>();
        const add = (columnIndex: number) => {
            const column = columnDefs[columnIndex];
            if (column && isResizable(column)) indexes.add(columnIndex);
        };
        if (columnKeys === undefined) {
            for (const columnIndex of shown.columns) add(columnIndex);
        } else {
            for (const key of columnKeys) {
                const cell = header.cellByKey(key);
                if (!cell) continue;
                const end = cell.columnIndex + cell.columnSpan;
                for (let index = cell.columnIndex; index < end; index++) {
                    add(index);
                }
            }
        }
        const fitted: [string, number][] = [];
        const keys: string[] = [];
        const measuredColumns = measureColumns(shown, indexes);
        const from = unresizedWidthsOf(
            [...measuredColumns.keys()].flatMap((columnIndex) => {
                const column = columnDefs[columnIndex];
                return column ? [column] : [];
            }),
        );
        for (const [columnIndex, measured] of measuredColumns) {
            const column = columnDefs[columnIndex];
            if (!column) continue;
            const width = fittedWidth(column, measured);
            keys.push(column.key);
            if (width !== unresizedWidth(column, from)) {
                fitted.push([column.key, width]);
            }
        }
        const columnWidths = {
            ...withoutWidths(state.columnWidths, keys),
            ...Object.fromEntries(fitted),
        };
        if (!sameWidths(columnWidths, state.columnWidths)) {
            model.run("column-widths.set", { columnWidths });
        }
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
            !shown.rows.some((rowIndex) => rowLoaded(shown.source, rowIndex))
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

    // ── column reordering: the drag, the edge scroll, the keys (Epic #75) ────

    /** A press moved past the slop: its header cell drags, holding the pointer. */
    function startReorder(current: ReorderDrag<TRow, TNode>) {
        current.dragged = true;
        capture(current);
        const target = reorderTarget(current, viewXOf(current.x));
        // the cell gone since the press (new columns): nothing to drag
        if (target) setColumnReorder(target);
        else stopDrag();
    }

    /** The drag's siblings, found again when the header changed. */
    function siblingsFor(
        current: ReorderDrag<TRow, TNode>,
    ): Siblings<TRow, TNode> | null {
        if (current.header !== state.header) {
            current.header = state.header;
            current.siblings = siblingsOf(
                state.columns,
                state.header,
                current.columnKey,
            );
        }
        return current.siblings;
    }

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

    /** Whether a drag's cell is pinned with the pinned columns in effect: always in view. */
    function inPinnedStrip(siblings: Siblings<TRow, TNode>): boolean {
        return siblings.pinned === "start"
            ? pinnedCount > 0
            : siblings.pinned === "end" && pinnedEndCount > 0;
    }

    /**
     * The virtual offset under a pointer at `x` in the view, kept over the part its siblings show
     * in: the strip pinned at the start, the one pinned at the end (at the view's end, or where the
     * columns end in a narrower grid), or the columns that scroll between them.
     */
    function offsetAt(siblings: Siblings<TRow, TNode>, x: number): number {
        if (!inPinnedStrip(siblings)) {
            return (
                columnsX.virtual + clamp(x, pinnedWidth, width - pinnedEndWidth)
            );
        }
        if (siblings.pinned === "start") return clamp(x, 0, pinnedWidth);
        const end = columnAxis.totalSize;
        const shown = Math.min(width, end) - pinnedEndWidth;
        return end - pinnedEndWidth + clamp(x - shown, 0, pinnedEndWidth);
    }

    /**
     * Where a drop would move a drag's column or group (O3), its pointer at `x` in the view: beside
     * the sibling under it, on the side of its middle, among the ones it may move among. The
     * pointer is kept over the part of the view they show in (the pinned strip, or the columns
     * that scroll), so the target is the nearest one in view: the edge scroll reaches further.
     * From the column axis, not the DOM: a sibling scrolled out of the rendered columns counts,
     * scaled or not. No target when it would land where it is; the current state while the same.
     */
    function reorderTarget(
        current: ReorderDrag<TRow, TNode>,
        x: number,
    ): ColumnReorder | null {
        const siblings = siblingsFor(current);
        if (!siblings) return null;
        const { cells, index, start, end } = siblings;
        const offset = offsetAt(siblings, x);
        const endOf = (cell: HeaderCellLayout<TRow, TNode>) =>
            columnAxis.offsetOf(cell.columnIndex + cell.columnSpan);
        // the first one ending past the pointer, else the last
        const at = Math.min(
            start +
                lowerBound(end - start, (i) => {
                    const cell = cells[start + i];
                    return cell !== undefined && endOf(cell) <= offset;
                }),
            end - 1,
        );
        const target = cells[at];
        if (!target) return null;
        const { columnKey } = current;
        return dropTargetOf<ColumnReorder>(
            columnReorder,
            offset,
            index,
            at,
            columnAxis.offsetOf(target.columnIndex),
            endOf(target),
            true,
            (side) =>
                side
                    ? { columnKey, targetKey: target.key, side }
                    : { columnKey, targetKey: null, side: null },
        );
    }

    /** A frame of a header cell's drag: the edge scroll, then the target. */
    /**
     * A frame of a header cell's or a row's drag, on its axis: the pointer's place in the view
     * read once (before the scroll writes; a row's kept as `viewY`), the edge scroll, then the
     * target; the pointer held near an edge keeps scrolling, a frame at a time.
     */
    function reorderStep(current: ReorderDrag<TRow, TNode> | RowDrag) {
        const row = current.kind === "row";
        const at = row ? viewYOf(current.y) : viewXOf(current.x);
        if (row) current.viewY = at;
        const step = row
            ? edgeStep(at, bodyTop(), bodyHeight())
            : columnEdgeStep(current, at);
        const scrolled = step !== 0 && edgeScrollBy(row, step);
        if (row) {
            const target = rowReorderTarget(current, at);
            if (target !== rowReorder) setRowReorder(target);
        } else {
            const target = reorderTarget(current, at);
            if (target && target !== columnReorder) setColumnReorder(target);
        }
        if (scrolled) askFrame(current);
    }

    /**
     * Where a drag would drop (O3, E2.3): beside the item at `at` (from `start` to `end` on its
     * axis), on the side of its middle `offset` is on, when that moves the dragged item at
     * `index` and `allowed`; else nowhere (`make(null)`). The current state while the same.
     */
    function dropTargetOf<T extends object>(
        current: T | null,
        offset: number,
        index: number,
        at: number,
        start: number,
        end: number,
        allowed: boolean,
        make: (side: ReorderSide | null) => T,
    ): T {
        const side = offset < (start + end) / 2 ? "before" : "after";
        return keptIfSame(
            current,
            make(
                allowed && landingIndex(index, at, side) !== index
                    ? side
                    : null,
            ),
        );
    }

    /**
     * The edge scroll's step (signed, 0 for none) for a pointer at `at` over a part of the view
     * `length` long from `start`: near its start or end edge (or past it), toward it, faster
     * nearer. The two zones never overlap: in a narrow part each is half of it.
     */
    function edgeStep(at: number, start: number, length: number): number {
        const zone = Math.min(EDGE_ZONE, length / 2);
        if (zone <= 0) return 0;
        const low = start + zone;
        const high = start + length - zone;
        const depth = at < low ? at - low : at > high ? at - high : 0;
        return (
            Math.sign(depth) *
            Math.ceil(EDGE_STEP * Math.min(1, Math.abs(depth) / zone))
        );
    }

    /**
     * Scrolls the rows (`vertical`) or the columns by an edge scroll's step, through the engine's
     * own scroll (scaled or not); returns whether they moved.
     */
    function edgeScrollBy(vertical: boolean, step: number): boolean {
        const axis = vertical ? rowsY : columnsX;
        const before = axis.virtual;
        scrollTo(vertical ? { top: before + step } : { left: before + step });
        return axis.virtual !== before;
    }

    /**
     * A header cell's drag's edge step (`edgeStep`) near the start or end edge of the columns
     * that scroll (or past it): far siblings come into reach. 0 for a pinned cell in effect
     * (always in view) and toward an edge its siblings already end inside.
     */
    function columnEdgeStep(
        current: ReorderDrag<TRow, TNode>,
        x: number,
    ): number {
        const siblings = siblingsFor(current);
        if (!siblings || inPinnedStrip(siblings)) return 0;
        const step = edgeStep(
            x,
            pinnedWidth,
            width - pinnedWidth - pinnedEndWidth,
        );
        if (step === 0) return 0;
        // nothing more comes into reach that way: the siblings end inside the view on that side
        const { cells, start, end } = siblings;
        const edge = step > 0 ? cells[end - 1] : cells[start];
        if (
            !edge ||
            (step > 0
                ? columnAxis.offsetOf(edge.columnIndex + edge.columnSpan) <=
                  columnsX.virtual + width - pinnedEndWidth
                : columnAxis.offsetOf(edge.columnIndex) >=
                  columnsX.virtual + pinnedWidth)
        ) {
            return 0;
        }
        return step;
    }

    /**
     * Ctrl/⌘+Shift+←/→ on a reorderable header cell in navigation (O6): one move among its
     * siblings, before the previous one or after the next, the active cell following its column.
     * Handled even when nothing moves (at an end, past the pinned ones, refused): the page never
     * gets them.
     */
    function reorderKey(event: KeyboardEvent, target: Element): boolean {
        const key = inlineKey(event.key, direction);
        const left = key === "ArrowLeft";
        if (
            (!left && key !== "ArrowRight") ||
            !event.shiftKey ||
            !(event.ctrlKey || event.metaKey) ||
            !isCellElement(target)
        ) {
            return false;
        }
        const cell = headerCellOf(target)?.cell;
        const siblings =
            cell && isReorderable(cell)
                ? siblingsOf(state.columns, state.header, cell.key)
                : null;
        if (!siblings) return false;
        event.preventDefault();
        const neighbour = siblings.cells[siblings.index + (left ? -1 : 1)];
        // focus follows once the cells render in their new order (the commit); the cell moved
        // by the keys is kept in view
        if (
            neighbour &&
            model.run("column-order.move", {
                columnKey: siblings.cell.key,
                targetKey: neighbour.key,
                side: left ? "before" : "after",
            }).ok &&
            state.activePosition
        ) {
            scrollToCell(scrollPayloadFor(state.activePosition));
        }
        return true;
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
        if (edgeStep(current.viewY, bodyTop(), bodyHeight()) !== 0) {
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
        const offset = rowsY.virtual + clamp(y - bodyTop(), 0, bodyHeight());
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
            !rowsMove(options.reorderableRows, state) ||
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
            model.run("active-position.set", {
                rowIndex,
                columnIndex: active.columnIndex,
            });
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
            rowsMove(options.reorderableRows, state)
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

    /**
     * The sortable column whose header cell an event happened in, or `null`: not a header cell
     * (`headerCellOf`), a group, or a column that is not sortable.
     */
    function sortableColumnOf(
        target: EventTarget | null,
    ): Column<TRow, TNode> | null {
        const column = headerCellOf(target)?.cell.column;
        return column?.sortable === true ? column : null;
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
        // the click ending a drag is the drag's, never a sort: a resizer's (a double click fits
        // its column to its content, A4) or a header cell's (O3)
        const last = lastPress;
        lastPress = null;
        if (last?.dragged && event.detail > 0) {
            if (last.kind === "resize" && event.detail === 2) {
                fitColumns([last.columnKey]);
            }
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
        if (event.altKey || event.shiftKey) return false;
        const column = sortableColumnOf(event.target);
        if (!column) return false;
        model.run("sort-columns.toggle", {
            columnKey: column.key,
            multi: event.ctrlKey || event.metaKey,
        });
        return true;
    }

    /** A release anywhere (or a pointer the browser took over for a scroll) ends the press. */
    function onPointerEnd(event: PointerEvent) {
        pointerDown = false;
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
    }

    function onFocusIn(event: FocusEvent) {
        const target = event.target;
        const cell = cellOf(target);
        if (cell) {
            if (rowsY.mapping.scaled || columnsX.mapping.scaled) {
                // the browser scrolled the focused cell into view itself (a Tab): under scaling its
                // scroll would map to a far jump, so the engine makes the move, exact, instead
                scrollToCell(scrollPayloadFor(cell));
            }
            // a header cell spanning rows is already active on any of its rows
            activate(cell);
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
        // a click on empty space focuses the container: that is no reason to activate a cell
        if (pointerDown) return;
        pendingFocus = true;
        if (state.activePosition) flushFocus();
        else focusFirstVisibleCell();
    }

    /**
     * The selection's keys on a body cell (R6), rows being selectable: Shift+Space toggles its
     * row, Shift+Up/Down (many rows) move and extend the selection to the row reached, Ctrl/⌘+A
     * selects every row. Each goes through a command, so a middleware can refuse it.
     */
    function selectionKey(event: KeyboardEvent, target: Element): boolean {
        const mode = state.rowSelection;
        const position = mode ? bodyCellOf(target) : null;
        if (!mode || !position) return false;
        const rowIndex = position.rowIndex;
        const ctrl = event.ctrlKey || event.metaKey;
        if (event.key === " " && event.shiftKey && !ctrl) {
            event.preventDefault();
            // a held key repeats: it would toggle the row on and off
            if (!event.repeat) model.run("selected-rows.toggle", { rowIndex });
            return true;
        }
        if (mode !== "multiple") return false;
        if (ctrl && !event.shiftKey && event.key.toLowerCase() === "a") {
            // handled even when refused: the page's text is never selected instead
            event.preventDefault();
            if (!event.repeat) model.run("selected-rows.select-all", {});
            return true;
        }
        if (
            !event.shiftKey ||
            ctrl ||
            (event.key !== "ArrowDown" && event.key !== "ArrowUp")
        ) {
            return false;
        }
        const down = event.key === "ArrowDown";
        // up into the header: a plain move
        if (!down && rowIndex === 0) return false;
        event.preventDefault();
        if (down && rowIndex === state.rowCount - 1) return true;
        const move = {
            direction: down ? "down" : "up",
            visibleColumns: columnWindow.visible,
        } as const;
        // a move refused selects nothing
        const asked = model.check("active-position.move", move);
        if (!asked.ok) return true;
        // Shift+arrows select: without an anchor that selects, the range starts from this row
        // (it included). One selection command a key: a controlled parent answers each
        if (!model.get("selection-anchor")?.selected) {
            model.run("selection-anchor.set", { rowIndex });
        }
        pendingFocus = true;
        model.run("active-position.move", move);
        // extended to the row the move reached (a middleware may have redirected it), or, when a
        // controlled parent answers the move later, to the row it was asked for
        const moved = state.activePosition?.rowIndex;
        const reached =
            moved !== undefined && moved !== rowIndex
                ? moved
                : asked.value.rowIndex;
        if (reached >= 0 && reached !== rowIndex) {
            model.run("selected-rows.toggle", {
                rowIndex: reached,
                extend: true,
            });
        }
        flushFocus();
        return true;
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
        // Enter on a group row only (a data row's Enter is its cell's: its controls, editing);
        // Space on any row that expands (a tree's parent too)
        if (
            (event.key === "Enter" && meta?.group) ||
            (event.key === " " &&
                groupKeyAt(state, rowIndex, meta) !== undefined)
        ) {
            event.preventDefault();
            // a held key repeats: it would open and close the group
            if (!event.repeat) model.run("row-groups.toggle", { rowIndex });
            return true;
        }
        const move = KEYS[inlineKey(event.key, direction)];
        // on the tree's column: the cell holding the row's toggle, else (a leaf, a row loading)
        // the column the grid's toggles are in, else the first
        if (
            (move !== "left" && move !== "right") ||
            !onTreeColumn(rowIndex, target, position.columnIndex)
        ) {
            return false;
        }
        const groupKey = groupKeyAt(state, rowIndex, meta);
        // → on a collapsed row group expands it, ← on an expanded one collapses it
        if (
            groupKey !== undefined &&
            groupExpanded(state, groupKey) === (move === "left")
        ) {
            event.preventDefault();
            model.run("row-groups.toggle", { rowIndex });
            return true;
        }
        const parentIndex = meta?.parentIndex;
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
        model.run("active-position.set", {
            rowIndex: parentIndex,
            columnIndex: position.columnIndex,
        });
        flushFocus();
        return true;
    }

    /**
     * Whether a cell is on its row's tree column (Epic #87): the cell holding the row's group
     * toggle; for a row rendering none (a leaf, a row loading), the column this grid's toggles are
     * in, else the first column.
     */
    function onTreeColumn(
        rowIndex: number,
        cell: Element,
        columnIndex: number,
    ): boolean {
        const own = toggleCellOf(`="${rowIndex}"`);
        if (own) return own === cell;
        const any = toggleCellOf("");
        const column = any ? positionOf(any)?.columnIndex : undefined;
        return columnIndex === (column ?? 0);
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

    function keydown(event: KeyboardEvent): boolean {
        const target = event.target;
        const ctrl = event.ctrlKey || event.metaKey;
        // a key typed into a field inside a cell is the field's, a key from outside the grid (a
        // menu portalled out of a cell, whose events still bubble through the cell) is not ours,
        // and neither is one from the app's content beside the cells (an empty state's action)
        if (
            event.defaultPrevented ||
            event.altKey ||
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
        // in interaction, the cell's controls have the keys: the grid takes Escape (back to the
        // cell) and Tab (the cell's next control, wrapping) only, from a field too
        if (
            interaction.cell &&
            !isCellElement(target) &&
            // the app's own tab stop and a composition in progress (an IME) keep their keys
            !target.hasAttribute(TAB_STOP_ATTRIBUTE) &&
            !event.isComposing
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
                // a column resizer's keys resize its column (W6)
                if (resizerKey(event, target)) return true;
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
        if ((event.key === "Enter" || event.key === " ") && !event.shiftKey) {
            // Enter or Space on a sortable column's header cell toggles its sort, once per press:
            // a key held down repeats, and would cycle through the sort
            const column = sortableColumnOf(target);
            if (column) {
                event.preventDefault();
                if (!event.repeat) {
                    model.run("sort-columns.toggle", {
                        columnKey: column.key,
                        multi: ctrl,
                    });
                }
                return true;
            }
        }
        // a row group's keys (Epic #87): Enter and Space toggle a group row (its controls get the
        // keys by F2), the arrows on a row's first column expand, collapse or go up the tree
        if (rowGroupKey(event, target)) return true;
        // Enter or F2 on a cell itself hand the keys to its controls (a sortable header cell's
        // Enter sorted above: F2 enters it); a cell without controls lets the key through
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
        if (reorderKey(event, target)) return true;
        if (rowMoveKey(event, target)) return true;
        if (selectionKey(event, target)) return true;
        if (event.key === " " && !ctrl && rowsY.mapping.scaled) {
            // the browser would page the container natively, a far jump under scaling
            event.preventDefault();
            scrollTo({
                top: rowsY.virtual + (event.shiftKey ? -1 : 1) * bodyHeight(),
            });
            return true;
        }
        const move =
            (ctrl ? CTRL_KEYS[event.key] : undefined) ??
            KEYS[inlineKey(event.key, direction)];
        if (!move) return false;
        event.preventDefault();
        pendingFocus = true;
        if (!state.activePosition) {
            focusFirstVisibleCell();
            return true;
        }
        const visible = rowWindow.visible.end - rowWindow.visible.start;
        model.run("active-position.move", {
            direction: move,
            pageSize: Math.max(1, visible - 1),
            visibleColumns: columnWindow.visible,
        });
        // the move may have been refused or landed where it was: focus stays where it is
        flushFocus();
        return true;
    }

    // ── measured heights (Epic #86, E2.2) ────────────────────────────────────

    /** each measured element's border-box height, as last read or told by its observer */
    let heights = new WeakMap<Element, number>();
    /** the observer of the measured rows and details (the viewport's window's), while attached */
    let measurer: HeightObserver | null = null;
    /**
     * the elements to observe from the next frame on: an observer's first report of an element
     * rendered while observers report (a resize laid out again) would come in that same frame at
     * the same depth, which a browser defers with an error. The engine reads it at its commit.
     */
    const unobserved = new Set<Element>();
    let observeFrame: number | null = null;
    /**
     * the row of the last scroll to a cell, until a scroll the engine did not make (either axis):
     * scrolled to again when heights change, so the cell lands where its measured height puts it;
     * its row only, the columns left where they are
     */
    let cellScroll: Pick<
        EngineActionMap["scroll-to-cell"],
        "rowIndex" | "align"
    > | null = null;
    /** a pass of `takeMeasures`: the heights that changed (none: nothing allocated), the scale */
    let rowChanges: Measure[] | null = null;
    let detailChanges: Measure[] | null = null;
    let scale = 0;
    /** the height of the details inside the row `takeRow` reads */
    let detailsInRow = 0;

    /** Whether a state's rows or details are measured. */
    function measuring(grid: DataGridModel<TRow, TNode>["state"]): boolean {
        return grid.rowHeight === "auto" || grid.detailHeight === "auto";
    }

    /** Observes a row or a detail from the next frame on, while they are measured. */
    function observeLater(element: Element) {
        const win = viewport?.ownerDocument.defaultView;
        if (!measuring(state) || !win || !("ResizeObserver" in win)) return;
        unobserved.add(element);
        if (observeFrame !== null) return;
        observeFrame = win.requestAnimationFrame(() => {
            observeFrame = null;
            measurer ??= new win.ResizeObserver(onMeasured);
            for (const waiting of unobserved) measurer.observe(waiting);
            unobserved.clear();
        });
    }

    /** Stops observing an element: its height is read again if it comes back. */
    function unobserve(element: Element) {
        unobserved.delete(element);
        heights.delete(element);
        measurer?.unobserve(element);
    }

    /** Observes the rows and details registered so far (attached, or measured from now on). */
    function observeRegistered() {
        for (const element of layers.row) observeLater(element);
        for (const element of layers.detail) observeLater(element);
    }

    /** Observes nothing more, every height read forgotten (detached, or nothing measured). */
    function stopMeasuring() {
        measurer?.disconnect();
        measurer = null;
        unobserved.clear();
        heights = new WeakMap();
        if (observeFrame !== null) {
            viewport?.ownerDocument.defaultView?.cancelAnimationFrame(
                observeFrame,
            );
            observeFrame = null;
        }
    }

    /** Elements resized (or observed for the first time): their heights, taken in. */
    function onMeasured(entries: readonly ResizeObserverEntry[]) {
        for (const { target, borderBoxSize } of entries) {
            const height = borderBoxSize?.[0]?.blockSize;
            // without a box size, read once more
            if (height === undefined) heights.delete(target);
            else heights.set(target, height);
        }
        takeMeasures();
    }

    /** An element's border-box height in layout pixels: as last told, else read once. */
    function heightOf(element: Element): number {
        let height = heights.get(element);
        if (height === undefined) {
            if (scale === 0 && viewport) scale = layoutScale(viewport);
            height = element.getBoundingClientRect().height / (scale || 1);
            heights.set(element, height);
        }
        return height;
    }

    /** The row index an element carries (NaN without one). */
    function rowIndexOf(element: Element): number {
        const attribute = element.getAttribute("data-row-index");
        return attribute === null ? Number.NaN : Number(attribute);
    }

    /** A rendered detail's height, kept when it changed (a loaded row's only). */
    function takeDetail(element: HTMLElement) {
        const index = rowIndexOf(element);
        const key = loadedRowKey(state, index);
        if (key === undefined) return;
        const height = heightOf(element);
        if (measuredDetails.holds(index, height, key)) return;
        if (!detailChanges) detailChanges = [];
        detailChanges.push({ index, height, key });
    }

    /** Adds a detail's height when it is inside the row `this` (a row's own height leaves it out). */
    function addDetailIn(this: Element, detail: HTMLElement) {
        if (this.contains(detail)) detailsInRow += heightOf(detail);
    }

    /**
     * A rendered row's own height, its element's less its details', kept when it changed (a loaded
     * row's only; one measured 0, hidden, keeps the height it had).
     */
    function takeRow(element: HTMLElement) {
        const index = rowIndexOf(element);
        // a group row's key is its group's (Epic #87)
        const key = rowKeyAt(state, index);
        if (key === undefined) return;
        detailsInRow = 0;
        layers.detail.forEach(addDetailIn, element);
        const height = heightOf(element) - detailsInRow;
        if (height <= 0 || measuredRows.holds(index, height, key)) return;
        if (!rowChanges) rowChanges = [];
        rowChanges.push({ index, height, key });
    }

    /**
     * Takes the heights of the rendered rows and details in: each element's as its observer last
     * told, else read once (at a commit, before the browser paints). Nothing is allocated while
     * none changed; when one did, the rows are laid out again (`remeasured`).
     */
    function takeMeasures() {
        if (!viewport || !measuring(state)) return;
        scale = 0;
        if (state.detailHeight === "auto") layers.detail.forEach(takeDetail);
        if (state.rowHeight === "auto") layers.row.forEach(takeRow);
        const details = detailChanges;
        const rows = rowChanges;
        if (!details && !rows) return;
        detailChanges = null;
        rowChanges = null;
        remeasured([
            ...(details ? measuredDetails.set(details) : []),
            ...(rows ? measuredRows.set(rows) : []),
        ]);
    }

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
    function measureAnchor(
        changed: readonly number[],
    ): { index: number; within: number } | null {
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

    /**
     * Drops the heights measured for rows no longer at their index (a new source, rows changed),
     * and every one once rows, or details, are no longer measured. Returns whether one was.
     */
    function forgetMeasures(
        before: DataGridModel<TRow, TNode>["state"],
        after: DataGridModel<TRow, TNode>["state"],
    ): boolean {
        const keyAt = (index: number) => rowKeyAt(after, index);
        const newSource =
            after.source !== before.source || after.rowKey !== before.rowKey;
        const changed = after.rowsChanged !== before.rowsChanged;
        let dropped = false;
        for (const [store, measured] of [
            [measuredRows, after.rowHeight === "auto"],
            [measuredDetails, after.detailHeight === "auto"],
        ] as const) {
            if (!measured) {
                dropped = store.clear() || dropped;
                continue;
            }
            if (newSource) {
                // behind the same `getRow`, only rows added or gone (D6)
                const { start } = newRowsOf(before, after);
                dropped =
                    store.keep(
                        Math.min(start, after.rowCount),
                        Number.POSITIVE_INFINITY,
                        keyAt,
                    ) || dropped;
            }
            if (changed) {
                const { start, end } = after.rowsChanged;
                dropped = store.keep(start, end, keyAt) || dropped;
            }
        }
        return dropped;
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

    /** The row at the view's top, and how far into it the view starts. */
    function anchorOf(
        axis: Axis,
        virtual: number,
        offset = virtual,
    ): { index: number; within: number } | null {
        if (axis.count === 0 || virtual <= 0) return null;
        const index = axis.indexAt(offset);
        return { index, within: offset - axis.offsetOf(index) };
    }

    /** Where an anchor is on an axis that changed: its item's offset, as far into it as it fits. */
    function anchoredOffset(
        axis: Axis,
        anchor: { index: number; within: number },
    ): number {
        return (
            axis.offsetOf(anchor.index) +
            Math.min(anchor.within, axis.sizeOf(anchor.index))
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

    /**
     * A resize, the app's own too, starts from the widths on screen (A2): while the engine sizes
     * columns itself, it fills a resize's `autoWidths` when it names none (`resizeFrom`).
     */
    const unuseModel = model.use((ctx, next) => {
        if (
            ctx.command === "column-widths.resize" &&
            ctx.payload.autoWidths === undefined &&
            hasEngineSized(state.columns)
        ) {
            ctx.payload = {
                ...ctx.payload,
                autoWidths: resizeFrom(ctx.payload.columnKey),
            };
        }
        return next();
    });

    const unsubscribeModel = model.subscribe(({ before, after }) => {
        state = after;
        if (before.direction !== after.direction) directionPending = true;
        // the app moved the rows a move told it of: the active cell follows its row (E2.3)
        followMovedRow(before, after);
        const changedDetails = detailsChanged(before, after);
        // measured heights follow their rows (E2.2)
        const remeasure = forgetMeasures(before, after);
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
            if (wasMeasuring) stopMeasuring();
            else observeRegistered();
        }
        // a row expanding or collapsing grows or shrinks its element: read it again
        if (changedDetails && after.rowHeight === "auto") {
            for (const element of layers.row) heights.delete(element);
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
        // a resize changes the columns' widths: the same path as new columns (W1)
        const columnsChanged =
            after.columns !== before.columns ||
            after.columnWidths !== before.columnWidths;
        const resizing = columnResize;
        const engineWidths = autoWidths;
        // a width changing left of the view keeps the view on the column it shows first, right
        // of the pinned ones, as far into it as it was (as a row expanding above it, M2); a
        // collapse too, by its key (E1.3)
        const anchor =
            after.columns === before.columns
                ? after.columnWidths !== before.columnWidths
                    ? columnAnchor()
                    : null
                : after.collapsedGroupKeys !== before.collapsedGroupKeys
                  ? collapseAnchor(before, after)
                  : null;
        if (columnsChanged) {
            // the flex shares follow the columns, their order and the overrides (A1)
            updateAutoWidths();
            columnAxis = columnAxisOf(after, autoWidths);
            updatePinning();
            if (anchor) keepColumnAnchor(anchor);
        }
        const reordering = columnReorder;
        // a drag follows its column or group (W4, O3)
        if (
            drag?.dragged &&
            drag.kind !== "row" &&
            (columnsChanged || after.header !== before.header)
        ) {
            followDrag(drag);
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
        if (columnResize !== resizing) emit("column-resize", columnResize);
        if (autoWidths !== engineWidths) {
            emit("column-auto-widths", autoWidths);
        }
        if (columnReorder !== reordering) {
            emit("column-reorder", columnReorder);
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
    });

    // ── the adapter ──────────────────────────────────────────────────────────

    const adapter: EngineAdapter<TRow, TNode> = {
        attach(element) {
            if (viewport === element && detachViewport) return detachViewport;
            detachViewport?.();
            viewport = element;
            VIEWPORTS.add(element);
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
            const mutations =
                defaultView && "MutationObserver" in defaultView
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
            interaction.manageCellsUnder(element);
            // the rows and details measured (E2.2), from the next frame on
            observeRegistered();
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
                stopMeasuring();
                pointerDown = false;
                pendingFocus = false;
                if (viewport === element) {
                    // the committed view stays: a re-attach (StrictMode) shows the same layers
                    VIEWPORTS.delete(element);
                    viewport = null;
                    detachViewport = null;
                    wheelOn = false;
                }
            };
            detachViewport = detach;
            return detach;
        },
        registerLayer(layer, element) {
            layers[layer].add(element);
            // a measured row is only read (E2.2)
            if (layer === "row") {
                observeLater(element);
                return () => {
                    layers.row.delete(element);
                    unobserve(element);
                };
            }
            if (layer === "detail") observeLater(element);
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
                if (layer === "detail") unobserve(element);
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
            flushFocus();
            autoSize(rendered);
            // the rows and details rendered for the first time, read before the browser paints;
            // not while a new view waits (widths an automatic width changed): its commit reads
            if (view === committed) takeMeasures();
        },
        keydown,
        click,
        pointerdown,
        setOptions(next) {
            const changed =
                next.maxScrollSize !== options.maxScrollSize ||
                next.overscan?.rows !== options.overscan?.rows ||
                next.overscan?.columns !== options.overscan?.columns ||
                next.endReachedThreshold !== options.endReachedThreshold ||
                next.reorderableRows !== options.reorderableRows;
            options = next;
            // rows that stop moving end a row's drag, moving nothing
            if (!next.reorderableRows && drag?.kind === "row") endDrag("lost");
            if (changed) relayout(true);
        },
    };

    const queries: { [K in EngineQueryKey]: () => EngineQueryMap[K] } = {
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
        "column-resize": () => columnResize,
        "column-reorder": () => columnReorder,
        "row-reorder": () => rowReorder,
        "column-auto-widths": () => autoWidths,
    };

    const actions: {
        [K in EngineActionKey]: (payload: EngineActionMap[K]) => void;
    } = {
        "scroll-to-cell": scrollToCell,
        "scroll-to": scrollTo,
        "interact-cell": interaction.interact,
        "leave-cell": () => {
            interaction.cancelPending();
            interaction.leaveCell(true);
        },
        "fit-columns": ({ columnKeys }) => fitColumns(columnKeys),
    };

    return {
        get(key) {
            return queries[key]();
        },
        run(action, payload) {
            const handler = actions[action] as (payload: unknown) => void;
            handler(payload);
        },
        subscribe(event, listener) {
            const listeners = eventListeners[event] as Set<
                (value: EngineEventMap[typeof event]) => void
            >;
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        destroy() {
            unsubscribeModel();
            unuseModel();
            detachViewport?.();
        },
        adapter,
    };
}
