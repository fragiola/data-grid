// @fragiola/data-grid-react/local: rows in memory in one hook (Epic #47). An opt-in entry point:
// the primitives never import it, and an app that never imports it never ships it.

import type { SortColumn } from "@fragiola/data-grid";
import {
    createLocalRows,
    type LocalFilters,
    type LocalRowsOptions,
} from "@fragiola/data-grid/local";
import {
    type ReactNode,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import type { ColumnOrGroup } from "../context";

export type {
    LocalFilters,
    LocalRowsOptions,
} from "@fragiola/data-grid/local";

/** What `useLocalRows` hands `DataGrid.Root`: spread it (`{...local.props}`). */
export interface LocalRowsProps<TRow> {
    /** the current page's rows, filtered, searched and sorted */
    readonly rows: readonly TRow[];
    readonly sortColumns: readonly SortColumn[];
    readonly onSortColumnsChange: (sortColumns: readonly SortColumn[]) => void;
}

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
 * Rows in memory, sorted, filtered, searched and paged, in one hook: it keeps that state itself.
 * Spread `props` onto `DataGrid.Root` (its rows and its sort), and give `filter` and `page` to the
 * app's own controls. `options` is where it starts (`pageSize`, `defaultSortColumns`,
 * `defaultFilters`, `defaultSearch`, `defaultPageIndex`; a new `pageSize` is followed); a filter,
 * the search or the sort changing goes back to the first page.
 *
 * Keep `rows` and `columns` the same arrays between renders (outside the component, or memoised),
 * as `DataGrid.Root` wants its `columns`: each stage is computed again when they change.
 */
export function useLocalRows<TRow>(
    rows: readonly TRow[],
    columns: readonly ColumnOrGroup<TRow>[],
    options?: LocalRowsOptions,
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
    // stage by stage, computed again only when its own inputs change: cheap on every render
    const view = local.derive(rows, columns);
    // a page past the last (the rows shrank) showed the last one: once on screen, it is the page,
    // so rows growing back stay there (written after the commit: a discarded render writes nothing)
    useEffect(() => {
        if (view.pageIndex !== state.pageIndex)
            local.setPageIndex(view.pageIndex);
    }, [local, view.pageIndex, state.pageIndex]);
    const last = view.pageCount - 1;
    return {
        props: {
            rows: view.rows,
            sortColumns: state.sortColumns,
            onSortColumnsChange: local.setSortColumns,
        },
        rows: view.rows,
        total: view.total,
        filteredCount: view.filteredCount,
        // built when first read: an app that never reads it never pays for it
        get filteredRows() {
            return view.filteredRows;
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
