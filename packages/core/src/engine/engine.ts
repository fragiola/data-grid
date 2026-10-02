import { type Axis, createAxis } from "../axis/axis";
import type { DataGridModel } from "../model/model";
import type {
    CellPosition,
    Column,
    DataGridState,
    RowSource,
} from "../model/types";
import type { Direction } from "../navigation/navigation";
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
    readonly headerHeight: number;
    readonly headerRowCount: number;
    readonly rowCount: number;
    readonly columnCount: number;
    readonly rowAxis: Axis;
    readonly columnAxis: Axis;
    readonly columnDefs: readonly Column<TRow, TNode>[];
    readonly source: RowSource<TRow>;
    readonly active: CellPosition | null;
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
    /** registers a layer element; returns the unregistration */
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
    const layers: Partial<Record<EngineLayer, HTMLElement>> = {};
    let detachViewport: (() => void) | null = null;

    let state = model.state;
    let rowAxis = rowAxisOf(state);
    let columnAxis = columnAxisOf(state);
    let width = 0;
    let height = 0;

    const maxScroll = () => options.maxScrollSize ?? DEFAULT_MAX_SCROLL_SIZE;
    const headerHeight = () =>
        state.headerRowHeight > 0 ? state.headerRowHeight : 0;
    const bodyHeight = () => Math.max(0, height - headerHeight());
    const rowsY = new ScrollAxisState(createScrollMapping(0, 0));
    const columnsX = new ScrollAxisState(createScrollMapping(0, 0));

    let rowWindow: AxisWindow = EMPTY_WINDOW;
    let columnWindow: AxisWindow = EMPTY_WINDOW;
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

    function makeView(): GridView<TRow, TNode> {
        const active = state.activePosition;
        const activeRow =
            active && active.rowIndex >= 0 ? active.rowIndex : null;
        return {
            rows: indexes(
                rowWindow.rendered.start,
                rowWindow.rendered.end,
                activeRow,
            ),
            columns: indexes(
                columnWindow.rendered.start,
                columnWindow.rendered.end,
                active ? active.columnIndex : null,
            ),
            renderedRows: rowWindow.rendered,
            renderedColumns: columnWindow.rendered,
            rowBase: rowAxis.offsetOf(rowWindow.rendered.start),
            columnBase: columnAxis.offsetOf(columnWindow.rendered.start),
            width: columnsX.mapping.physicalSize,
            height: rowsY.mapping.physicalSize,
            headerHeight: headerHeight(),
            headerRowCount: state.headerRowHeight > 0 ? 1 : 0,
            rowCount: state.rowCount,
            columnCount: state.columns.length,
            rowAxis,
            columnAxis,
            columnDefs: state.columns,
            source: state.source,
            active,
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
            current.rowAxis !== next.rowAxis ||
            current.columnAxis !== next.columnAxis ||
            current.columnDefs !== next.columnDefs ||
            current.source !== next.source ||
            current.active !== next.active
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

    const written: Partial<Record<EngineLayer, string>> = {};

    function setTransform(layer: EngineLayer, transform: string) {
        const element = layers[layer];
        if (!element || written[layer] === transform) return;
        written[layer] = transform;
        element.style.transform = transform;
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
        if (!viewport || event.ctrlKey) return;
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
        const cell = viewport.querySelector<HTMLElement>(
            cellSelector(position),
        );
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
                ? rowWindow.visible.start
                : state.headerRowHeight > 0
                  ? -1
                  : null;
        if (rowIndex === null) return null;
        return { rowIndex, columnIndex: columnWindow.visible.start };
    }

    function inViewport(target: EventTarget | null): boolean {
        return Boolean(
            viewport &&
                target &&
                typeof target === "object" &&
                "nodeType" in target &&
                viewport.contains(target as unknown as Element),
        );
    }

    function cellOf(target: EventTarget | null): CellPosition | null {
        if (!viewport || !target || typeof target !== "object") return null;
        if (!("closest" in target) || typeof target.closest !== "function")
            return null;
        const cell = (target as Element).closest(
            "[data-row-index][data-column-index]",
        );
        if (!cell || !viewport.contains(cell)) return null;
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
                columnIndex: cell.columnIndex,
            });
        }
        if (cell) {
            const active = state.activePosition;
            if (
                active?.rowIndex !== cell.rowIndex ||
                active.columnIndex !== cell.columnIndex
            ) {
                model.run("active-position.set", cell);
            }
            return;
        }
        // the grid or the scroll container itself took focus (Tab into the grid; Firefox makes a
        // scroll container a tab stop): hand it to the active cell, or the first in view
        if (event.target !== layers.grid && event.target !== viewport) return;
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
        // a key typed into a field inside a cell is the field's, and a key from outside the grid
        // (a menu portalled out of a cell, whose events still bubble through the cell) is not ours
        if (
            event.defaultPrevented ||
            event.altKey ||
            isEditable(event.target) ||
            !inViewport(event.target)
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
        });
        // the move may have been refused or landed where it was: focus stays where it is
        flushFocus();
        return true;
    }

    // ── the model ────────────────────────────────────────────────────────────

    const unsubscribeModel = model.subscribe(({ before, after }) => {
        state = after;
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
        if (after.headerRowHeight !== before.headerRowHeight) fresh = true;
        relayout(fresh);
        const active = after.activePosition;
        if (active && active !== before.activePosition) {
            if (focusInside()) pendingFocus = true;
            scrollToCell({
                rowIndex: active.rowIndex >= 0 ? active.rowIndex : undefined,
                columnIndex: active.columnIndex,
            });
        }
    });

    // ── the adapter ──────────────────────────────────────────────────────────

    const adapter: EngineAdapter<TRow, TNode> = {
        attach(element) {
            if (viewport === element && detachViewport) return detachViewport;
            detachViewport?.();
            viewport = element;
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
                          columnIndex: state.activePosition.columnIndex,
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
                    viewport = null;
                    detachViewport = null;
                }
            };
            detachViewport = detach;
            return detach;
        },
        registerLayer(layer, element) {
            layers[layer] = element;
            delete written[layer];
            writeLayers();
            return () => {
                if (layers[layer] === element) {
                    delete layers[layer];
                    delete written[layer];
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

/** The grid's `aria-rowcount`: the header row and every body row. */
export function ariaRowCount<TRow, TNode>(view: GridView<TRow, TNode>): number {
    return view.rowCount + view.headerRowCount;
}

/** A row's `aria-rowindex`: 1-based, the header row first (pass -1 for the header). */
export function ariaRowIndex<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): number {
    return rowIndex + view.headerRowCount + 1;
}
