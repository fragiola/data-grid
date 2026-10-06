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

/**
 * What a column's `colSpan` is asked with (E1.2): which cell, by the kind of row it is in. Its
 * header cell (on the header's last row, -1), a loaded body row's cell with its row, a summary
 * row's cell (Epic #86, E2.1) with its position and index, or a group row's cell (Epic #87, E3.1)
 * with its group.
 */
export type ColSpanArgs<TRow> =
    | SummaryColSpanArgs
    | GroupColSpanArgs
    | {
          readonly type: "header";
          readonly rowIndex: number;
          readonly row?: undefined;
      }
    | {
          readonly type: "row";
          readonly rowIndex: number;
          readonly row: TRow;
      };

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
     * what a summary row's cell shows when it is given no children (Epic #86, E2.1): the app's
     * own value (a total, a count), computed in its closure; without it, nothing
     */
    readonly renderSummaryCell?:
        | ((props: SummaryCellRenderProps<TRow, TNode>) => TNode)
        | undefined;
    /**
     * what a group row's cell shows when it is given no children (Epic #87, E3.1): the group's
     * value in the column it groups by, else its aggregate for this column (`value`), as the app
     * wants it shown; without it, `value` as text
     */
    readonly renderGroupCell?:
        | ((props: GroupCellRenderProps<TRow, TNode>) => TNode)
        | undefined;
    /**
     * whether its header cell sorts the grid (a click, Enter or Space toggles it). The grid keeps
     * the sort; the app orders the rows
     */
    readonly sortable?: boolean | undefined;
    /**
     * `"start"`: the column stays at the view's start while the others scroll sideways; `"end"`:
     * at its end. Columns pinned at the start come first, the ones pinned at the end last, and a
     * group's columns are all in one part (pinned at the start, at the end, or not)
     */
    readonly pinned?: PinnedSide | undefined;
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
     * other flex columns' (`1` is a part): never below its `width` (its base), nor, resizable,
     * outside its `minWidth`/`maxWidth`; nothing left, its base, and the grid scrolls. A resized
     * width replaces it, and a reset gives it back
     */
    readonly flex?: number | undefined;
    /**
     * whether it fits its content once, when its first loaded rows render (A5): the widest of its
     * rendered cells (within its limits when it is resizable). That width is the grid's, never
     * reported: a reset gives
     * it back, and with `flex` it is the base
     */
    readonly autoSize?: boolean | undefined;
    /**
     * whether a person can move it among its siblings (its header cell dragged, or Ctrl/⌘+Shift
     * with the arrows), within its part (pinned at the start, at the end, or not). The grid keeps
     * the order
     */
    readonly reorderable?: boolean | undefined;
    /**
     * how many columns a cell of this column spans (Epic #85, E1.2): its header cell
     * (`type: "header"`) or a loaded row's cell (`type: "row"`). The cell covers the columns
     * after it, which render no cell there; it never reaches past its part (pinned at the start,
     * at the end, or not) nor the last column, nor, in the header, past its sibling columns.
     * `undefined` or 1: no span. Asked only for the cells a render shows, never for every row
     */
    readonly colSpan?:
        | ((args: ColSpanArgs<TRow>) => number | undefined)
        | undefined;
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
    /**
     * under a collapsible group (Epic #85, E1.3): shown only while it is expanded, or only while
     * it is collapsed; without it, in both states
     */
    readonly groupShow?: GroupShow | undefined;
    /** anything the app wants to keep on the column */
    readonly meta?: Readonly<Record<string, unknown>> | undefined;
    /** a column has no children: an entry with children is a {@link ColumnGroup} */
    readonly children?: never;
    /** a column does not collapse: a group does */
    readonly collapsible?: never;
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
    /**
     * whether it collapses (Epic #85, E1.3): collapsed (`collapsedGroupKeys`), it shows only its
     * children whose `groupShow` is `"collapsed"` or unset, expanded only those whose `groupShow`
     * is `"expanded"` or unset; at least one in each state
     */
    readonly collapsible?: boolean | undefined;
    /** under a collapsible group: the state it shows in (see {@link Column.groupShow}) */
    readonly groupShow?: GroupShow | undefined;
    /** anything the app wants to keep on the group */
    readonly meta?: Readonly<Record<string, unknown>> | undefined;
    /** a group is sized by its columns, and has no cells of its own */
    readonly width?: never;
    readonly getValue?: never;
    readonly renderCell?: never;
    readonly renderSummaryCell?: never;
    readonly renderGroupCell?: never;
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
    /** a group spans its columns */
    readonly colSpan?: never;
    /**
     * whether a person can move it, whole, among its siblings (see {@link Column.reorderable});
     * its columns move inside it by their own
     */
    readonly reorderable?: boolean | undefined;
    /** a group neither sorts nor filters: its columns do */
    readonly compare?: never;
    readonly filter?: never;
}

/** Which state of its collapsible group an entry shows in (E1.3): expanded only, or collapsed only. */
export type GroupShow = "expanded" | "collapsed";

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
 * with fewer groups above it than the header has rows spans the rows down to the last (G2), and
 * one whose `colSpan` says so for the header spans the sibling columns after it (E1.2), which then
 * have no cell on screen (`cellByKey` still finds theirs, of one column).
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
    /**
     * the cell covering a header position (a spanning column covers the rows below its top, and a
     * header `colSpan` the columns it reaches)
     */
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
 * A body row's height in pixels (D7): one for all, or one per index; or `"auto"`, as tall as its
 * content, measured once rendered (Epic #86, E2.2: `estimatedRowHeight` until then).
 */
export type RowHeight = Size | "auto";

/**
 * An expanded row's detail height in pixels (M2): one for all, or one per loaded row; or `"auto"`,
 * as tall as its content, measured once rendered (Epic #86, E2.2: `estimatedDetailHeight` until
 * then). It adds to the row's own height in the row axis.
 */
export type DetailHeight<TRow> =
    | number
    | ((row: TRow, rowIndex: number) => number)
    | "auto";

/**
 * How rows are selected (R2): one at a time, or many. A grid without it selects nothing.
 */
export type RowSelection = "single" | "multiple";

/** Where a pinned column stays: at the view's start, or at its end (Epic #85, E1.1). */
export type PinnedSide = "start" | "end";

/**
 * The grid's direction (E1.1): left to right, or right to left, where its start is the right
 * edge. Indexes, windows and offsets are the same both ways: only where they show is mirrored
 */
export type GridDirection = "ltr" | "rtl";

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
 * place and its size. Either may say what kind of row each index is (`getRowMeta`, Epic #87).
 */
export type RowSource<TRow> = (
    | { readonly rows: readonly TRow[] }
    | {
          readonly rowCount: number;
          readonly getRow: (index: number) => TRow | undefined;
      }
) & {
    /**
     * what kind of row an index is and where it sits in a tree (Epic #87, E3.1): a group row
     * (`group`), never read as a data row, or a data row at a depth. Given, the grid is a
     * `treegrid`; without it, every row is a data row at the top
     */
    readonly getRowMeta?: RowMetaGetter | undefined;
};

/** The model's state: immutable, replaced on every committed command. */
export interface DataGridState<TRow, TNode = unknown> {
    /**
     * the grid's columns: the leaves of `columnEntries`, in the column order, less the ones a
     * collapsed group hides (or an expanded one, E1.3)
     */
    readonly columns: readonly Column<TRow, TNode>[];
    /**
     * the columns and groups as declared (the same array as `columns` without groups, a
     * `colSpan` and an order)
     */
    readonly columnEntries: readonly ColumnOrGroup<TRow, TNode>[];
    /** the header's rows and cells */
    readonly header: HeaderLayout<TRow, TNode>;
    readonly source: RowSource<TRow>;
    readonly rowCount: number;
    readonly rowKey: RowKeyGetter<TRow> | undefined;
    readonly rowHeight: RowHeight;
    /** a measured row's height until it is measured (`rowHeight: "auto"`) */
    readonly estimatedRowHeight: number;
    /** a header row's height; 0 for a grid without a header */
    readonly headerRowHeight: number;
    /**
     * how many summary rows the grid has at the top (under the header) and at the bottom (at the
     * view's bottom edge): their row indexes extend the grid's (Epic #86, E2.1)
     */
    readonly summaryRows: SummaryRowCounts;
    /** a summary row's height */
    readonly summaryRowHeight: number;
    /**
     * how many times `summary-rows.changed` said the figures behind the summary rows changed (0
     * before the first): their cells are drawn again
     */
    readonly summaryRevision: number;
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
    /**
     * the keys of the expanded row groups (Epic #87, E3.1): group rows (`GroupRow.key`) and rows
     * that expand (`RowMeta.expandable`, by their key), in the order expanded. The app's rows
     * follow them: the grid shows the rows it is given, and tells ARIA and the keys which expand
     */
    readonly expandedGroupKeys: readonly RowKey[];
    /** a measured detail's height until it is measured (`detailHeight: "auto"`) */
    readonly estimatedDetailHeight: number;
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
    /**
     * the keys of the collapsed groups, in the order they were collapsed (E1.3). A key that is no
     * collapsible group is kept: it may come back
     */
    readonly collapsedGroupKeys: readonly string[];
    /**
     * the grid's direction: in `"rtl"`, its start is the right edge; `undefined`, the page's (an
     * engine reads its viewport's)
     */
    readonly direction: GridDirection | undefined;
}

/** What `createDataGridModel` starts from. */
export interface DataGridModelOptions<TRow, TNode = unknown> {
    /** the columns, and the groups above them */
    columns?: readonly ColumnOrGroup<TRow, TNode>[];
    rows?: readonly TRow[];
    rowCount?: number;
    getRow?: (index: number) => TRow | undefined;
    /** what kind of row an index is (Epic #87): a group row, or a data row at a depth */
    getRowMeta?: RowMetaGetter | undefined;
    rowKey?: RowKeyGetter<TRow>;
    /**
     * a row's height in pixels, or a function of its index (default 35); `"auto"`: as tall as its
     * content, measured by an engine once rendered
     */
    rowHeight?: RowHeight;
    /** a measured row's height until it is measured, in pixels (default 35) */
    estimatedRowHeight?: number;
    /** a header row's height in pixels (default 35); 0 for no header */
    headerRowHeight?: number;
    /** how many summary rows the grid has at the top and at the bottom (default none) */
    summaryRows?: { readonly top?: number; readonly bottom?: number };
    /** a summary row's height in pixels (default 35) */
    summaryRowHeight?: number;
    activePosition?: CellPosition | null;
    /** the sorted columns to start with (entries that are not a sortable column are dropped) */
    sortColumns?: readonly SortColumn[];
    /** the keys of the rows expanded to start with (a key given twice counts once) */
    expandedRowKeys?: readonly RowKey[];
    /** the keys of the row groups expanded to start with (a key given twice counts once) */
    expandedGroupKeys?: readonly RowKey[];
    /**
     * an expanded row's detail height in pixels, or a function of the row (default 300); `"auto"`:
     * as tall as its content, measured by an engine once rendered
     */
    detailHeight?: DetailHeight<TRow>;
    /** a measured detail's height until it is measured, in pixels (default 300) */
    estimatedDetailHeight?: number;
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
    /** the keys of the groups collapsed to start with (an entry that is not a string is dropped) */
    collapsedGroupKeys?: readonly string[];
    /** the grid's direction (default: the page's, as an engine reads it from its viewport) */
    direction?: GridDirection | undefined;
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
     * replaces the expanded row groups' keys (Epic #87, each once): group rows' keys and the keys
     * of rows that expand. A key no row has is kept: its row may come. Returns them
     */
    "row-groups.set": {
        payload: { readonly groupKeys: readonly RowKey[] };
        result: readonly RowKey[];
    };
    /**
     * expands a row group, or collapses it when it is expanded: by its row's index (a group row,
     * or a loaded row that expands) or by its key. Returns the expanded row groups' keys
     */
    "row-groups.toggle": {
        payload:
            | { readonly rowIndex: number; readonly groupKey?: undefined }
            | { readonly groupKey: RowKey; readonly rowIndex?: undefined };
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
     * A group row (Epic #87, multiple mode) selects its rows' keys (`GroupRow.rowKeys`), or clears
     * them all when every one is selected; with `extend`, a range from the anchor to it.
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
     * group's entries, or the top level; that one may be fixed) within its part: one pinned at
     * the start beside another, one pinned at the end beside another, the others among theirs. One landing where it is commits nothing. Returns the column
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
     * replaces the collapsed groups' keys (each once). A key that is no collapsible group is
     * kept: it may come back. Returns them
     */
    "column-groups.set": {
        payload: { readonly groupKeys: readonly string[] };
        result: readonly string[];
    };
    /**
     * collapses a collapsible group, or expands it when it is collapsed (a group a collapsed one
     * hides included). Returns the collapsed groups' keys
     */
    "column-groups.toggle": {
        payload: { readonly groupKey: string };
        result: readonly string[];
    };
    /**
     * changes the grid's direction: in `"rtl"`, its start is the right edge; `null`, the page's
     * (an engine reads its viewport's). Returns it
     */
    "direction.set": {
        payload: { readonly direction: GridDirection | null };
        result: GridDirection | undefined;
    };
    /**
     * replaces how many summary rows the grid has at the top and at the bottom (a count left out
     * is 0): whole numbers, 0 or more. Returns them
     */
    "summary-rows.set": {
        payload: {
            readonly top?: number | undefined;
            readonly bottom?: number | undefined;
        };
        result: SummaryRowCounts;
    };
    /**
     * tells that the figures behind the summary rows changed (the app's data a column's
     * `renderSummaryCell` or `colSpan` reads, its columns the same): their cells are drawn and
     * spanned again. Nothing to tell without summary rows. Returns the summary revision
     */
    "summary-rows.changed": {
        payload: NoPayload;
        result: number;
    };
    /**
     * changes the row height (a number, a function of the index or `"auto"`), the header row's, a
     * summary row's, or an expanded row's detail height, and the estimates measured heights start
     * from (a size above 0)
     */
    "sizes.set": {
        payload: {
            readonly rowHeight?: RowHeight | undefined;
            readonly estimatedRowHeight?: number | undefined;
            readonly headerRowHeight?: number | undefined;
            readonly summaryRowHeight?: number | undefined;
            readonly detailHeight?: DetailHeight<TRow> | undefined;
            readonly estimatedDetailHeight?: number | undefined;
        };
        result: undefined;
    };
    /**
     * makes a cell the active one (rows -1 and above are the header, the top summary rows before
     * it, the bottom ones from `rowCount` on); a position inside a cell's span activates that
     * cell, at its own position
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
    /**
     * a row's key: `rowKey(row, index)`, or its index when there is no getter or no row yet; a
     * group row's `GroupRow.key` (Epic #87)
     */
    "row-key-by": {
        payload: { readonly rowIndex: number };
        result: string | number;
    };
    /**
     * a cell's value: `column.getValue`, or `row[column.key]`; `undefined` while not loaded. On a
     * group row (Epic #87), the group's value in its column, else its aggregate for the column
     */
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
    /** the collapsed groups' keys, in the order they were collapsed */
    "collapsed-group-keys": { payload: undefined; result: readonly string[] };
    "row-height": { payload: undefined; result: RowHeight };
    "header-row-height": { payload: undefined; result: number };
    /** how many summary rows the grid has, at the top and at the bottom */
    "summary-rows": { payload: undefined; result: SummaryRowCounts };
    "summary-row-height": { payload: undefined; result: number };
    /** the summary row at a row index (its position and index), or `undefined` for another row */
    "summary-row-by": {
        payload: { readonly rowIndex: number };
        result: SummaryRowView | undefined;
    };
    /** the grid's direction, `undefined` for the page's (an engine's view tells the one in effect) */
    direction: { payload: undefined; result: GridDirection | undefined };
    /** the expanded rows' keys, in the order they were expanded */
    "expanded-row-keys": { payload: undefined; result: readonly RowKey[] };
    /** the expanded row groups' keys (Epic #87), in the order they were expanded */
    "expanded-group-keys": { payload: undefined; result: readonly RowKey[] };
    /** what kind of row a row index is (Epic #87): `getRowMeta`'s answer, `undefined` without */
    "row-meta-by": {
        payload: { readonly rowIndex: number };
        result: RowMeta | undefined;
    };
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
    /** whether the row is loaded (its getter answered a row), or a group row (Epic #87) */
    "row-loaded": { readonly rowIndex: number };
    /** whether a column sorts the grid (a column, `sortable`) */
    "column-sortable": { readonly columnKey: string };
    /** whether a group is collapsed: a collapsible group, its key collapsed */
    "group-collapsed": { readonly groupKey: string };
    /** whether the row shows its detail: loaded, and its key expanded */
    "row-expanded": { readonly rowIndex: number };
    /**
     * whether the row heads an expanded row group (Epic #87): a group row, or a row that expands,
     * its key among the expanded group keys
     */
    "row-group-expanded": { readonly rowIndex: number };
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

// ── summary rows (Epic #86, E2.1) ────────────────────────────────────────────

/** Where a summary row stays: under the header, or at the view's bottom edge. */
export type SummaryPosition = "top" | "bottom";

/** How many summary rows a grid has, at the top and at the bottom. */
export interface SummaryRowCounts {
    readonly top: number;
    readonly bottom: number;
}

/** A summary row: its row index, its position, and its index among its position's rows. */
export interface SummaryRowView {
    readonly rowIndex: number;
    readonly position: SummaryPosition;
    /** 0 for the first of its position's rows, top to bottom */
    readonly summaryIndex: number;
}

/**
 * What a column's `renderSummaryCell` receives: which summary row it draws a cell of. The values
 * are the app's (it computes them in its own closure, over its own rows).
 */
export interface SummaryCellRenderProps<TRow, TNode = unknown> {
    readonly position: SummaryPosition;
    readonly summaryIndex: number;
    readonly column: Column<TRow, TNode>;
    readonly columnIndex: number;
}

/** What a column's `colSpan` is asked with for a summary row's cell (E2.1). */
export interface SummaryColSpanArgs {
    readonly type: "summary";
    readonly rowIndex: number;
    readonly position: SummaryPosition;
    readonly summaryIndex: number;
    readonly row?: undefined;
}

// ── row kinds and groups (Epic #87, E3.1) ────────────────────────────────────

/**
 * A group row (E3.1): the rows sharing a value of a column, shown as one row the grid never reads
 * a data row for. The app (or `@fragiola/data-grid/local`, or a server) makes it; the grid shows
 * it, expands it by its key and selects its rows by theirs.
 */
export interface GroupRow {
    /** unique among the grid's rows: what expands it (`expandedGroupKeys`) */
    readonly key: RowKey;
    /** the column its rows are grouped by */
    readonly columnKey: string;
    /** the value its rows share in that column */
    readonly value: unknown;
    /** its depth: 0 for a group at the top, 1 inside another, … */
    readonly depth: number;
    /** how many data rows it holds, at every depth below it (what a count shows) */
    readonly childCount: number;
    /** each column's aggregate over its rows, by column key (the app's figures) */
    readonly aggregates: Readonly<Record<string, unknown>>;
    /**
     * the keys of its data rows (the grid's row keys): what selecting it, a range over it and
     * select-all select, as given. List only the rows that can be selected: the grid cannot ask
     * `isRowSelectable` of rows it does not have (a collapsed group's). Without them, the group
     * row cannot be selected
     */
    readonly rowKeys?: readonly RowKey[] | undefined;
}

/**
 * What kind of row an index is (E3.1), and where it sits: `getRowMeta(index)`'s answer. Every
 * field is optional; a row without one is a data row at the top.
 */
export interface RowMeta {
    /** its depth in the tree: 0 at the top (default: a group's own, else 0) */
    readonly depth?: number | undefined;
    /** a group row: the grid reads no data row at its index (`getRow` may answer anything there) */
    readonly group?: GroupRow | undefined;
    /**
     * a data row with rows of its own under it (a tree's parent, Epic #87, E3.3): it expands by
     * its key, as a group row does by its group's
     */
    readonly expandable?: boolean | undefined;
    /** the index of the row it is under (← goes there); none at the top */
    readonly parentIndex?: number | undefined;
    /** how many rows share its parent (its `aria-setsize`) */
    readonly setSize?: number | undefined;
    /** its place among them, from 1 (its `aria-posinset`) */
    readonly posInSet?: number | undefined;
}

/** What kind of row an index is: `undefined` for a data row at the top. */
export type RowMetaGetter = (index: number) => RowMeta | undefined;

/** What a column's `renderGroupCell` receives (E3.1): a group row's cell. */
export interface GroupCellRenderProps<TRow, TNode = unknown> {
    readonly group: GroupRow;
    readonly rowIndex: number;
    readonly column: Column<TRow, TNode>;
    readonly columnIndex: number;
    /** the group's value in the column it groups by, else its aggregate for this column */
    readonly value: unknown;
}

/** What a column's `colSpan` is asked with for a group row's cell (E3.1). */
export interface GroupColSpanArgs {
    readonly type: "group";
    readonly rowIndex: number;
    readonly group: GroupRow;
    readonly row?: undefined;
}
