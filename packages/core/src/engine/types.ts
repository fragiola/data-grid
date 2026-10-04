import type { Axis } from "../axis/axis";
import type {
    CellPosition,
    Column,
    HeaderCellLayout,
    HeaderLayout,
    RowKey,
    RowKeyGetter,
    RowSelectable,
    RowSelection,
    RowSource,
    SortColumn,
} from "../model/types";
import type { ScrollAlign } from "../viewport/scroll-target";
import type { AxisWindow, Range } from "../viewport/window";

// The engine's public types: its options, the view a render shows, what `get`, `run` and
// `subscribe` take, the layers it writes and what only an adapter calls.

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
    /** the column a drag is resizing (W4), or `null` */
    readonly columnResize: ColumnResize | null;
}

/** A column (or a group) a person is resizing with the pointer, and its width on screen. */
export interface ColumnResize {
    /** the column's or the group's key: its resizer's `data-grid-column-resizer` */
    readonly columnKey: string;
    readonly width: number;
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
    /** the column a drag is resizing, or `null` (see `GridView.columnResize`) */
    "column-resize": ColumnResize | null;
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
    /** a drag started resizing a column, resized it (its width on screen), or ended (`null`) */
    "column-resize": ColumnResize | null;
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
     * (Ctrl/⌘ adds the column); the click ending a press on a column resizer is the resizer's,
     * and a double click there resets the column's width. Returns whether the click was the
     * grid's: a toggle ran, even when a middleware or a controlled parent declined it. Like `keydown`, an adapter calls it
     * after the consumer's own handlers, so `preventDefault` cancels it.
     */
    click(event: MouseEvent): boolean;
    /**
     * Handles a press in the grid: a primary press on one of its column resizers starts a drag
     * (and is prevented: no focus, no text selection). Returns whether it did. Like `click`, an
     * adapter calls it after the consumer's own handlers, so `preventDefault` cancels it.
     */
    pointerdown(event: PointerEvent): boolean;
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
