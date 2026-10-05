import { leafColumns } from "../header/header";
import type { ColumnOrGroup, SortColumn } from "../model/types";
import { memo } from "../utils";
import {
    entriesOf,
    filterEntries,
    isEmptyFilter,
    type LocalFilters,
    type RowEntry,
    searchEntries,
    searchTextsOf,
} from "./filter";
import { clampPageIndex, pageCount, pageOf } from "./page";
import { sortEntries } from "./sort";

// The local pipeline (Epic #47): rows in memory filtered, searched, sorted and paged, in that
// order, each stage computed again only when its own inputs change.

/** The rows sorted by `sortColumns` (see `Column.compare`; empty values last; stable). */
export function sortRows<TRow, TNode>(
    rows: readonly TRow[],
    sortColumns: readonly SortColumn[],
    columns: readonly ColumnOrGroup<TRow, TNode>[],
): TRow[] {
    return sortEntries(entriesOf(rows), sortColumns, leafColumns(columns)).map(
        (entry) => entry.row,
    );
}

/** The rows passing every column's filter (see `Column.filter`; a text contains, a list holds). */
export function filterRows<TRow, TNode>(
    rows: readonly TRow[],
    filters: LocalFilters,
    columns: readonly ColumnOrGroup<TRow, TNode>[],
): TRow[] {
    return filterEntries(entriesOf(rows), filters, leafColumns(columns)).map(
        (entry) => entry.row,
    );
}

/** The rows where any column's value, as text, contains `text` (case and accents aside). */
export function searchRows<TRow, TNode>(
    rows: readonly TRow[],
    text: string,
    columns: readonly ColumnOrGroup<TRow, TNode>[],
): TRow[] {
    return searchEntries(entriesOf(rows), text, leafColumns(columns)).map(
        (entry) => entry.row,
    );
}

/** A page of the rows: `pageSize` of them from page `pageIndex` (kept inside the pages there are). */
export function pageRows<TRow>(
    rows: readonly TRow[],
    pageIndex: number,
    pageSize: number | undefined,
): TRow[] {
    return [...pageOf(rows, pageIndex, pageSize)];
}

/** Where the local pipeline starts: every field optional. */
export interface LocalRowsOptions {
    readonly defaultSortColumns?: readonly SortColumn[] | undefined;
    readonly defaultFilters?: LocalFilters | undefined;
    readonly defaultSearch?: string | undefined;
    /** rows per page; without one, a single page of every row */
    readonly pageSize?: number | undefined;
    readonly defaultPageIndex?: number | undefined;
}

/** What the local pipeline keeps: the state its controls change. */
export interface LocalRowsState {
    readonly sortColumns: readonly SortColumn[];
    readonly filters: LocalFilters;
    readonly search: string;
    /** as set: `derive` shows the last page when it is past it */
    readonly pageIndex: number;
    readonly pageSize: number | undefined;
}

/** What the local pipeline derives from the rows: the page to show, and the counts. */
export interface LocalRowsView<TRow> {
    /** the current page's rows, filtered, searched and sorted */
    readonly rows: readonly TRow[];
    /**
     * where the current page's rows are among the rows given, in their order (`rows[i]` is the
     * rows given's `rowIndexes[i]`): positions, so rows equal to each other are told apart (a
     * move of the rows shown, `moveShownRow`). Built when first read
     */
    readonly rowIndexes: readonly number[];
    /** every row given */
    readonly total: number;
    /** the rows passing the filters and the search */
    readonly filteredCount: number;
    /**
     * every page's rows, filtered, searched and sorted: what "select all" means across pages
     * (Epic #57). Built when first read (the rows given, when nothing filters or sorts them),
     * the same array until the rows, the filters, the search or the sort change
     */
    readonly filteredRows: readonly TRow[];
    /** the current page, kept inside the pages there are */
    readonly pageIndex: number;
    readonly pageSize: number | undefined;
    readonly pageCount: number;
}

/** A local pipeline: its state, the methods that change it, and the rows it derives. */
export interface LocalRows<TRow, TNode = unknown> {
    /** the state: a new object after every change */
    readonly state: LocalRowsState;
    /** listens to state changes; returns the unsubscription */
    subscribe(listener: () => void): () => void;
    /**
     * The page to show of these rows, with the counts. Each stage is computed again only when its
     * own inputs change (the rows, the columns, then the state each stage reads): the same
     * object while nothing changed.
     */
    derive(
        rows: readonly TRow[],
        columns: readonly ColumnOrGroup<TRow, TNode>[],
    ): LocalRowsView<TRow>;
    /** sorts by these columns, from the first page */
    setSortColumns(sortColumns: readonly SortColumn[]): void;
    /** filters a column by a value (an empty one clears it), from the first page */
    setFilter(columnKey: string, value: unknown): void;
    /** clears every filter, or one column's, from the first page */
    clearFilters(columnKey?: string): void;
    /** searches every column for a text, from the first page */
    setSearch(text: string): void;
    setPageIndex(pageIndex: number): void;
    /** rows per page (none: a single page), from the first page */
    setPageSize(pageSize: number | undefined): void;
}

/**
 * A local pipeline for rows in memory. Framework-free: an adapter subscribes to its state and
 * calls `derive` with the rows and the columns (`useLocalRows` in `@fragiola/data-grid-react/local`).
 */
export function createLocalRows<TRow, TNode = unknown>(
    options: LocalRowsOptions = {},
): LocalRows<TRow, TNode> {
    let state: LocalRowsState = {
        sortColumns: options.defaultSortColumns ?? [],
        filters: withoutEmpty(options.defaultFilters ?? {}),
        search: options.defaultSearch ?? "",
        pageIndex: validPageIndex(options.defaultPageIndex ?? 0),
        pageSize: validPageSize(options.pageSize),
    };
    const listeners = new Set<() => void>();

    function update(next: Partial<LocalRowsState>, firstPage: boolean) {
        const changed = (Object.keys(next) as (keyof LocalRowsState)[]).some(
            (key) => !Object.is(next[key], state[key]),
        );
        if (!changed) return;
        state = { ...state, ...next, ...(firstPage ? { pageIndex: 0 } : {}) };
        for (const listener of [...listeners]) listener();
    }

    const leaves = memo(leafColumns<TRow, TNode>);
    const entries = memo(entriesOf<TRow>);
    const filtered = memo(filterEntries<TRow, TNode>);
    const searched = memo(searchEntries<TRow, TNode>);
    // each row's text, folded, for the search: worked out once per rows and columns, not per key
    const texts = memo(searchTextsOf<TRow, TNode>);
    const sorted = memo(sortEntries<TRow, TNode>);
    const rowsOf = memo((ordered: readonly RowEntry<TRow>[]) =>
        ordered.map((entry) => entry.row),
    );
    const view = memo(
        (
            ordered: readonly RowEntry<TRow>[],
            all: readonly RowEntry<TRow>[],
            given: readonly TRow[],
            total: number,
            pageIndex: number,
            pageSize: number | undefined,
        ): LocalRowsView<TRow> => {
            const index = clampPageIndex(pageIndex, ordered.length, pageSize);
            const page = pageOf(ordered, index, pageSize);
            let rowIndexes: readonly number[] | undefined;
            return {
                rows: page.map((entry) => entry.row),
                get rowIndexes() {
                    rowIndexes ??= page.map((entry) => entry.index);
                    return rowIndexes;
                },
                total,
                filteredCount: ordered.length,
                get filteredRows() {
                    return ordered === all ? given : rowsOf(ordered);
                },
                pageIndex: index,
                pageSize,
                pageCount: pageCount(ordered.length, pageSize),
            };
        },
    );

    return {
        get state() {
            return state;
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        derive(rows, columns) {
            const columnsOf = leaves(columns);
            const all = entries(rows);
            const ordered = sorted(
                searched(
                    filtered(all, state.filters, columnsOf),
                    state.search,
                    columnsOf,
                    state.search.trim() === ""
                        ? undefined
                        : texts(all, columnsOf),
                ),
                state.sortColumns,
                columnsOf,
            );
            // pure: a page past the last shows the last; the state keeps what was set (an adapter
            // may write the shown page back once it is on screen)
            return view(
                ordered,
                all,
                rows,
                rows.length,
                state.pageIndex,
                state.pageSize,
            );
        },
        setSortColumns: (sortColumns) => update({ sortColumns }, true),
        setFilter: (columnKey, value) => {
            const filters = withoutEmpty({
                ...state.filters,
                [columnKey]: value,
            });
            if (sameFilters(filters, state.filters)) return;
            update({ filters }, true);
        },
        clearFilters: (columnKey) => {
            const filters =
                columnKey === undefined
                    ? {}
                    : withoutEmpty({
                          ...state.filters,
                          [columnKey]: undefined,
                      });
            if (sameFilters(filters, state.filters)) return;
            update({ filters }, true);
        },
        setSearch: (search) => update({ search }, true),
        setPageIndex: (pageIndex) =>
            update({ pageIndex: validPageIndex(pageIndex) }, false),
        setPageSize: (pageSize) =>
            update({ pageSize: validPageSize(pageSize) }, true),
    };
}

/** A page index: a whole number, 0 or more (anything else is the first page). */
function validPageIndex(pageIndex: number): number {
    return Number.isFinite(pageIndex) ? Math.max(0, Math.floor(pageIndex)) : 0;
}

/** A page size, or none: a whole number above 0. */
function validPageSize(pageSize: number | undefined): number | undefined {
    return pageSize !== undefined && Number.isFinite(pageSize) && pageSize >= 1
        ? Math.floor(pageSize)
        : undefined;
}

/** The filters without the empty ones (they filter nothing). */
function withoutEmpty(filters: LocalFilters): LocalFilters {
    return Object.fromEntries(
        Object.entries(filters).filter(([, value]) => !isEmptyFilter(value)),
    );
}

function sameFilters(a: LocalFilters, b: LocalFilters): boolean {
    const keys = Object.keys(a);
    return (
        keys.length === Object.keys(b).length &&
        keys.every((key) => Object.hasOwn(b, key) && Object.is(a[key], b[key]))
    );
}
