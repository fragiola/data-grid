import { type Axis, createAxis, withExtraSizes } from "../axis/axis";
import { headerCellsIn, pinnedColumnCount } from "../header/header";
import { holdsRow, holdsRowIn } from "../model/expansion";
import type { DataGridModel } from "../model/model";
import { isRowSelectable, isRowSelected } from "../model/selection";
import { rowAt } from "../model/source";
import type {
    CellPosition,
    Column,
    DataGridState,
    HeaderCellLayout,
    HeaderLayout,
    RowKey,
    RowKeyGetter,
    RowSelectable,
    RowSelection,
    RowSource,
    SortColumn,
    SortDirection,
} from "../model/types";
import { type Direction, sameCell } from "../navigation/navigation";
import {
    createScrollMapping,
    DEFAULT_MAX_SCROLL_SIZE,
    ScrollAxisState,
} from "../viewport/scaling";
import {
    type ScrollAlign,
    scrollTargetForSpan,
} from "../viewport/scroll-target";
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
    /** the rows' sizes and offsets: an expanded row's size holds its detail (`extraSizeOf`) */
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
    /** the sorted columns, the first one first */
    readonly sortColumns: readonly SortColumn[];
    /** how many columns are pinned at the start (always rendered, in `columns` first) */
    readonly pinnedColumnCount: number;
    /** their width: the column window covers the view right of it */
    readonly pinnedWidth: number;
    /** the indexes of the rows shown expanded, ascending (loaded, their key expanded) */
    readonly expandedRows: readonly number[];
    /** a row's key: `rowKey`, else its index */
    readonly rowKey: RowKeyGetter<TRow> | undefined;
    /** how rows are selected; `undefined` when they are not */
    readonly rowSelection: RowSelection | undefined;
    /** the selected rows' keys (`rowSelected` tells a row's state) */
    readonly selectedRowKeys: readonly RowKey[];
    /** whether a loaded row can be selected; `undefined`: every row can */
    readonly isRowSelectable: RowSelectable<TRow> | undefined;
    /**
     * the cell whose controls have the keys (Enter or F2 on it, a click on one of them; Escape
     * leaves), at its element's position (a header cell's top row and first column); `null` in
     * navigation
     */
    readonly interaction: CellPosition | null;
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
    /** the cell whose controls have the keys, or `null` (see `GridView.interaction`) */
    interaction: CellPosition | null;
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
    /**
     * makes a cell active and hands the keys to its controls, focusing the first one (as Enter
     * or F2 on it does); a cell without controls stays in navigation
     */
    "interact-cell": CellPosition;
    /** gives the keys back to the grid and focuses the cell (as Escape does) */
    "leave-cell": Record<string, never>;
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
    /** a cell's controls got the keys (the cell), or gave them back (`null`) */
    interaction: CellPosition | null;
}

export type EngineEventKey = keyof EngineEventMap;

/**
 * The elements whose geometry the engine writes: the layers (their `transform`), and the cells of
 * pinned columns (`pinned`: `position: sticky` in their row's flow, whose `left` inset the engine
 * writes so the browser's scrolling keeps them at the view's start; their `data-column-index`
 * says which column they are, a header cell's first), and expanded rows' details (`detail`:
 * sticky the same way, at the view's start: as a column at offset 0 would be).
 */
export type EngineLayer = "grid" | "header" | "body" | "pinned" | "detail";

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
    /**
     * Handles a click in the grid: on a sortable column's header cell, it toggles the sort
     * (Ctrl/⌘ adds the column). Returns whether the click was the grid's: a toggle ran, even
     * when a middleware or a controlled parent declined it. Like `keydown`, an adapter calls it
     * after the consumer's own handlers, so `preventDefault` cancels it.
     */
    click(event: MouseEvent): boolean;
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

/**
 * Roles of controls that act on their own, and of widgets holding them (a popover, a menu, a
 * toolbar): a click or a key in one is the widget's.
 */
const CONTROL_ROLES = new Set([
    "dialog",
    "alertdialog",
    "menu",
    "menubar",
    "listbox",
    "toolbar",
    "tablist",
    "radiogroup",
    "tree",
    "grid",
    "treegrid",
    "button",
    "link",
    "checkbox",
    "switch",
    "radio",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "option",
    "combobox",
    "slider",
    "spinbutton",
    "tab",
    "textbox",
]);

/** Whether an element is a control of its own (a button, a link, a field, a menu trigger). */
function isControl(element: Element): boolean {
    // upper case in HTML, as written in SVG (`a`)
    const tag = element.tagName.toUpperCase();
    if (
        tag === "BUTTON" ||
        tag === "INPUT" ||
        tag === "SELECT" ||
        tag === "TEXTAREA" ||
        tag === "SUMMARY" ||
        tag === "LABEL" ||
        (tag === "A" && element.hasAttribute("href"))
    ) {
        return true;
    }
    const role = element.getAttribute("role");
    return (
        (role !== null && CONTROL_ROLES.has(role)) ||
        (element as HTMLElement).isContentEditable === true
    );
}

/** What takes focus in a cell: its controls (the grid moves between them in interaction). */
const FOCUSABLE = [
    "a[href]",
    "area[href]",
    "button",
    "input",
    "select",
    "textarea",
    "summary",
    "iframe",
    "audio[controls]",
    "video[controls]",
    "[tabindex]",
    '[contenteditable]:not([contenteditable="false"])',
].join(",");

/**
 * A control the app keeps as a tab stop of its own: the grid leaves its `tabindex` alone outside
 * interaction (Epic #52, I4).
 */
export const TAB_STOP_ATTRIBUTE = "data-grid-tab-stop";

/** The keys a scroll container pages itself by. */
const PAGE_KEYS = new Set([
    "PageUp",
    "PageDown",
    "Home",
    "End",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
]);

/** Whether a control moves through its group with the arrows (a radio, a menu item, a tab). */
function movesWithArrows(element: Element): boolean {
    const role = element.getAttribute("role");
    return (
        (element.tagName.toUpperCase() === "INPUT" &&
            element.getAttribute("type")?.toLowerCase() === "radio") ||
        role === "radio" ||
        role === "menuitem" ||
        role === "tab"
    );
}

/** Roles of controls with no use for the page keys (a button, a link, a box to check). */
const PAGELESS_ROLES = new Set([
    "button",
    "link",
    "checkbox",
    "switch",
    "radio",
    "menuitem",
    "tab",
]);

/**
 * Whether a control has no use for the page keys (they would page the grid's container): a
 * button, a link, a box to check. A field, a list, media or a scrolling element keeps them.
 */
function isPagelessControl(element: Element): boolean {
    const tag = element.tagName.toUpperCase();
    if (tag === "BUTTON" || tag === "SUMMARY" || tag === "A") return true;
    if (tag === "INPUT") {
        const type = (element.getAttribute("type") ?? "text").toLowerCase();
        return ["checkbox", "radio", "button", "submit", "reset"].includes(
            type,
        );
    }
    const role = element.getAttribute("role");
    return role !== null && PAGELESS_ROLES.has(role);
}

/** How far a press may move before its click is a drag (a text selection), in pixels. */
const CLICK_SLOP = 4;

function rowAxisOf<TRow, TNode>(state: DataGridState<TRow, TNode>): Axis {
    return createAxis(state.rowCount, state.rowHeight);
}

/** The rows' axis with the expanded rows' details on top of their own heights (M2). */
function withDetails<TRow, TNode>(
    base: Axis,
    state: DataGridState<TRow, TNode>,
): Axis {
    if (state.expandedRows.length === 0) return base;
    const { detailHeight } = state;
    return withExtraSizes(
        base,
        state.expandedRows.map((index) => {
            const row = rowAt(state.source, index);
            return {
                index,
                size:
                    typeof detailHeight === "number"
                        ? detailHeight
                        : row === undefined
                          ? 0
                          : detailHeight(row, index),
            };
        }),
    );
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
        pinned: new Set(),
        detail: new Set(),
    };
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
        pinned: number;
        rows: readonly HeaderRowView<TRow, TNode>[];
    } | null = null;

    let rowWindow: AxisWindow = EMPTY_WINDOW;
    let columnWindow: AxisWindow = EMPTY_WINDOW;
    /** the view's `rowsRevision`: only a change to rows on screen moves it */
    let rowsRevision = 0;
    /** the cell whose controls have the keys (its element's position), or `null` */
    let interaction: CellPosition | null = null;
    /** a cell `interact-cell` asked for before it was rendered: entered on the commit that shows it */
    let pendingInteraction: { position: CellPosition; focus: boolean } | null =
        null;
    /** the controls' own `tabindex` (`null`: none), kept while the grid holds them at -1 */
    const ownTabIndex = new WeakMap<Element, string | null>();
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
    /** where the last press started, to tell a click from a drag */
    let pressedAt: { x: number; y: number } | null = null;
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

    /** A column window without the pinned columns (the overscan may reach into them). */
    function scrollingWindow(columns: AxisWindow): AxisWindow {
        const { visible, rendered } = columns;
        if (rendered.start >= pinnedCount) return columns;
        const clamp = (range: Range): Range =>
            range.start >= pinnedCount
                ? range
                : {
                      start: pinnedCount,
                      end: Math.max(range.end, pinnedCount),
                  };
        return { visible: clamp(visible), rendered: clamp(rendered) };
    }

    /**
     * The column rendered outside the window for the active cell: its own, or none for a header
     * cell whose span reaches into the window (it is rendered with the window's cells).
     */
    function activeColumn(): number | null {
        const active = state.activePosition;
        // a pinned column is always rendered
        if (!active || active.columnIndex < pinnedCount) return null;
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
            memo.extra === extra &&
            memo.pinned === pinnedCount
        ) {
            return memo.rows;
        }
        // the pinned columns' cells first: a pinned group holds only pinned columns
        const pinned =
            pinnedCount > 0 ? headerCellsIn(state.header, 0, pinnedCount) : [];
        const rows =
            count > 0
                ? headerCellsIn(state.header, start, end, extra).map(
                      (cells, level) => ({
                          rowIndex: level - count,
                          cells: [...(pinned[level] ?? []), ...cells],
                      }),
                  )
                : [];
        headerRowsMemo = {
            header: state.header,
            count,
            start,
            end,
            extra,
            pinned: pinnedCount,
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
            // the pinned columns first, always rendered
            columns: [
                ...indexes(0, pinnedCount, null),
                ...indexes(
                    columnWindow.rendered.start,
                    columnWindow.rendered.end,
                    extraColumn,
                ),
            ],
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
            sortColumns: state.sortColumns,
            pinnedColumnCount: pinnedCount,
            pinnedWidth,
            expandedRows: state.expandedRows,
            rowKey: state.rowKey,
            rowSelection: state.rowSelection,
            selectedRowKeys: state.selectedRowKeys,
            isRowSelectable: state.isRowSelectable,
            interaction,
        };
    }

    /** Whether a view renders an expanded row (its rendered rows, or the active row). */
    function rendersDetail(next: GridView<TRow, TNode>): boolean {
        const { expandedRows, renderedRows, active } = next;
        if (expandedRows.length === 0) return false;
        return (
            holdsRowIn(expandedRows, renderedRows.start, renderedRows.end) ||
            (active !== null && holdsRow(expandedRows, active.rowIndex))
        );
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
            // the visible area matters only to an empty grid, and its width to the details on
            // screen (as wide as the view): a resize alone renders nothing else
            ((current.rowCount === 0 || next.rowCount === 0) &&
                (current.viewportWidth !== next.viewportWidth ||
                    current.viewportBodyHeight !== next.viewportBodyHeight)) ||
            (current.viewportWidth !== next.viewportWidth &&
                rendersDetail(next)) ||
            current.rowAxis !== next.rowAxis ||
            current.columnAxis !== next.columnAxis ||
            current.columnDefs !== next.columnDefs ||
            current.source !== next.source ||
            current.active !== next.active ||
            current.rowsRevision !== next.rowsRevision ||
            current.sortColumns !== next.sortColumns ||
            current.pinnedColumnCount !== next.pinnedColumnCount ||
            current.expandedRows !== next.expandedRows ||
            current.rowKey !== next.rowKey ||
            current.rowSelection !== next.rowSelection ||
            current.selectedRowKeys !== next.selectedRowKeys ||
            current.isRowSelectable !== next.isRowSelectable ||
            current.interaction !== next.interaction
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
        // the columns that scroll, in the view right of the pinned ones
        const nextColumns = scrollingWindow(
            windowFor(
                columnAxis,
                columnsX.virtual + pinnedWidth,
                width - pinnedWidth,
                overscan.columns ?? 2,
                fresh ? undefined : columnWindow,
            ),
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
        for (const element of layers[layer]) write(element, transform);
    }

    function write(element: HTMLElement, transform: string) {
        if (written.get(element) === transform) return;
        written.set(element, transform);
        element.style.transform = transform;
    }

    /**
     * The layers' offsets for the view on screen, and its column axis (none before one is
     * committed): what is in view is the virtual offset's content, wherever the physical scroll
     * stands.
     */
    function layerOffsets(): { x: number; y: number; columnAxis: Axis } | null {
        if (!viewport || !committed) return null;
        return {
            x: columnsX.layerOffset(committed.columnBase, viewport.scrollLeft),
            y: rowsY.layerOffset(committed.rowBase, viewport.scrollTop),
            columnAxis: committed.columnAxis,
        };
    }

    /** A layer's transform for offsets `x` and `y`: the header moves with the columns only. */
    function layerTransform(
        layer: "body" | "header",
        x: number,
        y: number,
    ): string {
        return `translate3d(${x}px, ${layer === "body" ? y : 0}px, 0px)`;
    }

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

    function writeLayers() {
        const offsets = layerOffsets();
        if (!offsets) return;
        const { x, y, columnAxis } = offsets;
        setTransform("body", layerTransform("body", x, y));
        setTransform("header", layerTransform("header", x, y));
        writeInsets(x, columnAxis);
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
            // the row's cells: its detail below them is not what a move goes to
            const start = rowAxis.offsetOf(rowIndex);
            const target = scrollTargetForSpan(
                start,
                start +
                    rowAxis.sizeOf(rowIndex) -
                    rowAxis.extraSizeOf(rowIndex),
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
                moves.left = columnsX.scrollTo(
                    Math.min(
                        Math.max(target - pinnedWidth, 0),
                        Math.max(0, columnAxis.totalSize - width),
                    ),
                );
            }
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
        // a pinned group is always in view
        if (cell.columnIndex + cell.columnSpan <= pinnedCount) return undefined;
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
     * The first row in view whose cells are: one whose cells scrolled above the view while its
     * detail shows is passed over (when a row follows it).
     */
    function firstRowWithCellsInView(): number {
        const first = rowWindow.visible.start;
        const cellsEnd =
            rowAxis.offsetOf(first) +
            rowAxis.sizeOf(first) -
            rowAxis.extraSizeOf(first);
        // the next row only when it is in view too (a detail may fill the view)
        return cellsEnd <= rowsY.virtual && first + 1 < rowWindow.visible.end
            ? first + 1
            : first;
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
        // the layers that hold rows: a detail's keys are its content's (a pinned cell is a cell)
        const owned: ReadonlySet<Element>[] = [
            layers.grid,
            layers.header,
            layers.body,
        ];
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

    // ── interaction: a cell's controls have the keys (Epic #52) ──────────────

    /** This grid's own element of a cell (a nested grid may have one at the same indexes). */
    function cellElement(position: CellPosition): HTMLElement | null {
        if (!viewport) return null;
        const owned = viewport;
        return (
            [
                ...viewport.querySelectorAll<HTMLElement>(
                    cellSelector(elementPosition(position)),
                ),
            ].find((element) => ownerViewport(element) === owned) ?? null
        );
    }

    /** Whether an element is one of this grid's cells (or header cells) itself. */
    function isCellElement(element: Element): boolean {
        return (
            element.hasAttribute("data-row-index") &&
            element.hasAttribute("data-column-index") &&
            ownerViewport(element) === viewport
        );
    }

    /**
     * A cell's controls, in order: what takes focus inside it, its own (a nested grid's are that
     * grid's), and not disabled.
     */
    function controlsOf(cell: Element): HTMLElement[] {
        const owned = viewport;
        return [...cell.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
            (element) =>
                ownerViewport(element) === owned &&
                cellElementOf(element) === cell &&
                // the app's own tab stop is no control of the grid's: never cycled, never entered
                !element.hasAttribute(TAB_STOP_ATTRIBUTE) &&
                !element.hasAttribute("disabled") &&
                !(
                    element.tagName === "INPUT" &&
                    element.getAttribute("type") === "hidden"
                ) &&
                // an element the app took out itself (a wrapper at -1) is no stop of its own
                !(
                    element.getAttribute("tabindex") === "-1" &&
                    !ownTabIndex.has(element)
                ) &&
                !hiddenWithin(element, cell),
        );
    }

    /** Whether an element is hidden or inert inside its cell (what is outside the grid aside). */
    function hiddenWithin(element: Element, cell: Element): boolean {
        for (
            let node: Element | null = element;
            node && node !== cell;
            node = node.parentElement
        ) {
            if (node.hasAttribute("hidden") || node.hasAttribute("inert")) {
                return true;
            }
        }
        return false;
    }

    /** The nearest cell of this grid holding an element (itself excluded). */
    function cellElementOf(element: Element): Element | null {
        for (
            let node = element.parentElement;
            node && node !== viewport;
            node = node.parentElement
        ) {
            if (VIEWPORTS.has(node)) return null;
            if (
                node.hasAttribute("data-row-index") &&
                node.hasAttribute("data-column-index")
            ) {
                return node;
            }
        }
        return null;
    }

    /**
     * Keeps a cell's controls out of the tab order outside interaction (`tabindex` -1, their own
     * value kept), and gives it back in interaction. A control with `TAB_STOP_ATTRIBUTE` is the
     * app's.
     */
    function manageTabOrder(cell: Element) {
        const position = cellOf(cell);
        const interacting =
            interaction !== null &&
            position !== null &&
            sameCell(interaction, position, state.header.cellAt);
        for (const control of controlsOf(cell)) {
            if (interacting) restoreTabIndex(control);
            else if (control.getAttribute("tabindex") !== "-1") {
                ownTabIndex.set(control, control.getAttribute("tabindex"));
                writeTabIndex(control, "-1");
            }
        }
        // a control the app marked as its own stop after the grid took it out: its value back
        for (const own of cell.querySelectorAll(`[${TAB_STOP_ATTRIBUTE}]`)) {
            restoreTabIndex(own);
        }
    }

    /** A control's own tab index back, if the grid holds it at -1. */
    function restoreTabIndex(control: Element) {
        if (!ownTabIndex.has(control)) return;
        const own = ownTabIndex.get(control) ?? null;
        ownTabIndex.delete(control);
        writeTabIndex(control, own);
    }

    /** What the grid wrote to a control's `tabindex`: its own change, which the observer skips. */
    const writtenTabIndex = new WeakMap<Element, string | null>();

    function writeTabIndex(control: Element, value: string | null) {
        writtenTabIndex.set(control, value);
        if (value === null) control.removeAttribute("tabindex");
        else control.setAttribute("tabindex", value);
    }

    /** Every cell of this grid under a node (the node itself included). */
    function cellsUnder(node: Node): Element[] {
        if (!isElement(node)) return [];
        const cells = [
            ...node.querySelectorAll("[data-row-index][data-column-index]"),
        ];
        if (
            node.hasAttribute("data-row-index") &&
            node.hasAttribute("data-column-index")
        ) {
            cells.unshift(node);
        }
        return cells.filter((cell) => ownerViewport(cell) === viewport);
    }

    /** The cells a set of DOM changes touched: rendered, or whose content changed. */
    function onMutations(records: readonly MutationRecord[]) {
        const touched = new Set<Element>();
        let moved = false;
        for (const record of records) {
            const target = record.target;
            if (isElement(target)) {
                const name = record.attributeName;
                // the grid's own write, and a cell's own roving tab index, change no control
                if (
                    name === "tabindex" &&
                    (isCellElement(target) ||
                        writtenTabIndex.get(target) ===
                            target.getAttribute("tabindex"))
                ) {
                    continue;
                }
                if (name === "data-row-index" || name === "data-column-index") {
                    moved = true;
                }
                const holder = isCellElement(target)
                    ? target
                    : cellElementOf(target);
                if (holder) touched.add(holder);
            }
            for (const added of record.addedNodes) {
                for (const cell of cellsUnder(added)) touched.add(cell);
            }
        }
        // the cell in interaction moved to another index (a keyed row re-sorted): the
        // interaction follows the cell that holds focus, as the active cell
        if (moved && interaction) followFocusedCell();
        for (const cell of touched) manageTabOrder(cell);
    }

    /** After cells moved: the interaction goes with the cell holding focus, or ends. */
    function followFocusedCell() {
        const focused = viewport?.ownerDocument.activeElement;
        const holder = focused ? cellElementOf(focused) : null;
        const now = holder ? cellOf(holder) : null;
        if (
            now &&
            interaction &&
            sameCell(now, interaction, state.header.cellAt)
        ) {
            return;
        }
        interaction = null;
        if (now) enterCell(now, false);
        else emitInteraction();
    }

    function emitInteraction() {
        update();
        emit("interaction", interaction);
    }

    /**
     * Hands the keys to a cell's controls. `focus`: the first control takes focus (Enter, F2,
     * the action); a control that took focus itself keeps it. Returns whether it did.
     */
    function enterCell(
        position: CellPosition,
        focus: boolean,
        activate = true,
    ): boolean {
        const cell = cellElement(position);
        if (!cell) return false;
        const controls = controlsOf(cell);
        if (controls.length === 0) return false;
        const at = cellOf(cell) ?? position;
        const active = state.activePosition;
        if (!active || !sameCell(active, at, state.header.cellAt)) {
            // asked once: a caller that asked already (a focus) waits for the answer instead
            if (activate) model.run("active-position.set", at);
            // the cell in interaction is always the active one: a controlled parent that follows
            // later makes it so (the entry waits for it); a middleware that redirected it, never
            const now = state.activePosition;
            if (!now || !sameCell(now, at, state.header.cellAt)) {
                pendingInteraction = { position: at, focus };
                return false;
            }
        }
        const before = interaction;
        const previous = interaction ? cellElement(interaction) : null;
        interaction = at;
        pendingInteraction = null;
        if (previous && previous !== cell) manageTabOrder(previous);
        manageTabOrder(cell);
        // the first control that takes focus (one hidden by the app's CSS cannot): none, and the
        // cell stays in navigation
        if (focus && !focusFrom(controls, 0, 1)) {
            interaction = null;
            manageTabOrder(cell);
            if (before) emitInteraction();
            return false;
        }
        emitInteraction();
        return true;
    }

    /**
     * Focuses the first of `controls` that takes focus, from `start` in `step` direction,
     * wrapping; returns whether one did.
     */
    function focusFrom(
        controls: readonly HTMLElement[],
        start: number,
        step: 1 | -1,
    ): boolean {
        const doc = viewport?.ownerDocument;
        for (let tried = 0; tried < controls.length; tried++) {
            const index =
                (((start + tried * step) % controls.length) + controls.length) %
                controls.length;
            const control = controls[index];
            control?.focus();
            if (control && doc?.activeElement === control) return true;
        }
        return false;
    }

    /** Gives the keys back to the grid; `focusCell`: the cell takes focus (Escape, the action). */
    function leaveCell(focusCell: boolean) {
        if (!interaction) return;
        const cell = cellElement(interaction);
        interaction = null;
        if (cell) {
            manageTabOrder(cell);
            if (focusCell) cell.focus({ preventScroll: true });
        }
        emitInteraction();
    }

    /** Tab and Shift+Tab in interaction: the cell's next or previous control, wrapping around. */
    function cycleControls(
        cell: Element,
        from: EventTarget | null,
        back: boolean,
    ) {
        const controls = controlsOf(cell);
        if (controls.length === 0) return;
        // the control itself, else the innermost one holding it (a wrapper holds its buttons)
        let at = controls.findIndex((control) => control === from);
        if (at < 0) {
            controls.forEach((control, i) => {
                if (isElement(from) && control.contains(from)) at = i;
            });
        }
        const back1 = back ? -1 : 1;
        const start = at < 0 ? (back ? controls.length - 1 : 0) : at + back1;
        // a control that cannot take focus (hidden by the app's CSS) is passed over
        focusFrom(controls, start, back1);
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
            node &&
            !(
                node.hasAttribute("data-row-index") &&
                node.hasAttribute("data-column-index")
            );
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

    function toggleSort(column: Column<TRow, TNode>, multi: boolean) {
        model.run("sort-columns.toggle", { columnKey: column.key, multi });
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
        toggleSort(column, event.ctrlKey || event.metaKey);
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
        // focus leaving the cell in interaction (elsewhere in the page, a portal): navigation
        // focus gone from the grid: an entry waiting for its cell would pull it back, it is dropped
        if (
            pendingInteraction &&
            !(isElement(next) && viewport?.contains(next)) &&
            viewport?.ownerDocument.hasFocus() !== false
        ) {
            pendingInteraction = null;
        }
        // (the window losing focus, alt-tab or the devtools, is no leaving: focus comes back)
        const windowBlur =
            next === null && viewport?.ownerDocument.hasFocus() === false;
        if (interaction && !windowBlur) {
            const cell = cellElement(interaction);
            if (!cell || !(isElement(next) && cell.contains(next))) {
                leaveCell(false);
            }
        }
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
            const target = event.target;
            if (
                isElement(target) &&
                !isCellElement(target) &&
                !target.hasAttribute(TAB_STOP_ATTRIBUTE)
            ) {
                // a control took focus (a click, a Tab in the cell): its cell is in interaction
                if (
                    !interaction ||
                    !sameCell(interaction, cell, state.header.cellAt)
                ) {
                    // the activation was asked above: not twice (a controlled parent reports it)
                    enterCell(cell, false, false);
                }
            } else if (interaction) {
                // the cell itself (or another one) took focus: back to navigation
                leaveCell(false);
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

    /**
     * The selection's keys on a body cell (R6), rows being selectable: Shift+Space toggles its
     * row, Shift+Up/Down (many rows) move and extend the selection to the row reached, Ctrl/⌘+A
     * selects every row. Each goes through a command, so a middleware can refuse it.
     */
    function selectionKey(event: KeyboardEvent): boolean {
        const mode = state.rowSelection;
        const target = event.target;
        if (!mode || !isElement(target) || !isCellElement(target)) return false;
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
        // a key typed into a field inside a cell is the field's, a key from outside the grid (a
        // menu portalled out of a cell, whose events still bubble through the cell) is not ours,
        // and neither is one from the app's content beside the cells (an empty state's action)
        if (
            event.defaultPrevented ||
            event.altKey ||
            !inViewport(event.target)
        ) {
            return false;
        }
        // in interaction, the cell's controls have the keys: the grid takes Escape (back to the
        // cell) and Tab (the cell's next control, wrapping) only, from a field too
        const target = event.target;
        if (
            interaction &&
            isElement(target) &&
            !isCellElement(target) &&
            // the app's own tab stop and a composition in progress (an IME) keep their keys
            !target.hasAttribute(TAB_STOP_ATTRIBUTE) &&
            !event.isComposing
        ) {
            const cell = cellElement(interaction);
            if (cell?.contains(target)) {
                if (event.key === "Escape") {
                    event.preventDefault();
                    leaveCell(true);
                    return true;
                }
                if (event.key === "Tab" && !event.ctrlKey && !event.metaKey) {
                    event.preventDefault();
                    cycleControls(cell, target, event.shiftKey);
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
        const ctrl = event.ctrlKey || event.metaKey;
        if ((event.key === "Enter" || event.key === " ") && !event.shiftKey) {
            // Enter or Space on a sortable column's header cell toggles its sort, once per press:
            // a key held down repeats, and would cycle through the sort
            const column = sortableColumnOf(event.target);
            if (column) {
                event.preventDefault();
                if (!event.repeat) toggleSort(column, ctrl);
                return true;
            }
        }
        // Enter or F2 on a cell itself hand the keys to its controls (a sortable header cell's
        // Enter sorted above: F2 enters it); a cell without controls lets the key through
        if (
            (event.key === "Enter" || event.key === "F2") &&
            !ctrl &&
            !event.shiftKey &&
            isElement(target) &&
            isCellElement(target)
        ) {
            const position = cellOf(target);
            // a held Enter repeats: once the first entered, the rest would press the control
            if (event.repeat && interaction) {
                event.preventDefault();
                return true;
            }
            if (position && enterCell(position, true)) {
                event.preventDefault();
                return true;
            }
        }
        if (selectionKey(event)) return true;
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

    /** The row at the view's top, and how far into it the view starts. */
    function anchorOf(axis: Axis): { rowIndex: number; within: number } | null {
        if (axis.count === 0 || rowsY.virtual <= 0) return null;
        const rowIndex = axis.indexAt(rowsY.virtual);
        return { rowIndex, within: rowsY.virtual - axis.offsetOf(rowIndex) };
    }

    const unsubscribeModel = model.subscribe((event) => {
        const { before, after } = event;
        state = after;
        const detailsChanged =
            after.expandedRows !== before.expandedRows ||
            (after.expandedRows.length > 0 &&
                (after.detailHeight !== before.detailHeight ||
                    // a detail's height may be a function of its row, whose data changed
                    (typeof after.detailHeight === "function" &&
                        (after.source !== before.source ||
                            (after.rowsChanged !== before.rowsChanged &&
                                holdsRowIn(
                                    after.expandedRows,
                                    after.rowsChanged.start,
                                    after.rowsChanged.end,
                                ))))));
        if (after.rowsChanged !== before.rowsChanged) {
            // rows' data changed, and nothing else did: off screen, there is nothing to do
            if (!rendersRows(after.rowsChanged) && !detailsChanged) return;
            if (rendersRows(after.rowsChanged)) rowsRevision += 1;
        }
        let fresh = false;
        const rowsResized =
            after.rowCount !== before.rowCount ||
            after.rowHeight !== before.rowHeight;
        if (rowsResized) {
            baseRowAxis =
                after.rowHeight === before.rowHeight
                    ? baseRowAxis.withCount(after.rowCount)
                    : rowAxisOf(after);
            fresh = true;
        }
        let anchored = false;
        if (rowsResized || detailsChanged) {
            const anchor = rowsResized ? null : anchorOf(rowAxis);
            rowAxis = withDetails(baseRowAxis, after);
            fresh = true;
            // a row expanding or collapsing above the view keeps the view where it is (M2)
            if (anchor) {
                rowsY.virtual =
                    rowAxis.offsetOf(anchor.rowIndex) +
                    Math.min(anchor.within, rowAxis.sizeOf(anchor.rowIndex));
                anchored = true;
            }
        }
        if (after.columns !== before.columns) {
            columnAxis = columnAxisOf(after);
            updatePinning();
            fresh = true;
        }
        if (
            after.headerRowHeight !== before.headerRowHeight ||
            after.header !== before.header
        ) {
            fresh = true;
        }
        relayout(fresh);
        if (anchored) {
            // the physical scroll follows even when the total did not change (no remap moved it)
            const top = rowsY.scrollTo(rowsY.virtual);
            if (Math.abs(top - (viewport?.scrollTop ?? 0)) > 0.5) {
                scrollWhenReady({ top });
            }
        }
        // another cell made active (the app, a middleware): the interaction ends, and an entry
        // waiting for another cell is dropped
        if (
            interaction &&
            !(
                after.activePosition &&
                sameCell(after.activePosition, interaction, after.header.cellAt)
            )
        ) {
            leaveCell(false);
        }
        if (pendingInteraction) {
            const waiting = pendingInteraction;
            const now = after.activePosition;
            if (!now || !sameCell(now, waiting.position, after.header.cellAt)) {
                if (now !== before.activePosition) pendingInteraction = null;
            } else if (cellElement(waiting.position)) {
                // a controlled parent followed: the cell enters now
                enterCell(waiting.position, waiting.focus);
            }
        }
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
            // the controls the cells render, now and later (a commit, the app's own re-render):
            // kept out of the tab order outside interaction (only cells that changed are read)
            const mutations =
                view && "MutationObserver" in view
                    ? new view.MutationObserver(onMutations)
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
            for (const cell of cellsUnder(element)) manageTabOrder(cell);
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
            // pinned cells may have registered while it was detached: write them all
            pinnedFor = null;
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
                }
            };
            detachViewport = detach;
            return detach;
        },
        registerLayer(layer, element) {
            layers[layer].add(element);
            written.delete(element);
            // only this element: a row of pinned cells mounting does not rewrite every other one
            const offsets = layerOffsets();
            if (!offsets) {
                // nothing to write for yet (a detached viewport: a root re-mounting while its
                // cells stay): the next write is for every pinned cell
                if (layer === "pinned" || layer === "detail") pinnedFor = null;
            } else if (layer === "pinned" || layer === "detail") {
                writeInset(layer, element, offsets.x, offsets.columnAxis);
            } else if (layer !== "grid") {
                write(element, layerTransform(layer, offsets.x, offsets.y));
            }
            return () => {
                layers[layer].delete(element);
                written.delete(element);
                // a cell no longer pinned keeps no inset of the engine's: its adapter places it
                if (layer === "pinned" || layer === "detail") {
                    element.style.left = "";
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
            // the cell in interaction scrolled out of the rendered ones: back to navigation
            if (interaction && !cellElement(interaction)) {
                interaction = null;
                emitInteraction();
            }
            // an entry waiting for its cell (out of view, a row loading): it enters once shown with
            // controls, and waits on otherwise
            if (
                pendingInteraction &&
                cellElement(pendingInteraction.position)
            ) {
                const { position, focus } = pendingInteraction;
                enterCell(position, focus);
            }
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
        interaction: () => interaction,
    };

    const actions: {
        [K in EngineActionKey]: (payload: EngineActionMap[K]) => void;
    } = {
        "scroll-to-cell": scrollToCell,
        "scroll-to": scrollTo,
        "interact-cell": (position) => {
            const active = state.activePosition;
            if (!active || !sameCell(active, position, state.header.cellAt)) {
                model.run("active-position.set", position);
            }
            if (enterCell(position, true, false)) return;
            // not rendered (out of view), no controls yet (a row loading), or a controlled parent
            // to follow: entered once its cell is active and shows controls
            pendingInteraction = { position, focus: true };
        },
        "leave-cell": () => {
            pendingInteraction = null;
            leaveCell(true);
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

/** A body row's top in its layer. */
export function rowTop<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): number {
    return view.rowAxis.offsetOf(rowIndex) - view.rowBase;
}

/**
 * A row's left in its layer (a header row's too). With pinned columns, it starts their width and
 * the rendered columns' width (at least the view's width less theirs) before the layer, so its
 * box holds them where the browser keeps them (a row's background, its hover), and sticky, which
 * keeps a cell inside its row, holds them in place through a scroll the engine has not rendered
 * yet (the frame a browser paints before the `scroll` event), to the left as far as to the right.
 * It moves only with the rendered columns. 0 without.
 */
export function rowLeft<TRow, TNode>(view: GridView<TRow, TNode>): number {
    if (view.pinnedColumnCount === 0) return 0;
    const rendered =
        view.columnAxis.offsetOf(view.renderedColumns.end) - view.columnBase;
    return -(view.pinnedWidth + Math.max(0, rendered));
}

/**
 * A row's structural `display` (a header row's too): with pinned columns, `flex`, so the pinned
 * cells (in its flow, sticky) stack by their widths; nothing without, a row is then as it was.
 */
export function rowDisplay<TRow, TNode>(
    view: GridView<TRow, TNode>,
): "flex" | undefined {
    return view.pinnedColumnCount > 0 ? "flex" : undefined;
}

/**
 * Whether columns `columnIndex` to `columnIndex + columnSpan` (a cell, a header cell's span) are
 * pinned, and whether they end at the last pinned column (its edge).
 */
export function columnPinning<TRow, TNode>(
    view: GridView<TRow, TNode>,
    columnIndex: number,
    columnSpan = 1,
): { readonly pinned: boolean; readonly pinnedEdge: boolean } {
    const end = columnIndex + columnSpan;
    const pinned = end <= view.pinnedColumnCount;
    return { pinned, pinnedEdge: pinned && end === view.pinnedColumnCount };
}

/**
 * A pinned cell's sticky `left` inset: its column's offset less the layers' horizontal offset
 * `layerX` (what they are translated by). The browser resolves sticky in layout, before the
 * transform, against the scrolled view: the cell shows at its offset from the view's start
 * whatever the scroll, on every painted frame. Unscaled, `layerX` is the view's `columnBase`.
 */
export function pinnedInset(
    columnAxis: Axis,
    columnIndex: number,
    layerX: number,
): number {
    return columnAxis.offsetOf(columnIndex) - layerX;
}

/**
 * Where something at virtual `offset` sits in its row, after the row's start (`rowLeft`): a
 * column that scrolls, from the base. A pinned one is in the row's flow and the engine's sticky
 * inset places it (its box follows the scroll): it reports its column's offset, which is its
 * place in a body row's flow (every pinned column is rendered there, in order).
 */
function leftInRow<TRow, TNode>(
    view: GridView<TRow, TNode>,
    offset: number,
    pinned: boolean,
): number {
    return pinned ? offset : offset - view.columnBase - rowLeft(view);
}

/** A column's left in its row (the same in the header rows and in every row). */
export function columnLeft<TRow, TNode>(
    view: GridView<TRow, TNode>,
    columnIndex: number,
): number {
    return leftInRow(
        view,
        view.columnAxis.offsetOf(columnIndex),
        columnPinning(view, columnIndex).pinned,
    );
}

/**
 * The width of a row's rendered cells: from the row's start (`rowLeft`) to the last rendered
 * column's end.
 */
export function renderedWidth<TRow, TNode>(
    view: GridView<TRow, TNode>,
): number {
    const last = view.columns[view.columns.length - 1];
    if (last === undefined) return 0;
    return view.columnAxis.offsetOf(last + 1) - view.columnBase - rowLeft(view);
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
    const { pinned } = columnPinning(view, from, cell.columnSpan);
    // a pinned cell is always whole: its columns are all rendered
    if (axis.totalSize > view.width && !pinned) {
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
        // in its header row, as `columnLeft`
        left: leftInRow(view, start, pinned),
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

/** Whether a row shows its detail (M1): loaded, and its key expanded. */
export function rowExpanded<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): boolean {
    return holdsRow(view.expandedRows, rowIndex);
}

/** Whether a row is selected (R7): rows are selectable, it is loaded and its key selected. */
export function rowSelected<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): boolean {
    return isRowSelected(view, rowIndex);
}

/** Whether a row can be selected (R7): rows are selectable, it is loaded and not refused. */
export function rowSelectable<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): boolean {
    return isRowSelectable(view, rowIndex);
}

/** A row's own height: its cells', without its detail. */
export function rowCellsHeight<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): number {
    return view.rowAxis.sizeOf(rowIndex) - view.rowAxis.extraSizeOf(rowIndex);
}

/**
 * An expanded row's detail area in its row (M3): below its cells (`top`, its place in the row's
 * flow), as tall as its detail and as wide as the visible area. Sticky in the flow, it is held at
 * the view's start by the inset the engine writes (the `detail` layer); `start` moves its box to
 * the row's start, before the pinned cells (−their width, 0 without), so that inset can reach the
 * view's start from wherever the row is scrolled. `null` while the row is collapsed.
 */
export function rowDetailBox<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): {
    readonly top: number;
    readonly start: number;
    readonly width: number;
    readonly height: number;
} | null {
    if (!rowExpanded(view, rowIndex)) return null;
    return {
        top: rowCellsHeight(view, rowIndex),
        start: view.pinnedWidth > 0 ? -view.pinnedWidth : 0,
        width: view.viewportWidth,
        height: view.rowAxis.extraSizeOf(rowIndex),
    };
}

/**
 * A body row's width: its rendered cells' (`renderedWidth`), and for an expanded row at least
 * what holds its detail at the view's start, as wide as the view (sticky keeps an element inside
 * its row): in a grid narrower than the view, the row reaches the view's end.
 */
export function rowWidth<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): number {
    const width = renderedWidth(view);
    if (!rowExpanded(view, rowIndex)) return width;
    return Math.max(
        width,
        view.viewportWidth - view.columnBase - rowLeft(view),
    );
}

/**
 * A detail's ARIA (M4): one cell of its row spanning every column, so expanding a row changes no
 * row count or index.
 */
export function ariaRowDetail<TRow, TNode>(
    view: GridView<TRow, TNode>,
): { readonly "aria-colindex": number; readonly "aria-colspan"?: number } {
    return {
        "aria-colindex": 1,
        ...(view.columnCount > 1 ? { "aria-colspan": view.columnCount } : {}),
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

/** A header cell's sort, as the adapters show it (S6). */
export interface HeaderCellSort {
    /** its column sorts the grid (never a group) */
    readonly sortable: boolean;
    /** the direction its column is sorted in, when it is */
    readonly direction: SortDirection | undefined;
    /** its column's place among the sorted columns, 1-based, when it is sorted */
    readonly priority: number | undefined;
    /**
     * `aria-sort`, on the first sorted column's header cell only (ARIA 1.2: one header at a time)
     */
    readonly ariaSort: SortDirection | undefined;
}

/** How a header cell shows the sort: sortable, and its direction and priority when sorted. */
export function headerCellSort<TRow, TNode>(
    view: GridView<TRow, TNode>,
    cell: HeaderCellLayout<TRow, TNode>,
): HeaderCellSort {
    const column = cell.column;
    const index = column
        ? view.sortColumns.findIndex((entry) => entry.columnKey === column.key)
        : -1;
    const sorted = view.sortColumns[index];
    return {
        sortable: column?.sortable === true,
        direction: sorted?.direction,
        priority: sorted ? index + 1 : undefined,
        ariaSort: index === 0 ? sorted?.direction : undefined,
    };
}
