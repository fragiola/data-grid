import type { Axis } from "../axis/axis";
import { headerRowCount, pinnedColumnCount } from "../header/header";
import { detailsChanged } from "../model/expansion";
import type { DataGridModel } from "../model/model";
import {
    hasReorderable,
    isReorderable,
    landingIndex,
    type Siblings,
    siblingsOf,
} from "../model/order";
import type {
    CellPosition,
    Column,
    HeaderCellLayout,
    HeaderLayout,
} from "../model/types";
import {
    hasResizable,
    resizeMaximum,
    type SpanWidths,
    spanResizable,
    spanWidths,
} from "../model/widths";
import { sameCell } from "../navigation/navigation";
import { clamp, lowerBound } from "../utils";
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
    isCellNode,
    isControl,
    isEditable,
    isElement,
    isPagelessControl,
    isResizer,
    KEYS,
    LINE_HEIGHT,
    movesWithArrows,
    ownerViewport,
    PAGE_KEYS,
    TAB_STOP_ATTRIBUTE,
    VIEWPORTS,
} from "./dom";
import { cellsSizeOf, pinnedInset } from "./geometry";
import { createInteraction } from "./interaction";
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
//     grid    (the sizer: header height + physical body height, physical width)
//       header layer   (sticky at the top; translated on x)
//       body layer     (below the header; translated on x and y)
//
// Every DOM access goes through the viewport's ownerDocument/defaultView, never the globals.

/** The layers whose elements get an inset of the engine's (`left`), not a transform. */
function isInsetLayer(layer: EngineLayer): layer is "pinned" | "detail" {
    return layer === "pinned" || layer === "detail";
}

/** Physical scroll moves, on either axis or both. */
type ScrollMoves = { top?: number | undefined; left?: number | undefined };

/** A drag the engine follows with the pointer: where it started, and where the pointer is. */
interface PointerDrag {
    /** the column's or the group's key */
    readonly columnKey: string;
    /** it moved past a click's slop (a resizer's at once): Escape and its click are its */
    dragged: boolean;
    readonly pointerId: number;
    readonly startX: number;
    /** what holds the pointer: the resizer, or the dragged header cell */
    readonly element: Element;
    readonly doc: Document;
    /** the pointer's last x */
    x: number;
    /** the animation frame the next step waits for, if any */
    frame: number | null;
}

/** A drag on a column resizer (W4). */
interface ResizeDrag extends PointerDrag {
    readonly kind: "resize";
    /** the column's (or the group's) width when it started */
    readonly startWidth: number;
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
    readonly startY: number;
    /** the header its siblings were found in, and them */
    header: HeaderLayout<TRow, TNode> | null;
    siblings: Siblings<TRow, TNode> | null;
}

type Drag<TRow, TNode> = ResizeDrag | ReorderDrag<TRow, TNode>;

/**
 * How a drag ends: a release, a cancel (Escape, `pointercancel`) or a loss (the capture lost, a
 * move with no button, the viewport detached). A resize keeps its width but on a cancel; a
 * reorder moves only on a release.
 */
type DragEnd = "release" | "cancel" | "lost";

/** How near the view's edges a header cell's drag scrolls the columns (O3), in pixels. */
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
    };
    /** the layers that hold rows: a key on one is the grid's (a detail's are its content's) */
    const rowLayers: readonly ReadonlySet<Element>[] = [
        layers.grid,
        layers.header,
        layers.body,
    ];
    let detachViewport: (() => void) | null = null;

    let state = model.state;
    /** the rows' own heights; `rowAxis` adds the details */
    let baseRowAxis = rowAxisOf(state);
    let rowAxis = withDetails(baseRowAxis, state);
    let columnAxis = columnAxisOf(state);
    let width = 0;
    /** the pinned columns in effect, and their width */
    let pinnedCount = 0;
    let pinnedWidth = 0;
    updatePinning();
    let height = 0;

    const maxScroll = () => options.maxScrollSize ?? DEFAULT_MAX_SCROLL_SIZE;
    const headerHeight = () => headerRowCount(state) * state.headerRowHeight;
    const bodyHeight = () => Math.max(0, height - headerHeight());
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
    /** the column a drag is resizing (Epic #70), the one a drag is moving (Epic #75), the drag */
    let columnResize: ColumnResize | null = null;
    let columnReorder: ColumnReorder | null = null;
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
            rowsRevision,
            interaction: interaction.cell,
            columnResize,
            columnReorder,
            headerRowsFor,
        });
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

    /** Takes the current sizes into the scroll mappings; returns the physical moves needed. */
    function remap(): ScrollMoves {
        const moves = {
            top: remapAxis(rowsY, rowMapping(), viewport?.scrollTop ?? 0),
            left: remapAxis(
                columnsX,
                columnMapping(),
                viewport?.scrollLeft ?? 0,
            ),
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
        // the columns that scroll, in the view right of the pinned ones
        const nextColumns = scrollingWindow(
            windowFor(
                columnAxis,
                columnsX.virtual + pinnedWidth,
                width - pinnedWidth,
                overscan.columns ?? 2,
                fresh ? undefined : columnWindow,
            ),
            pinnedCount,
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
        return columnsX.layerOffset(shown.columnBase, element.scrollLeft);
    }

    function offsetY(shown: GridView<TRow, TNode>, element: HTMLElement) {
        return rowsY.layerOffset(shown.rowBase, element.scrollTop);
    }

    /** A layer's transform for offsets `x` and `y`: the header moves with the columns only. */
    function layerTransform(
        layer: "body" | "header",
        x: number,
        y: number,
    ): string {
        return `translate3d(${x}px, ${layer === "body" ? y : 0}px, 0px)`;
    }

    /**
     * the layers' offsets last written (NaN: the next write goes to every layer, where `written`
     * skips the elements that hold it already)
     */
    let layerX = Number.NaN;
    let layerY = Number.NaN;
    /** what the pinned cells' insets were last written for: the layers' `x` and the column axis */
    let pinnedFor: { x: number; columnAxis: Axis } | null = null;

    /**
     * Writes a pinned cell's sticky inset for the layers' `x`: its column's offset less `x`.
     * Sticky is resolved in layout, before the layer's transform moves it by `x`, so it shows at
     * its offset from the view's start, on every frame the browser paints while it scrolls. An
     * element without its column (`data-column-index`) is left alone.
     */
    function writeInset(
        layer: "pinned" | "detail",
        element: HTMLElement,
        x: number,
        columnAxis: Axis,
    ) {
        if (layer === "detail") {
            // the view's start: what a column at offset 0 shows at
            element.style.left = `${-x}px`;
            return;
        }
        const attribute = element.getAttribute("data-column-index");
        const columnIndex = attribute === null ? Number.NaN : Number(attribute);
        if (!Number.isInteger(columnIndex)) return;
        element.style.left = `${pinnedInset(columnAxis, columnIndex, x)}px`;
    }

    /**
     * Writes the pinned cells' insets when the layers' `x` or the columns moved, and only then:
     * unscaled, `x` is the base, which moves with a new view, never with a scroll frame.
     */
    function writeInsets(x: number, columnAxis: Axis) {
        if (pinnedFor?.x === x && pinnedFor.columnAxis === columnAxis) return;
        pinnedFor = { x, columnAxis };
        for (const layer of ["pinned", "detail"] as const) {
            for (const element of layers[layer]) {
                writeInset(layer, element, x, columnAxis);
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
        writeInsets(x, committed.columnAxis);
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
        if (moves.left !== undefined) viewport.scrollLeft = moves.left;
    }

    /** Reads the physical scroll into both axes (both, always); returns whether either moved. */
    function syncScroll(): boolean {
        const rows = rowsY.sync(viewport?.scrollTop ?? 0);
        const columns = columnsX.sync(viewport?.scrollLeft ?? 0);
        return rows || columns;
    }

    function readSize() {
        if (!viewport) return;
        width = viewport.clientWidth;
        height = viewport.clientHeight;
        updatePinning();
    }

    /**
     * The pinned columns in effect: the leading `pinned` ones, while they leave part of the view
     * to scroll. As wide as the view or wider (a narrow screen), they would hide every other
     * column: they scroll with the rest until the view is wider again.
     */
    function updatePinning() {
        const count = pinnedColumnCount(state.columns);
        const pinned = columnAxis.offsetOf(count);
        const fits = width === 0 || pinned < width;
        pinnedCount = fits ? count : 0;
        pinnedWidth = fits ? pinned : 0;
    }

    /** The sizes or the content changed: remap, then update; scroll once the sizer has its size. */
    function relayout(fresh: boolean) {
        viewStale = true;
        const moves = remap();
        update(fresh);
        // the sizer gets its new size when the adapter commits this view
        scrollWhenReady(moves);
    }

    // ── scroll and wheel ─────────────────────────────────────────────────────

    function onScroll() {
        // the scroll the engine made itself lands where it is: the layers only
        if (syncScroll()) update();
        else writeLayers();
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
        let dx = event.deltaX * unit;
        if (event.shiftKey && dx === 0) {
            dx = dy;
            dy = 0;
        }
        event.preventDefault();
        if (dy !== 0) {
            if (yScaled) viewport.scrollTop = rowsY.scrollBy(dy);
            else viewport.scrollTop += dy;
        }
        if (dx !== 0) {
            if (xScaled) viewport.scrollLeft = columnsX.scrollBy(dx);
            else viewport.scrollLeft += dx;
        }
        // the scroll event follows (or not, for a sub-pixel move): update now either way
        syncScroll();
        update();
    }

    /** a scroll to a cell asked for before the viewport attached: applied on attach */
    let pendingCellScroll: EngineActionMap["scroll-to-cell"] | null = null;

    function scrollToCell(payload: EngineActionMap["scroll-to-cell"]) {
        if (!viewport) {
            pendingCellScroll = payload;
            return;
        }
        const { rowIndex, columnIndex, align } = payload;
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
            columnIndex >= pinnedCount &&
            columnIndex < columnAxis.count
        ) {
            // into the view right of the pinned columns; a pinned one is always in view
            const from = columnsX.virtual + pinnedWidth;
            const start = columnAxis.offsetOf(columnIndex);
            const target = scrollTargetForSpan(
                start,
                start + columnAxis.sizeOf(columnIndex),
                from,
                width - pinnedWidth,
                columnAxis.totalSize,
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
        const moves: ScrollMoves = {};
        if (top !== undefined) moves.top = rowsY.scrollTo(top);
        if (left !== undefined) moves.left = columnsX.scrollTo(left);
        update();
        scrollWhenReady(moves);
    }

    /** What scrolls a cell into view: its row (a body row), its column. */
    function scrollPayloadFor(
        position: CellPosition,
    ): EngineActionMap["scroll-to-cell"] {
        return {
            rowIndex: position.rowIndex >= 0 ? position.rowIndex : undefined,
            columnIndex: columnToScrollTo(
                position,
                state.header,
                pinnedCount,
                columnWindow.visible,
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
        const selector = cellSelector(elementPosition(position, state.header));
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

    function onPointerDown(event: PointerEvent) {
        pointerDown = true;
        pressedAt = { x: event.clientX, y: event.clientY };
        lastPress = null;
    }

    // ── drags: a resizer's, a header cell's; resizing's keys (Epics #70, #75) ─

    /** This grid's column resizer an event happened in (a nested grid's is that grid's). */
    function resizerOf(
        target: EventTarget | null,
    ): { element: HTMLElement; columnKey: string } | null {
        if (!isElement(target)) return null;
        const element = target.closest<HTMLElement>(
            `[${COLUMN_RESIZER_ATTRIBUTE}]`,
        );
        const columnKey = element?.getAttribute(COLUMN_RESIZER_ATTRIBUTE);
        return element && columnKey && ownerViewport(element) === viewport
            ? { element, columnKey }
            : null;
    }

    /** A column's or a group's width and limits, or `null` when none of its columns resizes. */
    function resizeSpan(columnKey: string): SpanWidths | null {
        const cell = state.header.cellByKey(columnKey);
        return cell && spanResizable(state.columns, cell)
            ? spanWidths(state.columns, columnAxis, cell)
            : null;
    }

    /** A drag's state changed: a new view, and its event. */
    function publish<K extends "column-resize" | "column-reorder">(
        event: K,
        value: EngineEventMap[K],
    ) {
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

    /**
     * A press in the grid, after the consumer's own handlers (`preventDefault` cancels it): a
     * primary press on a resizer starts a drag (W4), one on a reorderable header cell may become
     * one (O3). With no resizable or reorderable column there is none.
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
                    startWidth: span.width,
                    element,
                    doc,
                    x: event.clientX,
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
        // a header cell's press is not prevented: under the slop it is a click (focus, a sort)
        const header =
            hasReorderable(state.columnEntries) && inViewport(event.target)
                ? headerCellOf(event.target)
                : null;
        if (!header || !isReorderable(header.cell)) return false;
        drag = {
            kind: "reorder",
            columnKey: header.cell.key,
            dragged: false,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            element: header.element,
            doc,
            x: event.clientX,
            frame: null,
            header: null,
            siblings: null,
        };
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
        if (drag.kind === "reorder" && !drag.dragged) {
            // past a click's slop, the press drags its header cell
            if (
                Math.hypot(
                    event.clientX - drag.startX,
                    event.clientY - drag.startY,
                ) > CLICK_SLOP
            ) {
                startReorder(drag, event.clientX);
            }
            return;
        }
        if (event.clientX === drag.x) return;
        drag.x = event.clientX;
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

    /** A drag's step to its pointer: a resize, or a reorder's target. */
    function dragTo(current: Drag<TRow, TNode>) {
        if (current.kind === "resize") resizeTo(current);
        else reorderTo(current);
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

    /** Resizes a drag's column to its pointer: right grows (LTR). */
    function resizeTo(resize: ResizeDrag) {
        resize.appliedX = resize.x;
        model.run("column-widths.resize", {
            columnKey: resize.columnKey,
            width: resize.startWidth + resize.x - resize.startX,
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
     * once, and not when it would land where it is.
     */
    function endDrag(how: DragEnd) {
        const ended = stopDrag();
        if (ended?.kind === "resize") {
            if (how === "cancel") ended.x = ended.startX;
            if (ended.x !== ended.appliedX) resizeTo(ended);
            setColumnResize(null);
        } else if (ended?.dragged) {
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
        }
    }

    /**
     * After the widths or the columns changed during a drag: the resize reports the width on
     * screen; a column gone (or no longer resizable) ends the drag.
     */
    function followResize() {
        const span = drag && resizeSpan(drag.columnKey);
        if (!drag || !span) {
            stopDrag();
            columnResize = null;
        } else if (columnResize?.width !== span.width) {
            columnResize = { columnKey: drag.columnKey, width: span.width };
        }
    }

    /**
     * A key on a focused resizer (W6): its arrows (Shift: farther), Home and End resize its
     * column, through the column's limits; the other page keys and Space are no use to it (the
     * container would page itself). Returns whether the key was the resizer's.
     */
    function resizerKey(event: KeyboardEvent, target: Element): boolean {
        const key = event.key;
        if (!PAGE_KEYS.has(key) && key !== " ") return false;
        const resizer = resizerOf(target);
        if (!resizer) return false;
        event.preventDefault();
        const span =
            RESIZE_KEYS.has(key) && !event.ctrlKey && !event.metaKey
                ? resizeSpan(resizer.columnKey)
                : null;
        if (!span) return true;
        const step = event.shiftKey ? RESIZE_SHIFT_STEP : RESIZE_STEP;
        // End: the maximum it reports (`aria-valuemax`), the view's width without one
        const viewWidth = width;
        const to =
            key === "ArrowLeft"
                ? span.width - step
                : key === "ArrowRight"
                  ? span.width + step
                  : key === "Home"
                    ? span.minWidth
                    : resizeMaximum(span, viewWidth);
        model.run("column-widths.resize", {
            columnKey: resizer.columnKey,
            width: to,
        });
        return true;
    }

    // ── column reordering: the drag, the edge scroll, the keys (Epic #75) ────

    /** A press moved past the slop: its header cell drags, holding the pointer. */
    function startReorder(current: ReorderDrag<TRow, TNode>, x: number) {
        current.dragged = true;
        current.x = x;
        capture(current);
        const target = reorderTarget(current, viewXOf(x));
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

    /** Where a pointer's x is in the view: from its start, inside its border (a layout read). */
    function viewXOf(clientX: number): number {
        if (!viewport) return clientX;
        return (
            clientX -
            viewport.getBoundingClientRect().left -
            viewport.clientLeft
        );
    }

    /** Whether a drag's cell is pinned with the pinned columns in effect: always in view. */
    function inPinnedStrip(siblings: Siblings<TRow, TNode>): boolean {
        return siblings.pinned && pinnedCount > 0;
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
        const offset = inPinnedStrip(siblings)
            ? clamp(x, 0, pinnedWidth)
            : columnsX.virtual + clamp(x, pinnedWidth, width);
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
        const side =
            offset <
            (columnAxis.offsetOf(target.columnIndex) + endOf(target)) / 2
                ? "before"
                : "after";
        const moves = landingIndex(index, at, side) !== index;
        const targetKey = moves ? target.key : null;
        if (
            columnReorder?.columnKey === current.columnKey &&
            columnReorder.targetKey === targetKey &&
            columnReorder.side === (moves ? side : null)
        ) {
            return columnReorder;
        }
        const { columnKey } = current;
        return moves
            ? { columnKey, targetKey: target.key, side }
            : { columnKey, targetKey: null, side: null };
    }

    /** A frame of a header cell's drag: the edge scroll, then the target. */
    function reorderTo(current: ReorderDrag<TRow, TNode>) {
        // the view read once, before the scroll writes
        const x = viewXOf(current.x);
        const scrolled = edgeScroll(current, x);
        const target = reorderTarget(current, x);
        if (target && target !== columnReorder) setColumnReorder(target);
        // the pointer held near an edge keeps scrolling, a frame at a time
        if (scrolled) askFrame(current);
    }

    /**
     * Near the left or right edge of the columns that scroll (or past it), scrolls them toward
     * it, faster nearer, through the engine's own scroll (scaled or not): far siblings come into
     * reach. The two zones never overlap: in a narrow view each is half of it. Returns whether
     * the columns moved. A pinned cell in effect is always in view: none for it.
     */
    function edgeScroll(current: ReorderDrag<TRow, TNode>, x: number): boolean {
        const siblings = siblingsFor(current);
        const zone = Math.min(EDGE_ZONE, (width - pinnedWidth) / 2);
        if (!siblings || inPinnedStrip(siblings) || zone <= 0) return false;
        const left = pinnedWidth + zone;
        const right = width - zone;
        const depth = x < left ? x - left : x > right ? x - right : 0;
        if (depth === 0) return false;
        const step = Math.ceil(EDGE_STEP * Math.min(1, Math.abs(depth) / zone));
        const before = columnsX.virtual;
        scrollTo({ left: before + Math.sign(depth) * step });
        return columnsX.virtual !== before;
    }

    /**
     * After the columns changed during a header cell's drag: it follows its column or group, and
     * ends when that is gone or no longer reorderable.
     */
    function followReorder(current: ReorderDrag<TRow, TNode>) {
        const siblings = siblingsFor(current);
        if (!siblings || !isReorderable(siblings.cell)) {
            stopDrag();
            columnReorder = null;
            return;
        }
        columnReorder = reorderTarget(current, viewXOf(current.x));
    }

    /**
     * Ctrl/⌘+Shift+←/→ on a reorderable header cell in navigation (O6): one move among its
     * siblings, before the previous one or after the next, the active cell following its column.
     * Handled even when nothing moves (at an end, past the pinned ones, refused): the page never
     * gets them.
     */
    function reorderKey(event: KeyboardEvent, target: Element): boolean {
        const left = event.key === "ArrowLeft";
        if (
            (!left && event.key !== "ArrowRight") ||
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
        // focus follows once the cells render in their new order (the commit)
        if (neighbour) {
            model.run("column-order.move", {
                columnKey: siblings.cell.key,
                targetKey: neighbour.key,
                side: left ? "before" : "after",
            });
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
            event.altKey ||
            event.shiftKey ||
            !inViewport(event.target)
        ) {
            return false;
        }
        // a press that moved is a drag (selecting the header's text), not a click. A click with
        // no press (`detail` 0: a screen reader, `element.click()`) has nothing to compare
        const press = pressedAt;
        pressedAt = null;
        // the click ending a drag is the drag's, never a sort: a resizer's (a double click gives
        // the column its own width back, W7) or a header cell's (O3)
        const last = lastPress;
        lastPress = null;
        if (last?.dragged && event.detail > 0) {
            if (last.kind === "resize" && event.detail === 2) {
                model.run("column-widths.reset", { columnKey: last.columnKey });
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
            if (!cancelled) drag.x = event.clientX;
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
        if (!mode || !isCellElement(target)) return false;
        const position = cellOf(target);
        if (!position || position.rowIndex < 0) return false;
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
        if (selectionKey(event, target)) return true;
        if (event.key === " " && !ctrl && rowsY.mapping.scaled) {
            // the browser would page the container natively, a far jump under scaling
            event.preventDefault();
            scrollTo({
                top: rowsY.virtual + (event.shiftKey ? -1 : 1) * bodyHeight(),
            });
            return true;
        }
        const direction =
            (ctrl ? CTRL_KEYS[event.key] : undefined) ?? KEYS[event.key];
        if (!direction) return false;
        event.preventDefault();
        pendingFocus = true;
        if (!state.activePosition) {
            focusFirstVisibleCell();
            return true;
        }
        const visible = rowWindow.visible.end - rowWindow.visible.start;
        model.run("active-position.move", {
            direction,
            pageSize: Math.max(1, visible - 1),
            visibleColumns: columnWindow.visible,
        });
        // the move may have been refused or landed where it was: focus stays where it is
        flushFocus();
        return true;
    }

    // ── the model ────────────────────────────────────────────────────────────

    /** Whether the view renders a row of the range: in the rendered rows, or the active row. */
    function rendersRows(range: Range): boolean {
        const active = state.activePosition;
        return (
            overlaps(view.renderedRows, range.start, range.end) ||
            (active !== null &&
                overlaps(range, active.rowIndex, active.rowIndex + 1))
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

    const unsubscribeModel = model.subscribe(({ before, after }) => {
        state = after;
        const changedDetails = detailsChanged(before, after);
        if (after.rowsChanged !== before.rowsChanged) {
            const rendered = rendersRows(after.rowsChanged);
            // rows' data changed, and nothing else did: off screen, there is nothing to do
            if (!rendered && !changedDetails) return;
            if (rendered) rowsRevision += 1;
        }
        const rowsResized =
            after.rowCount !== before.rowCount ||
            after.rowHeight !== before.rowHeight;
        if (rowsResized) {
            baseRowAxis =
                after.rowHeight === before.rowHeight
                    ? baseRowAxis.withCount(after.rowCount)
                    : rowAxisOf(after);
        }
        let anchored = false;
        if (rowsResized || changedDetails) {
            const anchor = rowsResized
                ? null
                : anchorOf(rowAxis, rowsY.virtual);
            rowAxis = withDetails(baseRowAxis, after);
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
        // a width changing left of the view keeps the view on the column it shows first, right
        // of the pinned ones, as far into it as it was (as a row expanding above it, M2)
        const columnAnchor =
            after.columns === before.columns &&
            after.columnWidths !== before.columnWidths
                ? anchorOf(
                      columnAxis,
                      columnsX.virtual,
                      columnsX.virtual + pinnedWidth,
                  )
                : null;
        if (columnsChanged) {
            columnAxis = columnAxisOf(after);
            updatePinning();
            if (columnAnchor) {
                columnsX.virtual = Math.max(
                    0,
                    anchoredOffset(columnAxis, columnAnchor) - pinnedWidth,
                );
            }
            if (drag?.kind === "resize") followResize();
        }
        const reordering = columnReorder;
        // a header cell's drag follows its column or group (O3)
        if (
            drag?.kind === "reorder" &&
            drag.dragged &&
            (columnsChanged || after.header !== before.header)
        ) {
            followReorder(drag);
        }
        relayout(
            rowsResized ||
                changedDetails ||
                columnsChanged ||
                after.headerRowHeight !== before.headerRowHeight ||
                after.header !== before.header,
        );
        if (columnResize !== resizing) emit("column-resize", columnResize);
        if (columnReorder !== reordering) {
            emit("column-reorder", columnReorder);
        }
        // the physical scroll follows even when the total did not change (no remap moved it)
        if (anchored) {
            const top = rowsY.scrollTo(rowsY.virtual);
            if (Math.abs(top - (viewport?.scrollTop ?? 0)) > 0.5) {
                scrollWhenReady({ top });
            }
        }
        if (columnAnchor) {
            const left = columnsX.scrollTo(columnsX.virtual);
            if (Math.abs(left - (viewport?.scrollLeft ?? 0)) > 0.5) {
                scrollWhenReady({ left });
            }
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
            const observer =
                defaultView && "ResizeObserver" in defaultView
                    ? new defaultView.ResizeObserver(() => {
                          readSize();
                          relayout(false);
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
            pinnedFor = null;
            relayout(true);
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
                    committed.columnAxis,
                );
            } else {
                // nothing to write for yet (a detached viewport: a root re-mounting while its
                // cells stay): the next write is for every pinned cell
                pinnedFor = null;
            }
            return () => {
                layers[layer].delete(element);
                written.delete(element);
                // a cell no longer pinned keeps no inset of the engine's: its adapter places it
                if (isInsetLayer(layer)) element.style.left = "";
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
            if (moves.top !== undefined || moves.left !== undefined) {
                applyScroll(moves);
                syncScroll();
                update();
            }
            writeLayers();
            interaction.committed();
            flushFocus();
        },
        keydown,
        click,
        pointerdown,
        setOptions(next) {
            const changed =
                next.maxScrollSize !== options.maxScrollSize ||
                next.overscan?.rows !== options.overscan?.rows ||
                next.overscan?.columns !== options.overscan?.columns ||
                next.endReachedThreshold !== options.endReachedThreshold;
            options = next;
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
            detachViewport?.();
        },
        adapter,
    };
}
