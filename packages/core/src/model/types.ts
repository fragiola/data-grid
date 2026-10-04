import type { Size } from "../axis/axis";
import type { Direction } from "../navigation/navigation";
import type { Range } from "../viewport/window";

// The grid's model: its data and its rules (D3). One generic is the row type; the second is what a
// column's renderers return (`unknown` in the core, `ReactNode` in the React adapter, which
// re-exports `Column<TRow>` with it fixed), so an app writes one generic.

/** What a header cell's renderer receives. */
export interface HeaderCellRenderProps<TRow, TNode = unknown> {
    readonly column: Column<TRow, TNode>;
    readonly columnIndex: number;
}

/** What a group's header cell renderer receives. */
export interface GroupHeaderCellRenderProps<TRow, TNode = unknown> {
    readonly group: ColumnGroup<TRow, TNode>;
    /** its first column's index */
    readonly columnIndex: number;
    /** how many columns it spans */
    readonly columnSpan: number;
}

/** What a body cell's renderer receives: only for a loaded row. */
export interface CellRenderProps<TRow, TNode = unknown> {
    readonly row: TRow;
    readonly rowIndex: number;
    readonly column: Column<TRow, TNode>;
    readonly columnIndex: number;
    /** `column.getValue(row, rowIndex)`, or `row[column.key]` without one */
    readonly value: unknown;
}

/** A column of the grid (D10). */
export interface Column<TRow, TNode = unknown> {
    /** unique among the grid's columns */
    readonly key: string;
    /**
     * the header's text, as the app wrote it: what a header cell shows when it has no children
     * and the column no `renderHeaderCell` (the packages never translate or invent one)
     */
    readonly name?: string | undefined;
    /** in pixels */
    readonly width: number;
    /**
     * the cell's value; without one, `row[key]`. `rowIndex` is the row's index in the rows the
     * grid is given (in `@fragiola/data-grid/local`, in the rows given to the pipeline)
     */
    readonly getValue?: ((row: TRow, rowIndex: number) => unknown) | undefined;
    /** what a header cell shows when it is given no children */
    readonly renderHeaderCell?:
        | ((props: HeaderCellRenderProps<TRow, TNode>) => TNode)
        | undefined;
    /** what a body cell of a loaded row shows when it is given no children */
    readonly renderCell?:
        | ((props: CellRenderProps<TRow, TNode>) => TNode)
        | undefined;
    /**
     * whether its header cell sorts the grid (a click, Enter or Space toggles it). The grid keeps
     * the sort; the app orders the rows
     */
    readonly sortable?: boolean | undefined;
    /**
     * `"start"`: the column stays at the visible start while the others scroll sideways. Pinned
     * columns come first, and a group's columns are all pinned or none
     */
    readonly pinned?: "start" | undefined;
    /**
     * whether a person can resize it (a handle the app renders in its header cell, dragged or
     * moved with the arrows). The grid keeps the widths; without it, the column is its `width`
     */
    readonly resizable?: boolean | undefined;
    /** a resizable column's narrowest width in pixels (default 40, or `maxWidth` when smaller) */
    readonly minWidth?: number | undefined;
    /** a resizable column's widest width in pixels (default: none) */
    readonly maxWidth?: number | undefined;
    /**
     * its part of the view's width the other columns leave (Epic #80, A1), in proportion to the
     * other flex columns' (`1` is a part): never below its `width` (its base) nor past its
     * `maxWidth`; nothing left, its base, and the grid scrolls. A resized width replaces it, and a
     * reset gives it back
     */
    readonly flex?: number | undefined;
    /**
     * whether it fits its content once, when its first loaded rows render (A5): the widest of its
     * rendered cells, within its limits. That width is the grid's, never reported: a reset gives
     * it back, and with `flex` it is the base
     */
    readonly autoSize?: boolean | undefined;
    /**
     * whether a person can move it among its siblings (its header cell dragged, or Ctrl/⌘+Shift
     * with the arrows), the pinned ones among the pinned. The grid keeps the order
     */
    readonly reorderable?: boolean | undefined;
    /**
     * how two rows compare by this column, for sorting rows in memory (`@fragiola/data-grid/local`):
     * negative when `a` comes first. Without one, their values compare by type
     */
    readonly compare?: ((a: TRow, b: TRow) => number) | undefined;
    /**
     * whether a row passes this column's filter, for filtering rows in memory
     * (`@fragiola/data-grid/local`): `value` is the cell's, `filterValue` what the filter was set
     * to (never empty). Without one, a text contains, a list holds, anything else equals
     */
    readonly filter?:
        | ((value: unknown, filterValue: unknown, row: TRow) => boolean)
        | undefined;
    /** anything the app wants to keep on the column */
    readonly meta?: Readonly<Record<string, unknown>> | undefined;
    /** a column has no children: an entry with children is a {@link ColumnGroup} */
    readonly children?: never;
}

/**
 * Columns grouped under a header cell of their own (G1). Groups nest to any depth; their leaves,
 * in order, are the grid's columns.
 */
export interface ColumnGroup<TRow, TNode = unknown> {
    /** unique among the grid's groups and columns together */
    readonly key: string;
    /** the group header's text, as the app wrote it (see {@link Column.name}) */
    readonly name?: string | undefined;
    /** what the group's header cell shows when it is given no children */
    readonly renderHeaderCell?:
        | ((props: GroupHeaderCellRenderProps<TRow, TNode>) => TNode)
        | undefined;
    /** its columns and groups, in order: at least one column below it */
    readonly children: readonly ColumnOrGroup<TRow, TNode>[];
    /** anything the app wants to keep on the group */
    readonly meta?: Readonly<Record<string, unknown>> | undefined;
    /** a group is sized by its columns, and has no cells of its own */
    readonly width?: never;
    readonly getValue?: never;
    readonly renderCell?: never;
    /** a group is never sorted: its columns are */
    readonly sortable?: never;
    /** a group is pinned by its columns */
    readonly pinned?: never;
    /** a group is resized by its columns: resizable when one of them is */
    readonly resizable?: never;
    readonly minWidth?: never;
    readonly maxWidth?: never;
    /** a group neither flexes nor fits itself: its columns do */
    readonly flex?: never;
    readonly autoSize?: never;
    /**
     * whether a person can move it, whole, among its siblings (see {@link Column.reorderable});
     * its columns move inside it by their own
     */
    readonly reorderable?: boolean | undefined;
    /** a group neither sorts nor filters: its columns do */
    readonly compare?: never;
    readonly filter?: never;
}

/** A sort's direction: the values of `aria-sort`. */
export type SortDirection = "ascending" | "descending";

/** A sorted column: its key and its direction. */
export interface SortColumn {
    readonly columnKey: string;
    readonly direction: SortDirection;
}

/**
 * The widths of the columns a person resized, by column key, over each column's `width` (W1). A
 * key that is not a column is kept: the column may come back.
 */
export type ColumnWidths = Readonly<Record<string, number>>;

/**
 * The order columns and groups take among their siblings, by key (O1): the listed ones take the
 * places of the listed ones, in this order; the others keep theirs. A key that is no column or
 * group is kept: it may come back.
 */
export type ColumnOrder = readonly string[];

/** Which side of a sibling a moved column or group lands on. */
export type ReorderSide = "before" | "after";

/** An entry of `columns`: a column, or a group of them. */
export type ColumnOrGroup<TRow, TNode = unknown> =
    | Column<TRow, TNode>
    | ColumnGroup<TRow, TNode>;

/**
 * A header cell, as the core lays it out (G3): a group spanning its columns, or a column. A column
 * with fewer groups above it than the header has rows spans the rows down to the last (G2).
 */
export type HeaderCellLayout<TRow, TNode = unknown> = {
    /** the group's or the column's key */
    readonly key: string;
    /** its header row: `-depth` (the top) … -1 (the columns' row); a spanning column's top row */
    readonly rowIndex: number;
    /** its first column's index: its position, with `rowIndex` */
    readonly columnIndex: number;
    readonly columnSpan: number;
    readonly rowSpan: number;
} & (
    | {
          readonly group: ColumnGroup<TRow, TNode>;
          readonly column?: undefined;
      }
    | {
          readonly column: Column<TRow, TNode>;
          readonly group?: undefined;
      }
);

/** The header's rows and cells, for the whole grid. */
export interface HeaderLayout<TRow, TNode = unknown> {
    /** how many header rows the columns need: 1 without groups, 1 + the deepest nesting with them */
    readonly depth: number;
    /** per header row, the top one first: the cells starting in it, in column order */
    readonly rows: readonly (readonly HeaderCellLayout<TRow, TNode>[])[];
    /** the cell covering a header position (a spanning column covers the rows below its top) */
    cellAt(
        rowIndex: number,
        columnIndex: number,
    ): HeaderCellLayout<TRow, TNode> | undefined;
    /** a column's or a group's cell, by its key (every column has one) */
    cellByKey(key: string): HeaderCellLayout<TRow, TNode> | undefined;
}

/**
 * A cell: header cells are on rows -1 and above, at their first column (a column spanning header
 * rows is at any of its rows).
 */
export interface CellPosition {
    readonly rowIndex: number;
    readonly columnIndex: number;
}

/** What identifies a row across renders: `rowKey`'s answer, or its index without one. */
export type RowKey = string | number;

/** A row's key: what identifies it across renders. */
export type RowKeyGetter<TRow> = (row: TRow, index: number) => RowKey;

/**
 * An expanded row's detail height in pixels (M2): one for all, or one per loaded row. It adds to
 * the row's own height in the row axis.
 */
export type DetailHeight<TRow> =
    | number
    | ((row: TRow, rowIndex: number) => number);

/**
 * How rows are selected (R2): one at a time, or many. A grid without it selects nothing.
 */
export type RowSelection = "single" | "multiple";

/** Whether a loaded row can be selected (R5): a row it refuses is never added. */
export type RowSelectable<TRow> = (row: TRow, rowIndex: number) => boolean;

/**
 * Where a range starts (R3): the row a toggle without `extend` last toggled, kept as its key and
 * the index it was at, and the state a range from it gives its rows (the one the toggle gave
 * it). It is checked when it is used: a key no longer at its index is no anchor.
 */
export interface SelectionAnchor {
    readonly rowKey: RowKey;
    readonly rowIndex: number;
    /** whether a range from it selects its rows (`false`: clears them) */
    readonly selected: boolean;
}

/**
 * Where the rows come from (D6): every row at once (fixed, or growing for infinite loading), or a
 * count and a getter answering `undefined` for a row not loaded yet. A row not loaded keeps its
 * place and its size.
 */
export type RowSource<TRow> =
    | { readonly rows: readonly TRow[] }
    | {
          readonly rowCount: number;
          readonly getRow: (index: number) => TRow | undefined;
      };

/** The model's state: immutable, replaced on every committed command. */
export interface DataGridState<TRow, TNode = unknown> {
    /** the grid's columns: the leaves of `columnEntries`, in the column order */
    readonly columns: readonly Column<TRow, TNode>[];
    /**
     * the columns and groups as declared (the same array as `columns` without groups and without
     * an order)
     */
    readonly columnEntries: readonly ColumnOrGroup<TRow, TNode>[];
    /** the header's rows and cells */
    readonly header: HeaderLayout<TRow, TNode>;
    readonly source: RowSource<TRow>;
    readonly rowCount: number;
    readonly rowKey: RowKeyGetter<TRow> | undefined;
    readonly rowHeight: Size;
    /** a header row's height; 0 for a grid without a header */
    readonly headerRowHeight: number;
    readonly activePosition: CellPosition | null;
    /** the sorted columns, the first one first (the grid keeps them; the app orders the rows) */
    readonly sortColumns: readonly SortColumn[];
    /**
     * the last `rows.changed`: which rows' data changed (end excluded), and how many times it
     * was said (`revision`, 0 before the first)
     */
    readonly rowsChanged: Range & { readonly revision: number };
    /**
     * the keys of the expanded rows, in the order they were expanded (M1). A key whose row is not
     * loaded, or not in the data, stays: its row expands once it is there
     */
    readonly expandedRowKeys: readonly RowKey[];
    /**
     * the indexes of the rows shown expanded, ascending: each loaded, its key in
     * `expandedRowKeys`. Derived from the data and the keys, as the data contract tells them
     */
    readonly expandedRows: readonly number[];
    /** an expanded row's detail height */
    readonly detailHeight: DetailHeight<TRow>;
    /** how rows are selected; `undefined`: they are not (R2) */
    readonly rowSelection: RowSelection | undefined;
    /**
     * the keys of the selected rows, in the order they were selected (R1). A key whose row is
     * not loaded, or not in the data, stays
     */
    readonly selectedRowKeys: readonly RowKey[];
    /** whether a loaded row can be selected; `undefined`: every row can (R5) */
    readonly isRowSelectable: RowSelectable<TRow> | undefined;
    /** where a range starts: the row last toggled without `extend` (R3) */
    readonly selectionAnchor: SelectionAnchor | null;
    /** the resized columns' widths, over their `width` (a resizable column's only count) */
    readonly columnWidths: ColumnWidths;
    /** the order columns and groups take among their siblings (empty: as declared) */
    readonly columnOrder: ColumnOrder;
}

/** What `createDataGridModel` starts from. */
export interface DataGridModelOptions<TRow, TNode = unknown> {
    /** the columns, and the groups above them */
    columns?: readonly ColumnOrGroup<TRow, TNode>[];
    rows?: readonly TRow[];
    rowCount?: number;
    getRow?: (index: number) => TRow | undefined;
    rowKey?: RowKeyGetter<TRow>;
    /** a row's height in pixels, or a function of its index (default 35) */
    rowHeight?: Size;
    /** a header row's height in pixels (default 35); 0 for no header */
    headerRowHeight?: number;
    activePosition?: CellPosition | null;
    /** the sorted columns to start with (entries that are not a sortable column are dropped) */
    sortColumns?: readonly SortColumn[];
    /** the keys of the rows expanded to start with (a key given twice counts once) */
    expandedRowKeys?: readonly RowKey[];
    /** an expanded row's detail height in pixels, or a function of the row (default 300) */
    detailHeight?: DetailHeight<TRow>;
    /** how rows are selected: one at a time, or many (default: not at all) */
    rowSelection?: RowSelection | undefined;
    /** the keys of the rows selected to start with (a key given twice counts once) */
    selectedRowKeys?: readonly RowKey[];
    /** whether a loaded row can be selected (default: every row can) */
    isRowSelectable?: RowSelectable<TRow> | undefined;
    /** the resized columns' widths to start with (an entry that is not a size is dropped) */
    columnWidths?: ColumnWidths;
    /** the column order to start with (an entry that is not a string is dropped) */
    columnOrder?: ColumnOrder;
}

/** `data.set`'s payload: the rows, or a count and a getter; and optionally how to key them. */
export type DataSetPayload<TRow> = RowSource<TRow> & {
    readonly rowKey?: RowKeyGetter<TRow> | undefined;
};

/** The payload of a command that takes none. */
export type NoPayload = Record<string, never>;

/** Every command: its payload and the value it returns. */
export interface CommandMap<TRow, TNode = unknown> {
    /**
     * replaces the columns and their groups (keys unique across both, widths finite and not
     * negative, at least one column under every group)
     */
    "columns.set": {
        payload: { readonly columns: readonly ColumnOrGroup<TRow, TNode>[] };
        result: { readonly columnCount: number };
    };
    /** replaces where the rows come from */
    "data.set": {
        payload: DataSetPayload<TRow>;
        result: { readonly rowCount: number };
    };
    /**
     * tells that the data behind the rows changed (rows arrived in a cache `getRow` reads): the
     * rows from `start` to `end` (end excluded), clamped to the grid's; without them, from the
     * first row or to the last. It changes no count and no size: the engine renders again only
     * when the range meets the rendered rows or the active row. Returns the clamped range.
     */
    "rows.changed": {
        payload: {
            readonly start?: number | undefined;
            readonly end?: number | undefined;
        };
        result: Range;
    };
    /**
     * replaces the sorted columns, the first one first: each a sortable column, once. Returns them
     */
    "sort-columns.set": {
        payload: { readonly sortColumns: readonly SortColumn[] };
        result: readonly SortColumn[];
    };
    /**
     * toggles a sortable column through ascending, descending and not sorted. Alone, it becomes
     * the only sorted column; with `multi`, the others stay and it is added last (or cycles in
     * place). Returns the sorted columns
     */
    "sort-columns.toggle": {
        payload: {
            readonly columnKey: string;
            readonly multi?: boolean | undefined;
        };
        result: readonly SortColumn[];
    };
    /**
     * replaces the expanded rows' keys (each once). A key whose row is not loaded is kept: the
     * row expands once it is. Returns them
     */
    "expanded-rows.set": {
        payload: { readonly rowKeys: readonly RowKey[] };
        result: readonly RowKey[];
    };
    /**
     * expands a row, or collapses it when it is expanded: by its index (a loaded row; its key is
     * kept) or by its key. Returns the expanded rows' keys
     */
    "expanded-rows.toggle": {
        payload:
            | { readonly rowIndex: number; readonly rowKey?: undefined }
            | { readonly rowKey: RowKey; readonly rowIndex?: undefined };
        result: readonly RowKey[];
    };
    /**
     * replaces the selected rows' keys (each once; in single mode, the last one only): the app's
     * keys, as given (`isRowSelectable` is not asked: a key's row may not be loaded). Returns them
     */
    "selected-rows.set": {
        payload: { readonly rowKeys: readonly RowKey[] };
        result: readonly RowKey[];
    };
    /**
     * selects a row, or clears it when it is selected: by its index (a loaded row) or by its key.
     * By index, the row becomes the anchor; a row that cannot be selected is never added (it can
     * be cleared). By key, the row is not looked for: the key is the app's, as with `set`. With
     * `extend` (multiple mode; single mode toggles), every selectable row from the anchor to it
     * takes the anchor's state instead, and the anchor stays (without one, a toggle); a row not
     * loaded on the way
     * refuses it all (`not_loaded`). In single mode, selecting a row clears the others. Returns
     * the selected rows' keys and the anchor it leaves (what a controlled root keeps of a toggle
     * its parent answers)
     */
    "selected-rows.toggle": {
        payload:
            | {
                  readonly rowIndex: number;
                  readonly extend?: boolean | undefined;
                  readonly rowKey?: undefined;
              }
            | {
                  readonly rowKey: RowKey;
                  readonly rowIndex?: undefined;
                  readonly extend?: undefined;
              };
        result: {
            readonly rowKeys: readonly RowKey[];
            readonly anchor: SelectionAnchor | null;
        };
    };
    /**
     * makes a loaded row the anchor, where the next range starts, changing no selection: a range
     * from it selects its rows, or clears them with `selected: false`. Returns the anchor
     */
    "selection-anchor.set": {
        payload: {
            readonly rowIndex: number;
            readonly selected?: boolean | undefined;
        };
        result: SelectionAnchor;
    };
    /** leaves no anchor: the next range is a toggle */
    "selection-anchor.clear": {
        payload: NoPayload;
        result: undefined;
    };
    /**
     * selects every selectable row (multiple mode), keeping the keys already selected; a row not
     * loaded refuses it all (`not_loaded`): its key is unknown. Returns the selected rows' keys
     */
    "selected-rows.select-all": {
        payload: NoPayload;
        result: readonly RowKey[];
    };
    /**
     * changes how rows are selected: the mode (`null`: not at all) and which rows can be. Single
     * mode keeps the last selected key only
     */
    "row-selection.set": {
        payload: {
            readonly rowSelection?: RowSelection | null | undefined;
            readonly isRowSelectable?: RowSelectable<TRow> | null | undefined;
        };
        result: undefined;
    };
    /**
     * replaces the resized columns' widths (each a size in pixels). A key that is not a column is
     * kept: the column may come back. Returns them
     */
    "column-widths.set": {
        payload: { readonly columnWidths: ColumnWidths };
        result: ColumnWidths;
    };
    /**
     * resizes a resizable column to `width`, within its limits; or a group, whose resizable
     * columns share the change in proportion to their widths, each within its limits, the rest
     * going to the next ones. Widths are whole pixels. Returns the columns' widths
     */
    "column-widths.resize": {
        payload: {
            readonly columnKey: string;
            readonly width: number;
            /**
             * the widths an engine gives columns without an override (its `column-auto-widths`:
             * automatic widths, flex shares): the resize starts from them, and a column back to
             * its one needs no width. Filled by the engine on screen: an app or an adapter
             * needn't pass it
             */
            readonly autoWidths?: ColumnWidths | undefined;
        };
        result: ColumnWidths;
    };
    /**
     * gives a column its own `width` back, a group its columns, or, without a key, every column.
     * Returns the columns' widths
     */
    "column-widths.reset": {
        payload: { readonly columnKey?: string | undefined };
        result: ColumnWidths;
    };
    /**
     * replaces the column order (keys of columns and groups, each once). A key that is no column
     * or group is kept: it may come back. Returns it
     */
    "column-order.set": {
        payload: { readonly columnOrder: ColumnOrder };
        result: ColumnOrder;
    };
    /**
     * moves a reorderable column or group before or after one of its siblings (its parent
     * group's entries, or the top level; that one may be fixed): a pinned one beside a pinned
     * one, another beside another. One landing where it is commits nothing. Returns the column
     * order
     */
    "column-order.move": {
        payload: {
            readonly columnKey: string;
            readonly targetKey: string;
            readonly side: ReorderSide;
        };
        result: ColumnOrder;
    };
    /** gives the columns and groups their declared order back. Returns the column order */
    "column-order.reset": {
        payload: NoPayload;
        result: ColumnOrder;
    };
    /**
     * changes the row height (a number or a function of the index), the header row's, or an
     * expanded row's detail height
     */
    "sizes.set": {
        payload: {
            readonly rowHeight?: Size | undefined;
            readonly headerRowHeight?: number | undefined;
            readonly detailHeight?: DetailHeight<TRow> | undefined;
        };
        result: undefined;
    };
    /**
     * makes a cell the active one (rows -1 and above are the header); a position inside a header
     * cell's span activates that cell, at its own position
     */
    "active-position.set": {
        payload: CellPosition;
        result: CellPosition;
    };
    /** leaves no cell active */
    "active-position.clear": {
        payload: NoPayload;
        result: undefined;
    };
    /**
     * moves the active cell (the engine supplies `pageSize`, the rows in view, and
     * `visibleColumns`, where a move down from a group lands)
     */
    "active-position.move": {
        payload: {
            readonly direction: Direction;
            readonly pageSize?: number | undefined;
            readonly visibleColumns?: Range | undefined;
        };
        result: CellPosition;
    };
}

export type CommandName = keyof CommandMap<unknown>;

export type PayloadOf<
    C extends CommandName,
    TRow = unknown,
    TNode = unknown,
> = CommandMap<TRow, TNode>[C]["payload"];

export type ResultOf<
    C extends CommandName,
    TRow = unknown,
    TNode = unknown,
> = CommandMap<TRow, TNode>[C]["result"];

/** Why a command did not apply. */
export type CommandErrorCode =
    /** no command has this name */
    | "unknown_command"
    /** the payload is not what the command takes */
    | "invalid_payload"
    /** the cell the payload names does not exist */
    | "not_found"
    /** a rule of the grid forbids it (nothing to move from, nothing to move to) */
    | "refused"
    /** it needs a row that is not loaded yet: its key is unknown */
    | "not_loaded"
    /** a middleware vetoed it */
    | "vetoed"
    /** it was issued while another command ran, and will run after it */
    | "queued"
    /** a middleware threw */
    | "middleware_error";

export interface CommandError {
    readonly code: CommandErrorCode;
    readonly message: string;
}

/** Why a command did not apply. */
export interface CommandFailure {
    readonly ok: false;
    readonly error: CommandError;
}

/** What a command returns: its value, or why it did not apply. It never throws on bad input. */
export type CommandResult<R> =
    | { readonly ok: true; readonly value: R }
    | CommandFailure;

/**
 * What a middleware sees: a union discriminated by `command`, so checking the command narrows the
 * payload (`if (ctx.command === "active-position.move") ctx.payload.direction`).
 */
export type CommandContext<TRow, TNode = unknown> = {
    [C in CommandName]: {
        readonly command: C;
        /** the payload; assign a new object to rewrite it before calling `next` */
        payload: PayloadOf<C, TRow, TNode>;
        /** `model.can`/`model.check`: nothing will be committed; do not cause side effects */
        readonly dryRun: boolean;
        /** the committed state the command applies to */
        readonly state: DataGridState<TRow, TNode>;
    };
}[CommandName];

/**
 * Runs around every command, engine-issued or not: veto (return an error without calling
 * `next`), rewrite (assign `ctx.payload`, then call `next`) or observe (call `next` and look at its
 * result). Returning `undefined` passes on `next`'s result when it was called, and vetoes when it
 * was not.
 */
export type Middleware<TRow, TNode = unknown> = (
    ctx: CommandContext<TRow, TNode>,
    next: () => CommandResult<unknown>,
) => CommandResult<unknown> | undefined;

/** What a listener receives: one event per committed command. */
export interface CommandEvent<TRow, TNode = unknown> {
    readonly command: CommandName;
    readonly payload: unknown;
    /** the command's value */
    readonly result: unknown;
    readonly before: DataGridState<TRow, TNode>;
    readonly after: DataGridState<TRow, TNode>;
}

export type CommandListener<TRow, TNode = unknown> = (
    event: CommandEvent<TRow, TNode>,
) => void;

/** What `model.get` reads: each key's payload (`undefined` for none) and result. */
export interface QueryMap<TRow, TNode = unknown> {
    /** the columns, in order */
    columns: { payload: undefined; result: readonly Column<TRow, TNode>[] };
    /** a column by its key */
    "column-by": {
        payload: { readonly key: string };
        result: Column<TRow, TNode> | undefined;
    };
    "column-count": { payload: undefined; result: number };
    "row-count": { payload: undefined; result: number };
    /** the header's rows: its depth with a header, 0 without */
    "header-row-count": { payload: undefined; result: number };
    /** the header rows the columns need (1 without groups), whether the header shows or not */
    "header-depth": { payload: undefined; result: number };
    /** the header's cells, per row (the top one first), whether the header shows or not */
    "header-rows": {
        payload: undefined;
        result: readonly (readonly HeaderCellLayout<TRow, TNode>[])[];
    };
    /** the header cell covering a header position, or `undefined` outside the header */
    "header-cell-by": {
        payload: CellPosition;
        result: HeaderCellLayout<TRow, TNode> | undefined;
    };
    /** the columns and groups as declared */
    "column-entries": {
        payload: undefined;
        result: readonly ColumnOrGroup<TRow, TNode>[];
    };
    /** a row by its index; `undefined` while it is not loaded */
    "row-by": { payload: { readonly index: number }; result: TRow | undefined };
    /** a row's key: `rowKey(row, index)`, or its index when there is no getter or no row yet */
    "row-key-by": {
        payload: { readonly rowIndex: number };
        result: string | number;
    };
    /** a cell's value: `column.getValue`, or `row[column.key]`; `undefined` while not loaded */
    "cell-value-by": {
        payload: CellPosition;
        result: unknown;
    };
    "active-position": { payload: undefined; result: CellPosition | null };
    /** the sorted columns, the first one first */
    "sort-columns": { payload: undefined; result: readonly SortColumn[] };
    /** a column's sort, or `undefined` when it is not sorted */
    "sort-column-by": {
        payload: { readonly columnKey: string };
        result: SortColumn | undefined;
    };
    /** the resized columns' widths, by column key */
    "column-widths": { payload: undefined; result: ColumnWidths };
    /**
     * a column's width (its resized width, else its `width`, within its limits), or a group's
     * (its columns'); `undefined` for a key that is neither. On screen, an engine's automatic
     * widths and flex shares take the place of `width` (its view's column axis)
     */
    "column-width-by": {
        payload: { readonly columnKey: string };
        result: number | undefined;
    };
    /** the order columns and groups take among their siblings */
    "column-order": { payload: undefined; result: ColumnOrder };
    "row-height": { payload: undefined; result: Size };
    "header-row-height": { payload: undefined; result: number };
    /** the expanded rows' keys, in the order they were expanded */
    "expanded-row-keys": { payload: undefined; result: readonly RowKey[] };
    /** the indexes of the rows shown expanded (loaded, their key expanded), ascending */
    "expanded-rows": { payload: undefined; result: readonly number[] };
    /** an expanded row's detail height: a number, or a function of the row */
    "detail-height": { payload: undefined; result: DetailHeight<TRow> };
    /** how rows are selected; `undefined` when they are not */
    "row-selection": { payload: undefined; result: RowSelection | undefined };
    /** the selected rows' keys, in the order they were selected */
    "selected-row-keys": { payload: undefined; result: readonly RowKey[] };
    /** where the next range starts: the anchor, while its key is still at its index */
    "selection-anchor": { payload: undefined; result: SelectionAnchor | null };
}

export type QueryKey = keyof QueryMap<unknown>;

/** What `model.is` answers. */
export interface QuestionMap {
    /**
     * whether the cell is the active one: for a header cell, any position inside its span (a
     * group's columns, a column's rows)
     */
    "cell-active": CellPosition;
    /** whether the row holds the active cell */
    "row-active": { readonly rowIndex: number };
    /** whether the row is loaded (its getter answered a row) */
    "row-loaded": { readonly rowIndex: number };
    /** whether a column sorts the grid (a column, `sortable`) */
    "column-sortable": { readonly columnKey: string };
    /** whether the row shows its detail: loaded, and its key expanded */
    "row-expanded": { readonly rowIndex: number };
    /** whether the row is selected: rows are selectable, it is loaded and its key selected */
    "row-selected": { readonly rowIndex: number };
    /** whether the row can be selected: rows are selectable, it is loaded and not refused */
    "row-selectable": { readonly rowIndex: number };
}

export type QuestionKey = keyof QuestionMap;

/** The arguments after a key: the payload, optional when the key takes none. */
export type PayloadArgs<P> = [P] extends [undefined]
    ? []
    : NoPayload extends P
      ? [payload?: P]
      : [payload: P];

type IsUnion<T, All = T> = T extends unknown
    ? [All] extends [T]
        ? false
        : true
    : never;

/**
 * A command's arguments after its name. With a name typed as a union of commands, the payload is
 * required: one of them may need it.
 */
export type CommandArgs<C extends CommandName, TRow, TNode> =
    true extends IsUnion<C>
        ? [payload: PayloadOf<C, TRow, TNode>]
        : PayloadArgs<PayloadOf<C, TRow, TNode>>;
