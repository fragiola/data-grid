import type { Axis } from "../axis/axis";
import { headerRowCount, pinnedColumnCount } from "../header/header";
import { detailsChanged } from "../model/expansion";
import type { DataGridModel } from "../model/model";
import type { CellPosition, Column } from "../model/types";
import { sameCell } from "../navigation/navigation";
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
    CTRL_KEYS,
    cellSelector,
    isCellNode,
    isControl,
    isEditable,
    isElement,
    isPagelessControl,
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
        if (!viewport || !isElement(target)) return null;
        let cell: Element | null = null;
        let node: Element | null = target;
        for (; node && node !== viewport; node = node.parentElement) {
            // below another grid's viewport: whatever was found belongs to that grid
            if (VIEWPORTS.has(node)) cell = null;
            else if (!cell && isCellNode(node)) cell = node;
        }
        if (node !== viewport || !cell) return null;
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
    }

    /**
     * The sortable column whose header cell an event happened in, or `null`: not a header cell, a
     * group, a column that is not sortable, or a control inside the cell (it acts on its own).
     */
    function sortableColumnOf(
        target: EventTarget | null,
    ): Column<TRow, TNode> | null {
        const cell = cellOf(target);
        if (!cell || cell.rowIndex >= 0 || !isElement(target)) return null;
        for (
            let node: Element | null = target;
            node && !isCellNode(node);
            node = node.parentElement
        ) {
            if (isControl(node)) return null;
        }
        const column = state.header.cellAt(
            cell.rowIndex,
            cell.columnIndex,
        )?.column;
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
        // a press the browser took over makes no click
        if (event.type === "pointercancel") pressedAt = null;
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
    function anchorOf(axis: Axis): { rowIndex: number; within: number } | null {
        if (axis.count === 0 || rowsY.virtual <= 0) return null;
        const rowIndex = axis.indexAt(rowsY.virtual);
        return { rowIndex, within: rowsY.virtual - axis.offsetOf(rowIndex) };
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
            const anchor = rowsResized ? null : anchorOf(rowAxis);
            rowAxis = withDetails(baseRowAxis, after);
            // a row expanding or collapsing above the view keeps the view where it is (M2)
            if (anchor) {
                rowsY.virtual =
                    rowAxis.offsetOf(anchor.rowIndex) +
                    Math.min(anchor.within, rowAxis.sizeOf(anchor.rowIndex));
                anchored = true;
            }
        }
        const columnsChanged = after.columns !== before.columns;
        if (columnsChanged) {
            columnAxis = columnAxisOf(after);
            updatePinning();
        }
        relayout(
            rowsResized ||
                changedDetails ||
                columnsChanged ||
                after.headerRowHeight !== before.headerRowHeight ||
                after.header !== before.header,
        );
        if (anchored) {
            // the physical scroll follows even when the total did not change (no remap moved it)
            const top = rowsY.scrollTo(rowsY.virtual);
            if (Math.abs(top - (viewport?.scrollTop ?? 0)) > 0.5) {
                scrollWhenReady({ top });
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
