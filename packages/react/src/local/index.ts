// @fragiola/data-grid-react/local: rows in memory in one hook (Epic #47). An opt-in entry point:
// the primitives never import it, and an app that never imports it never ships it.

import type {
    RowKey,
    RowKeyGetter,
    RowMetaGetter,
    RowSelectable,
    SortColumn,
} from "@fragiola/data-grid";
import {
    createLocalRows,
    indexAfterMove,
    type LocalFilters,
    type LocalRowsOptions,
    moveRow as moveRowIn,
    shownRowMove,
} from "@fragiola/data-grid/local";
import {
    type ReactNode,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import type { ColumnOrGroup } from "../context";

export {
    groupKeyOf,
    type LocalFilters,
    type LocalRowsOptions,
} from "@fragiola/data-grid/local";

/** No grouping: the same list every render. */
const NO_GROUPS: readonly string[] = [];

/** Where `useLocalRows` starts, and how it groups (Epic #87). */
export interface UseLocalRowsOptions<TRow> extends LocalRowsOptions {
    /**
     * the columns to group the rows by, the outer one first (Epic #87): the grid shows a group
     * row per value, its rows under it while it is expanded. Followed: a new list groups again
     */
    readonly groupBy?: readonly string[] | undefined;
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
     * whether a row can be selected (as `DataGrid.Root`'s), called with its index among the rows
     * given: a group's `rowKeys`, what selecting it selects, leave out the rows it refuses. Give
     * it to the root too (for the rows' own checkboxes). Keep it the same function between renders
     */
    readonly isRowSelectable?: RowSelectable<TRow> | undefined;
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
    /** the grouping (Epic #87): its columns and its expanded groups, for the app's controls */
    readonly group: {
        /** the columns the rows are grouped by, the outer one first (none: not grouped) */
        readonly by: readonly string[];
        /** the expanded groups' keys */
        readonly expandedKeys: readonly RowKey[];
        /** expands these groups (the others collapse) */
        setExpandedKeys(expandedGroupKeys: readonly RowKey[]): void;
        /** expands every group, at every depth */
        expandAll(): void;
        collapseAll(): void;
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
     * The grid moves no row while it is sorted. Stable: it reads the latest rows, and moves told
     * before the next render apply one after the other (each to the rows the last one returned).
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

/**
 * Rows in memory, sorted, filtered, searched, grouped and paged, in one hook: it keeps that state
 * itself. Spread `props` onto `DataGrid.Root` (its rows and its sort; grouped, the rows shown, their
 * kinds and the expanded groups), and give `filter`, `group` and `page` to the app's own controls.
 * `options` is where it starts (`pageSize`, `defaultSortColumns`, `defaultFilters`,
 * `defaultSearch`, `defaultPageIndex`, `defaultExpandedGroupKeys`; a new `pageSize` and a new
 * `groupBy` are followed); a filter, the search or the sort changing goes back to the first page.
 * Grouped (`groupBy`, Epic #87), the sort and the filters apply inside the groups, the groups are
 * ordered by the sort when it sorts their column (else ascending), and a page is of the rows shown,
 * group rows included.
 *
 * Keep `rows` and `columns` the same arrays between renders (outside the component, or memoised),
 * as `DataGrid.Root` wants its `columns`: each stage is computed again when they change.
 */
export function useLocalRows<TRow>(
    rows: readonly TRow[],
    columns: readonly ColumnOrGroup<TRow>[],
    options?: UseLocalRowsOptions<TRow>,
): LocalRowsResult<TRow> {
    const [local] = useState(() =>
        createLocalRows<TRow, ReactNode>(options ?? {}),
    );
    // `pageSize` is followed: a new one sets the page size (the first page)
    const pageSize = options?.pageSize;
    const appliedPageSize = useRef(pageSize);
    useEffect(() => {
        if (Object.is(appliedPageSize.current, pageSize)) return;
        appliedPageSize.current = pageSize;
        local.setPageSize(pageSize);
    }, [local, pageSize]);
    const state = useSyncExternalStore(
        local.subscribe,
        () => local.state,
        () => local.state,
    );
    // the expanded groups: controlled, the option's; else the pipeline's own, and the app told
    // the latest options, as of the last commit (a discarded render writes nothing)
    const latestOptions = useRef(options);
    useLayoutEffect(() => {
        latestOptions.current = options;
    });
    const [setExpanded] = useState(
        () => (expandedGroupKeys: readonly RowKey[]) => {
            const given = latestOptions.current;
            if (given?.expandedGroupKeys === undefined) {
                local.setExpandedGroupKeys(expandedGroupKeys);
            }
            given?.onExpandedGroupKeysChange?.(expandedGroupKeys);
        },
    );
    const expandedGroupKeys =
        options?.expandedGroupKeys ?? state.expandedGroupKeys;
    const groupBy = options?.groupBy ?? NO_GROUPS;
    // stage by stage, computed again only when its own inputs change: cheap on every render
    const view = local.derive(rows, columns, {
        groupBy,
        aggregates: options?.aggregates,
        rowKey: options?.rowKey,
        isRowSelectable: options?.isRowSelectable,
        expandedGroupKeys,
    });
    // not grouped, the app's key with the index it takes (its row's among the rows given): the
    // same keys whether the rows are grouped or not
    const rowKey = options?.rowKey;
    const plainRowKey = useMemo(
        () =>
            rowKey &&
            ((row: TRow, index: number) =>
                rowKey(row, view.rowIndexes[index] ?? index)),
        [rowKey, view],
    );
    // a page past the last (the rows shrank) showed the last one: once on screen, it is the page,
    // so rows growing back stay there (written after the commit: a discarded render writes nothing)
    useEffect(() => {
        if (view.pageIndex !== state.pageIndex)
            local.setPageIndex(view.pageIndex);
    }, [local, view.pageIndex, state.pageIndex]);
    // the rows and where the rows shown are among them, as of the last commit or as the last
    // move left them: a next move before a render is one on screen after this one
    const moved = useRef<{
        rows: readonly TRow[];
        view: { readonly rowIndexes: readonly number[] };
    }>({ rows, view });
    useLayoutEffect(() => {
        moved.current = { rows, view };
    });
    const [moveRow] = useState(
        () =>
            ({
                fromIndex,
                toIndex,
            }: {
                fromIndex: number;
                toIndex: number;
            }) => {
                const { rows: given, view: shown } = moved.current;
                const move = shownRowMove(shown.rowIndexes, fromIndex, toIndex);
                if (!move) return given;
                const next = moveRowIn(given, move.fromIndex, move.toIndex);
                // where the rows shown are now: each one where the move put it, in their new order
                const rowIndexes = moveRowIn(
                    shown.rowIndexes.map((index) =>
                        indexAfterMove(index, move.fromIndex, move.toIndex),
                    ),
                    fromIndex,
                    toIndex,
                );
                moved.current = { rows: next, view: { rowIndexes } };
                return next;
            },
    );
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
                  ...(plainRowKey ? { rowKey: plainRowKey } : {}),
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
            by: groupBy,
            expandedKeys: expandedGroupKeys,
            setExpandedKeys: setExpanded,
            expandAll: () => setExpanded(groups?.groupKeys ?? []),
            collapseAll: () => setExpanded([]),
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
        moveRow,
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
