// What every adapter's `useLocalRows` takes and gives (Epic #123): its options, the props it
// hands a root and the controls it gives the app's UI, built once here from the pipeline.

import type {
    RowKey,
    RowKeyGetter,
    RowMetaGetter,
    SortColumn,
} from "../model/types";
import type { LocalFilters } from "./filter";
import type {
    LocalRows,
    LocalRowsOptions,
    LocalRowsState,
    LocalRowsView,
} from "./rows";

/** Where `useLocalRows` starts, and how it groups (Epic #87). */
export interface UseLocalRowsOptions<TRow> extends LocalRowsOptions {
    /**
     * the columns to group the rows by, the outer one first (Epic #87): the grid shows a group
     * row per value, its rows under it while it is expanded. Followed: a new list groups again
     */
    readonly groupBy?: readonly string[] | undefined;
    /**
     * the rows under a row (Epic #87, tree data): given, `rows` are the tree's top rows, shown as
     * a tree whose parents expand by their key (`rowKey`, else their place in the whole tree read
     * top to bottom); `groupBy` is then not read. Keep it the same function between renders
     */
    readonly getSubRows?:
        | ((row: TRow) => readonly TRow[] | undefined)
        | undefined;
    /**
     * each column's aggregate over a group's rows, by column key: what the group row's cell in
     * that column shows (`GroupRow.aggregates`). Keep it the same object between renders
     */
    readonly aggregates?:
        | Readonly<Record<string, (rows: readonly TRow[]) => unknown>>
        | undefined;
    /**
     * a data row's key, as `DataGrid.Root`'s, called with its index among the rows given; without
     * one, grouped rows are keyed by that index. Grouped, the props carry it: give it here, not to
     * the root. Keep it the same function between renders
     */
    readonly rowKey?: RowKeyGetter<TRow> | undefined;
    /**
     * whether a row can be selected, a function of the row only, so the same one works for
     * `DataGrid.Root`'s `isRowSelectable` (give it there too, for the rows' own checkboxes): a
     * group's `rowKeys` and a tree parent's `subRowKeysOf` leave out the rows it refuses. Keep it
     * the same function between renders
     */
    readonly isRowSelectable?: ((row: TRow) => boolean) | undefined;
    /** the expanded groups' keys, controlled (`groupKeyOf`); pair it with `onExpandedGroupKeysChange` */
    readonly expandedGroupKeys?: readonly RowKey[] | undefined;
    /** the expanded groups changed (or, controlled, ask to) */
    readonly onExpandedGroupKeysChange?:
        | ((expandedGroupKeys: readonly RowKey[]) => void)
        | undefined;
}

/**
 * What `useLocalRows` hands `DataGrid.Root`: spread it (`{...local.props}`). The current page's
 * rows, filtered, searched and sorted, and the sort; grouped (Epic #87), the rows shown as a count
 * and getters (group rows and the rows of the expanded ones), their keys and the expanded groups.
 */
export type LocalRowsProps<TRow> = {
    readonly sortColumns: readonly SortColumn[];
    readonly onSortColumnsChange: (sortColumns: readonly SortColumn[]) => void;
} & (
    | {
          readonly rows: readonly TRow[];
          readonly rowCount?: undefined;
          readonly getRow?: undefined;
          readonly getRowMeta?: undefined;
          /** the `rowKey` option, when given, called with a row's index among the rows given */
          readonly rowKey?: RowKeyGetter<TRow>;
      }
    | {
          readonly rows?: undefined;
          readonly rowCount: number;
          readonly getRow: (index: number) => TRow | undefined;
          readonly getRowMeta: RowMetaGetter;
          readonly rowKey: RowKeyGetter<TRow>;
          readonly expandedGroupKeys: readonly RowKey[];
          readonly onExpandedGroupKeysChange: (
              expandedGroupKeys: readonly RowKey[],
          ) => void;
      }
);

/** Everything `useLocalRows` gives: the props for the grid, and the controls for the app's UI. */
export interface LocalRowsResult<TRow> {
    /** spread onto `DataGrid.Root` */
    readonly props: LocalRowsProps<TRow>;
    /** the current page's rows (the same as `props.rows`) */
    readonly rows: readonly TRow[];
    /** every row given */
    readonly total: number;
    /** the rows passing the filters and the search */
    readonly filteredCount: number;
    /** every page's rows, filtered, searched and sorted: "select all" across pages */
    readonly filteredRows: readonly TRow[];
    /**
     * the grouping or the tree (Epic #87): its columns, its expanded groups (a tree's parents),
     * for the app's controls
     */
    readonly group: {
        /** the columns the rows are grouped by, the outer one first (none: not grouped) */
        readonly by: readonly string[];
        /** the expanded groups' keys */
        readonly expandedKeys: readonly RowKey[];
        /** expands these groups (the others collapse) */
        setExpandedKeys(expandedGroupKeys: readonly RowKey[]): void;
        /** expands every group (a tree's every parent), at every depth */
        expandAll(): void;
        collapseAll(): void;
        /**
         * the keys of the rows under the row shown at `rowIndex`: a group's rows, a tree parent's
         * rows at every depth (collapsed ones included); none for another row. What a parent's
         * checkbox selects with it (`toggledRowKeys` in `@fragiola/data-grid/selection`)
         */
        subRowKeysOf(rowIndex: number): readonly RowKey[];
    };
    readonly sort: {
        /** the sorted columns, the first one first (the header toggles them too) */
        readonly columns: readonly SortColumn[];
        set(sortColumns: readonly SortColumn[]): void;
        clear(): void;
    };
    readonly filter: {
        /** the filters by column key */
        readonly values: LocalFilters;
        /** filters a column by a value: a text contains, a list holds, else equals (or `Column.filter`); empty clears */
        set(columnKey: string, value: unknown): void;
        /** clears every filter, or one column's */
        clear(columnKey?: string): void;
        /** the text every column is searched for */
        readonly search: string;
        setSearch(text: string): void;
    };
    /**
     * The rows given, with a move of the rows the grid shows applied (Epic #86: `DataGrid.Root`'s
     * `onRowMove`): the moved row placed beside the row it lands next to on screen, a filtered or
     * paged grid's included. A new array to set as the rows (`rows` itself when nothing moves).
     * The grid moves no row while it is sorted, nor while its rows have kinds; in tree mode
     * (`getSubRows`) it moves nothing and returns `rows` (a tree's rows are not one list). Stable:
     * it reads the latest rows, and moves told before the next render apply one after the other
     * (each to the rows the last one returned).
     */
    moveRow(move: {
        readonly fromIndex: number;
        readonly toIndex: number;
    }): readonly TRow[];
    readonly page: {
        /** the current page, from 0 */
        readonly index: number;
        /** rows per page; `undefined`: a single page of every row */
        readonly size: number | undefined;
        /** how many pages there are (1 at least) */
        readonly count: number;
        readonly canPrevious: boolean;
        readonly canNext: boolean;
        set(pageIndex: number): void;
        previous(): void;
        next(): void;
        first(): void;
        last(): void;
        setSize(pageSize: number | undefined): void;
    };
}

/** What an adapter's `useLocalRows` keeps between renders, for `localRowsResult`. */
export interface LocalRowsInputs<TRow> {
    readonly local: LocalRows<TRow, unknown>;
    readonly state: LocalRowsState;
    /** the rows shown, as `local.derive` made them */
    readonly view: LocalRowsView<TRow>;
    /** the groups expanded: controlled, the option's; else the pipeline's own */
    readonly expandedGroupKeys: readonly RowKey[];
    readonly groupBy: readonly string[];
    /** the app's key not grouped, with the index of its row among the rows given (`plainRowKey`) */
    readonly rowKey: RowKeyGetter<TRow> | undefined;
    /** expands these groups (the others collapse): the option's handler, uncontrolled the pipeline */
    readonly setExpanded: (expandedGroupKeys: readonly RowKey[]) => void;
    /** the keys of the rows under the row shown at an index (`groups.subRowKeysOf`) */
    readonly subRowKeysOf: (rowIndex: number) => readonly RowKey[];
    readonly moveRow: LocalRowsResult<TRow>["moveRow"];
}

/**
 * The app's key with the index it takes not grouped (its row's among the rows given): the same keys
 * whether the rows are grouped or not.
 */
export function plainRowKey<TRow>(
    rowKey: RowKeyGetter<TRow> | undefined,
    view: LocalRowsView<TRow>,
): RowKeyGetter<TRow> | undefined {
    return (
        rowKey &&
        ((row: TRow, index: number) =>
            rowKey(row, view.rowIndexes[index] ?? index))
    );
}

/** What `useLocalRows` gives, from what it keeps (`LocalRowsInputs`). */
export function localRowsResult<TRow>(
    inputs: LocalRowsInputs<TRow>,
): LocalRowsResult<TRow> {
    const { local, state, view, expandedGroupKeys, setExpanded } = inputs;
    const last = view.pageCount - 1;
    const { groups } = view;
    const sort = {
        sortColumns: state.sortColumns,
        onSortColumnsChange: local.setSortColumns,
    };
    return {
        props: groups
            ? {
                  rowCount: groups.rowCount,
                  getRow: groups.getRow,
                  getRowMeta: groups.getRowMeta,
                  rowKey: groups.rowKey,
                  expandedGroupKeys,
                  onExpandedGroupKeysChange: setExpanded,
                  ...sort,
              }
            : {
                  rows: view.rows,
                  ...(inputs.rowKey ? { rowKey: inputs.rowKey } : {}),
                  ...sort,
              },
        rows: view.rows,
        total: view.total,
        filteredCount: view.filteredCount,
        // built when first read: an app that never reads it never pays for it
        get filteredRows() {
            return view.filteredRows;
        },
        group: {
            by: inputs.groupBy,
            expandedKeys: expandedGroupKeys,
            setExpandedKeys: setExpanded,
            expandAll: () => setExpanded(groups?.groupKeys ?? []),
            collapseAll: () => setExpanded([]),
            subRowKeysOf: inputs.subRowKeysOf,
        },
        sort: {
            columns: state.sortColumns,
            set: local.setSortColumns,
            clear: () => local.setSortColumns([]),
        },
        filter: {
            values: state.filters,
            set: local.setFilter,
            clear: local.clearFilters,
            search: state.search,
            setSearch: local.setSearch,
        },
        moveRow: inputs.moveRow,
        page: {
            index: view.pageIndex,
            size: view.pageSize,
            count: view.pageCount,
            canPrevious: view.pageIndex > 0,
            canNext: view.pageIndex < last,
            set: local.setPageIndex,
            previous: () => local.setPageIndex(Math.max(0, view.pageIndex - 1)),
            next: () => local.setPageIndex(Math.min(last, view.pageIndex + 1)),
            first: () => local.setPageIndex(0),
            last: () => local.setPageIndex(last),
            setSize: local.setPageSize,
        },
    };
}
