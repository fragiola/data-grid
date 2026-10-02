import { type Axis, createAxis } from "../axis/axis";
import { headerCellsIn } from "../header/header";
import type { DataGridModel } from "../model/model";
import type {
    CellPosition,
    Column,
    DataGridState,
    HeaderCellLayout,
    HeaderLayout,
    RowSource,
} from "../model/types";
import { type Direction, sameCell } from "../navigation/navigation";
import {
    createScrollMapping,
    DEFAULT_MAX_SCROLL_SIZE,
    ScrollAxisState,
} from "../viewport/scaling";
import { type ScrollAlign, scrollTargetFor } from "../viewport/scroll-target";
import {
    type AxisWindow,
    EMPTY_WINDOW,
    type Range,
    sameRange,
    sameWindow,
    windowFor,
} from "../viewport/window";

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

/** How the engine renders and loads. */
export interface DataGridEngineOptions {
    /** items rendered beyond the view on each side (default 4 rows, 2 columns) */
    overscan?: { rows?: number; columns?: number };
    /** the cap on an axis's physical scroll size (default {@link DEFAULT_MAX_SCROLL_SIZE}) */
    maxScrollSize?: number;
    /** `rows-end-reached` fires when the view's last row is this close to the end (default 10) */
    endReachedThreshold?: number;
}

/** A header row a render shows: its index (-depth … -1) and its cells in the column window. */
export interface HeaderRowView<TRow = unknown, TNode = unknown> {
    readonly rowIndex: number;
    /**
     * the cells starting in this row that intersect the rendered columns (a group cut by the
     * window included), plus the one holding the active column
     */
    readonly cells: readonly HeaderCellLayout<TRow, TNode>[];
}

/**
 * Everything a render of the grid needs. A new object only when what is rendered changes: the
 * rendered ranges, the sizes, the data, the columns or the active cell; scrolling inside the
 * overscan keeps the same view, so nothing renders.
 */
export interface GridView<TRow = unknown, TNode = unknown> {
    /** the body rows to render, in order: the rendered range, plus the active row */
    readonly rows: readonly number[];
    /** the columns to render, in order: the rendered range, plus the active column */
    readonly columns: readonly number[];
    /** the rendered rows' range (the overscan window), without the active row */
    readonly renderedRows: Range;
    /** the rendered columns' range (the overscan window), without the active column */
    readonly renderedColumns: Range;
    /** the virtual offset the body layer lays its rows out from */
    readonly rowBase: number;
    /** the virtual offset the layers lay their cells out from */
    readonly columnBase: number;
    /** the sizer's physical width */
    readonly width: number;
    /** the body's physical height (the sizer is `headerHeight + height`) */
    readonly height: number;
    /** the header's height: its rows times `headerRowHeight` */
    readonly headerHeight: number;
    /** a header row's height */
    readonly headerRowHeight: number;
    /**
     * the viewport's visible width (what an empty grid's placeholder spans); a resize alone
     * publishes a new view only while the grid has no rows
     */
    readonly viewportWidth: number;
    /** the visible body's height, below the header (what an empty grid's placeholder fills); as above */
    readonly viewportBodyHeight: number;
    /** the header rows: the header's depth, 0 without a header */
    readonly headerRowCount: number;
    /** the header rows to render, the top one first (none without a header) */
    readonly headerRows: readonly HeaderRowView<TRow, TNode>[];
    /** the header's layout, for the whole grid */
    readonly header: HeaderLayout<TRow, TNode>;
    readonly rowCount: number;
    readonly columnCount: number;
    readonly rowAxis: Axis;
    readonly columnAxis: Axis;
    readonly columnDefs: readonly Column<TRow, TNode>[];
    readonly source: RowSource<TRow>;
    readonly active: CellPosition | null;
    /**
     * moves when `rows.changed` names rows this view renders (the rendered rows or the active
     * row): their data is new, read it again
     */
    readonly rowsRevision: number;
}

/** What `engine.get` reads. */
export interface EngineQueryMap {
    "row-window": AxisWindow;
    "column-window": AxisWindow;
    /** the virtual scroll offsets */
    "scroll-position": { readonly top: number; readonly left: number };
    /** the viewport's size, and the body's (below the header) */
    "viewport-size": {
        readonly width: number;
        readonly height: number;
        readonly bodyHeight: number;
    };
    /** whether an axis is scaled (its virtual size passes the cap) */
    "scroll-scaled": { readonly rows: boolean; readonly columns: boolean };
}

export type EngineQueryKey = keyof EngineQueryMap;

/** What `engine.run` does: screen actions (no dot: they are not model commands). */
export interface EngineActionMap {
    /** scrolls a cell into view (either index alone scrolls that axis only) */
    "scroll-to-cell": {
        readonly rowIndex?: number | undefined;
        readonly columnIndex?: number | undefined;
        readonly align?: ScrollAlign | undefined;
    };
    /** scrolls to virtual offsets */
    "scroll-to": {
        readonly top?: number | undefined;
        readonly left?: number | undefined;
    };
}

export type EngineActionKey = keyof EngineActionMap;

/** What `engine.subscribe` listens to. */
export interface EngineEventMap {
    /** the row window changed (visible or rendered) */
    "row-window": AxisWindow;
    /** the column window changed (visible or rendered) */
    "column-window": AxisWindow;
    /** the view's last row came within the threshold of the end: once per row count */
    "rows-end-reached": { readonly rowCount: number };
}

export type EngineEventKey = keyof EngineEventMap;

/** The layers whose geometry the engine writes. */
export type EngineLayer = "grid" | "header" | "body";

/** What only an adapter calls. An app never touches it. */
export interface EngineAdapter<TRow = unknown, TNode = unknown> {
    /** binds the engine to the scroll container; returns the unbinding (idempotent) */
    attach(viewport: HTMLElement): () => void;
    /** registers a layer's element (the header layer has one per header row); returns the unregistration */
    registerLayer(layer: EngineLayer, element: HTMLElement): () => void;
    /** the view to render */
    getView(): GridView<TRow, TNode>;
    /** listens to view changes (for `useSyncExternalStore`) */
    subscribe(listener: () => void): () => void;
    /**
     * Tells the engine a view is on screen (from a layout effect): it writes the layers' offsets
     * for that view's bases, applies the scroll it was waiting to apply and moves focus.
     */
    commit(view: GridView<TRow, TNode>): void;
    /**
     * Handles a key pressed in the grid. Returns whether it did (and then prevented the default).
     * An adapter calls it after the consumer's own handlers, so they can cancel a key
     * (`preventDefault`) or replace it.
     */
    keydown(event: KeyboardEvent): boolean;
    /** changes the options */
    setOptions(options: DataGridEngineOptions): void;
}

/** One grid on screen. */
export interface DataGridEngine<TRow = unknown, TNode = unknown> {
    get<K extends EngineQueryKey>(key: K): EngineQueryMap[K];
    run<K extends EngineActionKey>(
        action: K,
        payload: EngineActionMap[K],
    ): void;
    subscribe<K extends EngineEventKey>(
        event: K,
        listener: (value: EngineEventMap[K]) => void,
    ): () => void;
    /** stops listening to the model; the adapter detaches the viewport itself */
    destroy(): void;
    readonly adapter: EngineAdapter<TRow, TNode>;
}

const KEYS: Record<string, Direction> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    Home: "row-start",
    End: "row-end",
    PageUp: "page-up",
    PageDown: "page-down",
};

/** A key with Ctrl (or ⌘) held: Ctrl+Home and Ctrl+End reach the grid's ends. */
const CTRL_KEYS: Record<string, Direction> = {
    Home: "grid-start",
    End: "grid-end",
};

/** The pixels a wheel "line" or "page" stands for (`deltaMode` 1 and 2). */
const LINE_HEIGHT = 40;

function isEditable(target: EventTarget | null): boolean {
    if (!target || typeof target !== "object" || !("tagName" in target)) {
        return false;
    }
    const element = target as HTMLElement;
    const tag = element.tagName;
    return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        element.isContentEditable === true
    );
}

function rowAxisOf<TRow, TNode>(state: DataGridState<TRow, TNode>): Axis {
    return createAxis(state.rowCount, state.rowHeight);
}

function columnAxisOf<TRow, TNode>(state: DataGridState<TRow, TNode>): Axis {
    const { columns } = state;
    return createAxis(columns.length, (index) => columns[index]?.width ?? 0);
}

/** `range` as a list of indexes, with `extra` added in order when it is outside. */
function indexes(start: number, end: number, extra: number | null): number[] {
    const list: number[] = [];
    if (extra !== null && extra >= 0 && extra < start) list.push(extra);
    for (let i = start; i < end; i++) list.push(i);
    if (extra !== null && extra >= end) list.push(extra);
    return list;
}

/**
 * Every attached viewport, across engines: a grid nested in a cell of another one is its own grid,
 * and an engine tells its cells from a nested grid's by the nearest viewport above them.
 */
const VIEWPORTS = new WeakSet<Element>();

function isElement(target: unknown): target is Element {
    return (
        typeof target === "object" &&
        target !== null &&
        "nodeType" in target &&
        target.nodeType === 1
    );
}

/** The nearest attached viewport at or above `element`: the grid it belongs to. */
function ownerViewport(element: Element): Element | null {
    for (let node: Element | null = element; node; node = node.parentElement) {
        if (VIEWPORTS.has(node)) return node;
    }
    return null;
}

/** The cell elements carry their indexes: the engine finds one to focus by them. */
function cellSelector({ rowIndex, columnIndex }: CellPosition): string {
    return `[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`;
}

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
    };
    let detachViewport: (() => void) | null = null;

    let state = model.state;
    let rowAxis = rowAxisOf(state);
    let columnAxis = columnAxisOf(state);
    let width = 0;
    let height = 0;

    const maxScroll = () => options.maxScrollSize ?? DEFAULT_MAX_SCROLL_SIZE;
    const headerRowCount = () =>
        state.headerRowHeight > 0 ? state.header.depth : 0;
    const headerHeight = () => headerRowCount() * state.headerRowHeight;
    const bodyHeight = () => Math.max(0, height - headerHeight());
    const rowsY = new ScrollAxisState(createScrollMapping(0, 0));
    const columnsX = new ScrollAxisState(createScrollMapping(0, 0));

    /** the header rows last laid out, and what they were laid out for */
    let headerRowsMemo: {
        header: HeaderLayout<TRow, TNode>;
        count: number;
        start: number;
        end: number;
        extra: number | null;
        rows: readonly HeaderRowView<TRow, TNode>[];
    } | null = null;

    let rowWindow: AxisWindow = EMPTY_WINDOW;
    let columnWindow: AxisWindow = EMPTY_WINDOW;
    /** the view's `rowsRevision`: only a change to rows on screen moves it */
    let rowsRevision = 0;
    let view: GridView<TRow, TNode> = makeView();
    let committed: GridView<TRow, TNode> | null = null;
    let endReachedAt = -1;
    /** physical scroll positions waiting for the sizer to have its new size (applied on commit) */
    let pendingScroll: { top?: number; left?: number } = {};
    let pendingFocus = false;
    /** focus was in the grid when a new view went out to render */
    let focusBeforeRender = false;
    /** a pointer is down in the viewport: focus it causes is a click, not a Tab */
    let pointerDown = false;
    const viewListeners = new Set<() => void>();
    const eventListeners: {
        [K in EngineEventKey]: Set<(value: EngineEventMap[K]) => void>;
    } = {
        "row-window": new Set(),
        "column-window": new Set(),
        "rows-end-reached": new Set(),
    };

    function emit<K extends EngineEventKey>(
        event: K,
        value: EngineEventMap[K],
    ) {
        for (const listener of [...eventListeners[event]]) listener(value);
    }

    /**
     * The column rendered outside the window for the active cell: its own, or none for a header
     * cell whose span reaches into the window (it is rendered with the window's cells).
     */
    function activeColumn(): number | null {
        const active = state.activePosition;
        if (!active) return null;
        const { start, end } = columnWindow.rendered;
        if (active.rowIndex < 0) {
            const cell = state.header.cellAt(
                active.rowIndex,
                active.columnIndex,
            );
            if (
                cell &&
                cell.columnIndex < end &&
                cell.columnIndex + cell.columnSpan > start
            ) {
                return null;
            }
        }
        return active.columnIndex;
    }

    /** The header rows for the rendered columns: laid out again only when they change. */
    function headerRowsFor(
        count: number,
        extra: number | null,
    ): readonly HeaderRowView<TRow, TNode>[] {
        const { start, end } = columnWindow.rendered;
        const memo = headerRowsMemo;
        if (
            memo &&
            memo.header === state.header &&
            memo.count === count &&
            memo.start === start &&
            memo.end === end &&
            memo.extra === extra
        ) {
            return memo.rows;
        }
        const rows =
            count > 0
                ? headerCellsIn(state.header, start, end, extra).map(
                      (cells, level) => ({ rowIndex: level - count, cells }),
                  )
                : [];
        headerRowsMemo = {
            header: state.header,
            count,
            start,
            end,
            extra,
            rows,
        };
        return rows;
    }

    function makeView(): GridView<TRow, TNode> {
        const active = state.activePosition;
        const activeRow =
            active && active.rowIndex >= 0 ? active.rowIndex : null;
        const extraColumn = activeColumn();
        const rowsOfHeader = headerRowCount();
        return {
            rows: indexes(
                rowWindow.rendered.start,
                rowWindow.rendered.end,
                activeRow,
            ),
            columns: indexes(
                columnWindow.rendered.start,
                columnWindow.rendered.end,
                extraColumn,
            ),
            renderedRows: rowWindow.rendered,
            renderedColumns: columnWindow.rendered,
            rowBase: rowAxis.offsetOf(rowWindow.rendered.start),
            columnBase: columnAxis.offsetOf(columnWindow.rendered.start),
            width: columnsX.mapping.physicalSize,
            height: rowsY.mapping.physicalSize,
            headerHeight: headerHeight(),
            headerRowHeight: state.headerRowHeight,
            viewportWidth: width,
            viewportBodyHeight: bodyHeight(),
            headerRowCount: rowsOfHeader,
            headerRows: headerRowsFor(rowsOfHeader, extraColumn),
            header: state.header,
            rowCount: state.rowCount,
            columnCount: state.columns.length,
            rowAxis,
            columnAxis,
            columnDefs: state.columns,
            source: state.source,
            active,
            rowsRevision,
        };
    }

    function viewChanged(next: GridView<TRow, TNode>): boolean {
        const current = view;
        return (
            !sameRange(current.renderedRows, next.renderedRows) ||
            !sameRange(current.renderedColumns, next.renderedColumns) ||
            current.rows.length !== next.rows.length ||
            current.rows[0] !== next.rows[0] ||
            current.rows[current.rows.length - 1] !==
                next.rows[next.rows.length - 1] ||
            current.columns.length !== next.columns.length ||
            current.columns[0] !== next.columns[0] ||
            current.columns[current.columns.length - 1] !==
                next.columns[next.columns.length - 1] ||
            current.width !== next.width ||
            current.height !== next.height ||
            current.headerHeight !== next.headerHeight ||
            current.headerRowHeight !== next.headerRowHeight ||
            current.header !== next.header ||
            // the visible area matters only to an empty grid: a resize alone renders nothing else
            ((current.rowCount === 0 || next.rowCount === 0) &&
                (current.viewportWidth !== next.viewportWidth ||
                    current.viewportBodyHeight !== next.viewportBodyHeight)) ||
            current.rowAxis !== next.rowAxis ||
            current.columnAxis !== next.columnAxis ||
            current.columnDefs !== next.columnDefs ||
            current.source !== next.source ||
            current.active !== next.active ||
            current.rowsRevision !== next.rowsRevision
        );
    }

    /** Takes the current sizes into the scroll mappings; returns the physical moves needed. */
    function remap(): { top?: number; left?: number } {
        const moves: { top?: number; left?: number } = {};
        const yMapping = createScrollMapping(
            rowAxis.totalSize,
            bodyHeight(),
            maxScroll(),
        );
        const y = rowsY.mapping;
        if (
            y.virtualSize !== yMapping.virtualSize ||
            y.viewportSize !== yMapping.viewportSize ||
            y.physicalSize !== yMapping.physicalSize
        ) {
            const before = viewport?.scrollTop ?? 0;
            const top = rowsY.remap(yMapping);
            if (Math.abs(top - before) > 0.5) moves.top = top;
        }
        const xMapping = createScrollMapping(
            columnAxis.totalSize,
            width,
            maxScroll(),
        );
        const x = columnsX.mapping;
        if (
            x.virtualSize !== xMapping.virtualSize ||
            x.viewportSize !== xMapping.viewportSize ||
            x.physicalSize !== xMapping.physicalSize
        ) {
            const before = viewport?.scrollLeft ?? 0;
            const left = columnsX.remap(xMapping);
            if (Math.abs(left - before) > 0.5) moves.left = left;
        }
        return moves;
    }

    /**
     * Recomputes the windows and the view from the scroll state; tells the window listeners and
     * the view listeners what changed; writes the layers' offsets.
     */
    function update(fresh = false) {
        const overscan = options.overscan ?? {};
        const nextRows = windowFor(
            rowAxis,
            rowsY.virtual,
            bodyHeight(),
            overscan.rows ?? 4,
            fresh ? undefined : rowWindow,
        );
        const nextColumns = windowFor(
            columnAxis,
            columnsX.virtual,
            width,
            overscan.columns ?? 2,
            fresh ? undefined : columnWindow,
        );
        const rowsMoved = !sameWindow(rowWindow, nextRows);
        const columnsMoved = !sameWindow(columnWindow, nextColumns);
        rowWindow = nextRows;
        columnWindow = nextColumns;
        const next = makeView();
        // the visible ranges moving inside the rendered ones keep the same view: nothing renders
        if (viewChanged(next)) {
            view = next;
            // a render may remove the focused cell (a row remounting as it loads): commit restores it
            focusBeforeRender ||= focusInside();
            for (const listener of [...viewListeners]) listener();
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
    const gridLayers = (): ReadonlySet<Element> => layers.grid;

    function setTransform(layer: EngineLayer, transform: string) {
        for (const element of layers[layer]) {
            if (written.get(element) === transform) continue;
            written.set(element, transform);
            element.style.transform = transform;
        }
    }

    /** The layers' offsets for the view on screen: what is in view is the virtual offset's content. */
    function writeLayers() {
        if (!viewport || !committed) return;
        const x = columnsX.layerOffset(
            committed.columnBase,
            viewport.scrollLeft,
        );
        const y = rowsY.layerOffset(committed.rowBase, viewport.scrollTop);
        setTransform("body", `translate3d(${x}px, ${y}px, 0px)`);
        setTransform("header", `translate3d(${x}px, 0px, 0px)`);
    }

    /**
     * Sets the physical scroll, now or, while a view the adapter has not committed yet is waiting
     * (its sizer may not have its size), when it commits; a later move replaces an earlier one.
     */
    function scrollWhenReady(moves: { top?: number; left?: number }) {
        if (view !== committed) {
            pendingScroll = { ...pendingScroll, ...moves };
        } else {
            applyScroll(moves);
        }
    }

    function applyScroll(moves: { top?: number; left?: number }) {
        if (!viewport) return;
        if (moves.top !== undefined) viewport.scrollTop = moves.top;
        if (moves.left !== undefined) viewport.scrollLeft = moves.left;
    }

    function readSize() {
        if (!viewport) return;
        width = viewport.clientWidth;
        height = viewport.clientHeight;
    }

    /** The sizes or the content changed: remap, then update; scroll once the sizer has its size. */
    function relayout(fresh: boolean) {
        const moves = remap();
        update(fresh);
        // the sizer gets its new size when the adapter commits this view
        scrollWhenReady(moves);
    }

    // ── scroll and wheel ─────────────────────────────────────────────────────

    function onScroll() {
        if (!viewport) return;
        rowsY.sync(viewport.scrollTop);
        columnsX.sync(viewport.scrollLeft);
        update();
    }

    /** Under scaling, the wheel moves the content by exactly its delta (the native scroll would not). */
    function onWheel(event: WheelEvent) {
        // a wheel over a grid nested in a cell is that grid's (or the browser's, which chains it)
        if (
            !viewport ||
            event.ctrlKey ||
            event.defaultPrevented ||
            !inViewport(event.target)
        ) {
            return;
        }
        const yScaled = rowsY.mapping.scaled;
        const xScaled = columnsX.mapping.scaled;
        if (!yScaled && !xScaled) return;
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
        rowsY.sync(viewport.scrollTop);
        columnsX.sync(viewport.scrollLeft);
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
        const moves: { top?: number; left?: number } = {};
        if (
            rowIndex !== undefined &&
            rowIndex >= 0 &&
            rowIndex < rowAxis.count
        ) {
            const target = scrollTargetFor(
                rowAxis,
                rowIndex,
                rowsY.virtual,
                bodyHeight(),
                align,
            );
            if (target !== rowsY.virtual) moves.top = rowsY.scrollTo(target);
        }
        if (
            columnIndex !== undefined &&
            columnIndex >= 0 &&
            columnIndex < columnAxis.count
        ) {
            const target = scrollTargetFor(
                columnAxis,
                columnIndex,
                columnsX.virtual,
                width,
                align,
            );
            if (target !== columnsX.virtual)
                moves.left = columnsX.scrollTo(target);
        }
        if (moves.top === undefined && moves.left === undefined) return;
        update();
        scrollWhenReady(moves);
    }

    function scrollTo({ top, left }: EngineActionMap["scroll-to"]) {
        const moves: { top?: number; left?: number } = {};
        if (top !== undefined) moves.top = rowsY.scrollTo(top);
        if (left !== undefined) moves.left = columnsX.scrollTo(left);
        update();
        scrollWhenReady(moves);
    }

    /**
     * The column to scroll to for a cell: its own, or for a header cell spanning columns, none
     * while any of them is in view, else the one nearest to the view.
     */
    function columnToScrollTo(position: CellPosition): number | undefined {
        if (position.rowIndex >= 0) return position.columnIndex;
        const cell = state.header.cellAt(
            position.rowIndex,
            position.columnIndex,
        );
        if (!cell || cell.columnSpan <= 1) return position.columnIndex;
        const end = cell.columnIndex + cell.columnSpan;
        const { start: from, end: to } = columnWindow.visible;
        if (cell.columnIndex < to && end > from) return undefined;
        return end <= from ? end - 1 : cell.columnIndex;
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
        const owned = viewport;
        const cell = [
            ...viewport.querySelectorAll<HTMLElement>(
                cellSelector(elementPosition(position)),
            ),
        ].find((element) => ownerViewport(element) === owned);
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

    /** Where a cell's element is: a header cell's top row and first column. */
    function elementPosition(position: CellPosition): CellPosition {
        if (position.rowIndex >= 0) return position;
        const cell = state.header.cellAt(
            position.rowIndex,
            position.columnIndex,
        );
        return cell
            ? { rowIndex: cell.rowIndex, columnIndex: cell.columnIndex }
            : position;
    }

    /** The first cell in view: where focus lands when the grid itself gets it. */
    function firstVisibleCell(): CellPosition | null {
        if (state.columns.length === 0) return null;
        const rowIndex =
            state.rowCount > 0
                ? rowWindow.visible.start
                : state.headerRowHeight > 0
                  ? -1
                  : null;
        if (rowIndex === null) return null;
        return { rowIndex, columnIndex: columnWindow.visible.start };
    }

    /** Whether an event comes from this grid itself, not from a grid nested in one of its cells. */
    function inViewport(target: EventTarget | null): boolean {
        return Boolean(
            viewport && isElement(target) && ownerViewport(target) === viewport,
        );
    }

    /** Whether a key from `target` is the grid's: from one of its cells, its viewport or a layer. */
    function ownsKeysOf(target: EventTarget | null): boolean {
        if (target === viewport) return true;
        if (!isElement(target)) return false;
        const owned: ReadonlySet<Element>[] = Object.values(layers);
        if (owned.some((elements) => elements.has(target))) return true;
        return cellOf(target) !== null;
    }

    /**
     * The cell of this grid an event happened in. Inside a nested grid, it is the cell of this
     * grid that holds the nested one: the nested grid's own cells are not this grid's.
     */
    function cellOf(target: EventTarget | null): CellPosition | null {
        if (!viewport || !isElement(target)) return null;
        let cell: Element | null = null;
        let node: Element | null = target;
        for (; node && node !== viewport; node = node.parentElement) {
            // below another grid's viewport: whatever was found belongs to that grid
            if (VIEWPORTS.has(node)) cell = null;
            else if (
                !cell &&
                node.hasAttribute("data-row-index") &&
                node.hasAttribute("data-column-index")
            ) {
                cell = node;
            }
        }
        if (node !== viewport || !cell) return null;
        const rowIndex = Number(cell.getAttribute("data-row-index"));
        const columnIndex = Number(cell.getAttribute("data-column-index"));
        if (!Number.isInteger(rowIndex) || !Number.isInteger(columnIndex))
            return null;
        return { rowIndex, columnIndex };
    }

    function onPointerDown() {
        pointerDown = true;
    }

    /** A release anywhere (or a pointer the browser took over for a scroll) ends the press. */
    function onPointerEnd() {
        pointerDown = false;
    }

    function onFocusOut(event: FocusEvent) {
        const next = event.relatedTarget;
        if (
            viewport &&
            next &&
            typeof next === "object" &&
            "nodeType" in next &&
            !viewport.contains(next as unknown as Element)
        ) {
            pendingFocus = false;
        }
    }

    function onFocusIn(event: FocusEvent) {
        const cell = cellOf(event.target);
        if (cell && (rowsY.mapping.scaled || columnsX.mapping.scaled)) {
            // the browser scrolled the focused cell into view itself (a Tab): under scaling its
            // scroll would map to a far jump, so the engine makes the move, exact, instead
            scrollToCell({
                rowIndex: cell.rowIndex >= 0 ? cell.rowIndex : undefined,
                columnIndex: columnToScrollTo(cell),
            });
        }
        if (cell) {
            const active = state.activePosition;
            // a header cell spanning rows is already active on any of its rows
            if (!active || !sameCell(active, cell, state.header.cellAt)) {
                model.run("active-position.set", cell);
            }
            return;
        }
        // the grid or the scroll container itself took focus (Tab into the grid; Firefox makes a
        // scroll container a tab stop): hand it to the active cell, or the first in view
        const target = event.target;
        if (
            target !== viewport &&
            !(isElement(target) && gridLayers().has(target))
        ) {
            return;
        }
        // a click on empty space focuses the container: that is no reason to activate a cell
        if (pointerDown) return;
        pendingFocus = true;
        if (state.activePosition) {
            flushFocus();
            return;
        }
        const first = firstVisibleCell();
        // refused (a middleware, a controlled parent): nothing to focus
        if (!first || !model.run("active-position.set", first).ok) {
            pendingFocus = false;
        }
    }

    function keydown(event: KeyboardEvent): boolean {
        // a key typed into a field inside a cell is the field's, a key from outside the grid (a
        // menu portalled out of a cell, whose events still bubble through the cell) is not ours,
        // and neither is one from the app's content beside the cells (an empty state's action)
        if (
            event.defaultPrevented ||
            event.altKey ||
            isEditable(event.target) ||
            !inViewport(event.target) ||
            !ownsKeysOf(event.target)
        ) {
            return false;
        }
        if (
            event.key === " " &&
            !event.ctrlKey &&
            !event.metaKey &&
            rowsY.mapping.scaled
        ) {
            // the browser would page the container natively, a far jump under scaling
            event.preventDefault();
            scrollTo({
                top: rowsY.virtual + (event.shiftKey ? -1 : 1) * bodyHeight(),
            });
            return true;
        }
        const ctrl = event.ctrlKey || event.metaKey;
        const direction =
            (ctrl ? CTRL_KEYS[event.key] : undefined) ?? KEYS[event.key];
        if (!direction) return false;
        event.preventDefault();
        pendingFocus = true;
        if (!state.activePosition) {
            const first = firstVisibleCell();
            if (!first || !model.run("active-position.set", first).ok) {
                pendingFocus = false;
            }
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
        const rendered = view.renderedRows;
        if (range.start < rendered.end && rendered.start < range.end)
            return true;
        const active = state.activePosition;
        return (
            active !== null &&
            active.rowIndex >= range.start &&
            active.rowIndex < range.end
        );
    }

    const unsubscribeModel = model.subscribe((event) => {
        const { before, after } = event;
        state = after;
        if (after.rowsChanged !== before.rowsChanged) {
            // rows' data changed, and nothing else did: off screen, there is nothing to do
            if (!rendersRows(after.rowsChanged)) return;
            rowsRevision += 1;
        }
        let fresh = false;
        if (
            after.rowCount !== before.rowCount ||
            after.rowHeight !== before.rowHeight
        ) {
            rowAxis =
                after.rowHeight === before.rowHeight
                    ? rowAxis.withCount(after.rowCount)
                    : rowAxisOf(after);
            fresh = true;
        }
        if (after.columns !== before.columns) {
            columnAxis = columnAxisOf(after);
            fresh = true;
        }
        if (
            after.headerRowHeight !== before.headerRowHeight ||
            after.header !== before.header
        ) {
            fresh = true;
        }
        relayout(fresh);
        const active = after.activePosition;
        if (active && active !== before.activePosition) {
            if (focusInside()) pendingFocus = true;
            scrollToCell({
                rowIndex: active.rowIndex >= 0 ? active.rowIndex : undefined,
                columnIndex: columnToScrollTo(active),
            });
        }
    });

    // ── the adapter ──────────────────────────────────────────────────────────

    const adapter: EngineAdapter<TRow, TNode> = {
        attach(element) {
            if (viewport === element && detachViewport) return detachViewport;
            detachViewport?.();
            viewport = element;
            VIEWPORTS.add(element);
            const view = element.ownerDocument.defaultView;
            readSize();
            const observer =
                view && "ResizeObserver" in view
                    ? new view.ResizeObserver(() => {
                          readSize();
                          relayout(false);
                      })
                    : null;
            observer?.observe(element);
            element.addEventListener("scroll", onScroll, { passive: true });
            element.addEventListener("wheel", onWheel, { passive: false });
            element.addEventListener("focusin", onFocusIn);
            element.addEventListener("pointerdown", onPointerDown, {
                capture: true,
            });
            const doc = element.ownerDocument;
            doc.addEventListener("pointerup", onPointerEnd, true);
            doc.addEventListener("pointercancel", onPointerEnd, true);
            element.addEventListener("focusout", onFocusOut);
            // the real mappings first, so a scroll already set (restored) is read, not reset
            rowsY.mapping = createScrollMapping(
                rowAxis.totalSize,
                bodyHeight(),
                maxScroll(),
            );
            columnsX.mapping = createScrollMapping(
                columnAxis.totalSize,
                width,
                maxScroll(),
            );
            rowsY.sync(element.scrollTop);
            columnsX.sync(element.scrollLeft);
            relayout(true);
            writeLayers();
            // what was asked before the grid had a size: a scroll to a cell, or the active cell
            const initial =
                pendingCellScroll ??
                (state.activePosition
                    ? {
                          rowIndex:
                              state.activePosition.rowIndex >= 0
                                  ? state.activePosition.rowIndex
                                  : undefined,
                          columnIndex: columnToScrollTo(state.activePosition),
                      }
                    : null);
            pendingCellScroll = null;
            if (initial) scrollToCell(initial);
            let attached = true;
            const detach = () => {
                if (!attached) return;
                attached = false;
                observer?.disconnect();
                element.removeEventListener("scroll", onScroll);
                element.removeEventListener("wheel", onWheel);
                element.removeEventListener("focusin", onFocusIn);
                element.removeEventListener("pointerdown", onPointerDown, {
                    capture: true,
                });
                doc.removeEventListener("pointerup", onPointerEnd, true);
                doc.removeEventListener("pointercancel", onPointerEnd, true);
                element.removeEventListener("focusout", onFocusOut);
                pointerDown = false;
                pendingFocus = false;
                if (viewport === element) {
                    // the committed view stays: a re-attach (StrictMode) shows the same layers
                    VIEWPORTS.delete(element);
                    viewport = null;
                    detachViewport = null;
                }
            };
            detachViewport = detach;
            return detach;
        },
        registerLayer(layer, element) {
            layers[layer].add(element);
            written.delete(element);
            writeLayers();
            return () => {
                layers[layer].delete(element);
                written.delete(element);
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
                rowsY.sync(viewport?.scrollTop ?? 0);
                columnsX.sync(viewport?.scrollLeft ?? 0);
                update();
            }
            writeLayers();
            flushFocus();
        },
        keydown,
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
    };

    const actions: {
        [K in EngineActionKey]: (payload: EngineActionMap[K]) => void;
    } = {
        "scroll-to-cell": scrollToCell,
        "scroll-to": scrollTo,
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

/** A body row's top in its layer. */
export function rowTop<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): number {
    return view.rowAxis.offsetOf(rowIndex) - view.rowBase;
}

/** A column's left in its layer (the same in the header and in every row). */
export function columnLeft<TRow, TNode>(
    view: GridView<TRow, TNode>,
    columnIndex: number,
): number {
    return view.columnAxis.offsetOf(columnIndex) - view.columnBase;
}

/** The width of a row's rendered cells: from the layer's start to the last rendered column's end. */
export function renderedWidth<TRow, TNode>(
    view: GridView<TRow, TNode>,
): number {
    const last = view.columns[view.columns.length - 1];
    if (last === undefined) return 0;
    return view.columnAxis.offsetOf(last + 1) - view.columnBase;
}

/**
 * A header cell's box in the header layer: its row's top, its first column's left, as wide as its
 * columns and as tall as its rows. When the columns' scroll is scaled, a group can be wider than a
 * browser lays out: its box is then cut to the rendered columns (they reach past the view).
 */
export function headerCellBox<TRow, TNode>(
    view: GridView<TRow, TNode>,
    cell: HeaderCellLayout<TRow, TNode>,
): {
    readonly top: number;
    readonly left: number;
    readonly width: number;
    readonly height: number;
} {
    const axis = view.columnAxis;
    const from = cell.columnIndex;
    const to = cell.columnIndex + cell.columnSpan;
    let start = axis.offsetOf(from);
    let end = axis.offsetOf(to);
    if (axis.totalSize > view.width) {
        // the rendered columns it reaches into, or the active column it is rendered for
        const rendered = view.renderedColumns;
        const reaches = from < rendered.end && to > rendered.start;
        const extra = view.columns.find(
            (c) =>
                (c < rendered.start || c >= rendered.end) &&
                c >= from &&
                c < to,
        );
        const clipFrom = reaches ? rendered.start : (extra ?? from);
        const clipTo = reaches ? rendered.end : (extra ?? from) + 1;
        start = Math.max(start, axis.offsetOf(clipFrom));
        end = Math.min(end, axis.offsetOf(clipTo));
    }
    return {
        top: (cell.rowIndex + view.headerRowCount) * view.headerRowHeight,
        left: start - view.columnBase,
        width: Math.max(0, end - start),
        height: cell.rowSpan * view.headerRowHeight,
    };
}

/** A header cell's `aria-colspan` and `aria-rowspan`, each only when it spans more than one. */
export function ariaHeaderCellSpans<TRow, TNode>(
    cell: HeaderCellLayout<TRow, TNode>,
): { readonly "aria-colspan"?: number; readonly "aria-rowspan"?: number } {
    return {
        ...(cell.columnSpan > 1 ? { "aria-colspan": cell.columnSpan } : {}),
        ...(cell.rowSpan > 1 ? { "aria-rowspan": cell.rowSpan } : {}),
    };
}

/** The grid's `aria-rowcount`: the header rows and every body row. */
export function ariaRowCount<TRow, TNode>(view: GridView<TRow, TNode>): number {
    return view.rowCount + view.headerRowCount;
}

/** A row's `aria-rowindex`: 1-based, the header rows first (they are -depth … -1). */
export function ariaRowIndex<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): number {
    return rowIndex + view.headerRowCount + 1;
}
