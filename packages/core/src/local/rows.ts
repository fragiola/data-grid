import { leafColumns } from "../header/header";
import type { ColumnOrGroup, RowKey, SortColumn } from "../model/types";
import { memo, sameList } from "../utils";
import {
    entriesOf,
    filterEntries,
    isEmptyFilter,
    type LocalFilters,
    type RowEntry,
    searchEntries,
    searchTextsOf,
} from "./filter";
import {
    type GroupedRows,
    groupedRowsOf,
    groupKeysOf,
    groupTree,
    type LocalGrouping,
    type ShownRow,
    shownRowsOf,
} from "./group";
import { clampPageIndex, pageCount, pageOf } from "./page";
import { sortEntries } from "./sort";
import {
    keptTree,
    parentKeysOf,
    shownTreeOf,
    treeEntriesOf,
    treeOf,
} from "./tree";

// The local pipeline (Epic #47): rows in memory filtered, searched, sorted, grouped (Epic #87) and
// paged, in that order, each stage computed again only when its own inputs change.

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

/**
 * The rows grouped by `grouping.groupBy` (Epic #87), in their order (sort them first), flattened as
 * the grid shows them: each group row, then, while its key is in `grouping.expandedGroupKeys`, its
 * groups or rows. The groups are ordered by their value, ascending, an empty one last.
 */
export function groupRows<TRow, TNode>(
    rows: readonly TRow[],
    columns: readonly ColumnOrGroup<TRow, TNode>[],
    grouping: LocalGrouping<TRow>,
): GroupedRows<TRow> {
    const groups = groupTree(
        entriesOf(rows),
        grouping.groupBy ?? [],
        leafColumns(columns),
        [],
        grouping.aggregates,
        grouping.rowKey,
        grouping.isRowSelectable,
    );
    return groupedRowsOf(
        shownRowsOf(groups, grouping.expandedGroupKeys ?? []),
        0,
        groupKeysOf(groups),
        grouping.rowKey,
        grouping.isRowSelectable,
    );
}

/**
 * The rows as a tree (Epic #87, E3.3): `rows` its top rows, `grouping.getSubRows` each row's rows,
 * flattened as the grid shows them: each row, then, while it is a parent whose key is in
 * `grouping.expandedGroupKeys`, its rows. Each row's index (`getValue`'s, the default key) is its
 * place in the whole tree read top to bottom.
 */
export function treeRows<TRow>(
    rows: readonly TRow[],
    grouping: LocalGrouping<TRow> & {
        readonly getSubRows: (row: TRow) => readonly TRow[] | undefined;
    },
): GroupedRows<TRow> {
    const { roots } = treeOf(rows, grouping.getSubRows);
    return groupedRowsOf(
        shownTreeOf(roots, grouping.expandedGroupKeys ?? [], grouping.rowKey),
        0,
        parentKeysOf(roots, grouping.rowKey),
        grouping.rowKey,
        grouping.isRowSelectable,
    );
}

/** Where the local pipeline starts: every field optional. */
export interface LocalRowsOptions {
    readonly defaultSortColumns?: readonly SortColumn[] | undefined;
    readonly defaultFilters?: LocalFilters | undefined;
    readonly defaultSearch?: string | undefined;
    /** rows per page; without one, a single page of every row */
    readonly pageSize?: number | undefined;
    readonly defaultPageIndex?: number | undefined;
    /** the groups expanded to start with, by key (`groupKeyOf`), when rows are grouped */
    readonly defaultExpandedGroupKeys?: readonly RowKey[] | undefined;
}

/** What the local pipeline keeps: the state its controls change. */
export interface LocalRowsState {
    readonly sortColumns: readonly SortColumn[];
    readonly filters: LocalFilters;
    readonly search: string;
    /** as set: `derive` shows the last page when it is past it */
    readonly pageIndex: number;
    readonly pageSize: number | undefined;
    /** the expanded groups' keys (Epic #87), while rows are grouped */
    readonly expandedGroupKeys: readonly RowKey[];
}

/** What the local pipeline derives from the rows: the page to show, and the counts. */
export interface LocalRowsView<TRow> {
    /**
     * the current page's rows, filtered, searched and sorted (grouped: the data rows it shows, in
     * order, group rows aside)
     */
    readonly rows: readonly TRow[];
    /**
     * where the current page's rows are among the rows given, in their order (`rows[i]` is the
     * rows given's `rowIndexes[i]`): positions, so rows equal to each other are told apart (a
     * move of the rows shown, `moveShownRow`). Built when first read
     */
    readonly rowIndexes: readonly number[];
    /** every row given */
    readonly total: number;
    /**
     * the rows passing the filters and the search (a tree's: the rows they leave, at every
     * depth, a match's ancestors included)
     */
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
    /** grouped (Epic #87): of the rows shown, group rows included */
    readonly pageCount: number;
    /**
     * the rows grouped (Epic #87: `groupBy` given), as the grid takes them: the current page of
     * the rows shown, group rows and the rows of the expanded ones; `null` without grouping
     */
    readonly groups: GroupedRows<TRow> | null;
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
        grouping?: LocalGrouping<TRow>,
    ): LocalRowsView<TRow>;
    /** the groups expanded, by key (Epic #87); the page stays */
    setExpandedGroupKeys(expandedGroupKeys: readonly RowKey[]): void;
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
        expandedGroupKeys: options.defaultExpandedGroupKeys ?? [],
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
    /**
     * A view of a page: its data rows (`entries`), the rows filtered (`ordered`: `given` itself
     * when `allGiven`, the caller's to say), the rows' total, and the page's place and groups.
     */
    function pagedView(
        entries: readonly RowEntry<TRow>[],
        ordered: readonly RowEntry<TRow>[],
        allGiven: boolean,
        given: readonly TRow[],
        total: number,
        paging: Pick<
            LocalRowsView<TRow>,
            "pageIndex" | "pageSize" | "pageCount" | "groups"
        >,
    ): LocalRowsView<TRow> {
        let rowIndexes: readonly number[] | undefined;
        return {
            rows: entries.map((entry) => entry.row),
            get rowIndexes() {
                rowIndexes ??= entries.map((entry) => entry.index);
                return rowIndexes;
            },
            total,
            filteredCount: ordered.length,
            get filteredRows() {
                return allGiven ? given : rowsOf(ordered);
            },
            ...paging,
        };
    }
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
            return pagedView(page, ordered, ordered === all, given, total, {
                pageIndex: index,
                pageSize,
                pageCount: pageCount(ordered.length, pageSize),
                groups: null,
            });
        },
    );
    // grouped (Epic #87): the groups, the rows shown, and their page
    const groupByOf = kept<string>();
    const tree = memo(groupTree<TRow, TNode>);
    const shownOf = memo(shownRowsOf<TRow>);
    const keysOf = memo(groupKeysOf<TRow>);
    // a tree (E3.3): read once per rows, kept per filter and sort, shown per expansion
    const treeFrom = memo(treeOf<TRow>);
    const keptOf = memo(keptTree<TRow, TNode>);
    const shownTree = memo(shownTreeOf<TRow>);
    const parentKeys = memo(parentKeysOf<TRow>);
    const treeEntries = memo(treeEntriesOf<TRow>);
    const groupedView = memo(
        (
            shown: readonly ShownRow<TRow>[],
            groupKeys: readonly RowKey[],
            ordered: readonly RowEntry<TRow>[],
            all: readonly RowEntry<TRow>[],
            given: readonly TRow[],
            pageIndex: number,
            pageSize: number | undefined,
            rowKey: LocalGrouping<TRow>["rowKey"],
            isRowSelectable: LocalGrouping<TRow>["isRowSelectable"],
        ): LocalRowsView<TRow> => {
            const index = clampPageIndex(pageIndex, shown.length, pageSize);
            const page = pageOf(shown, index, pageSize);
            const entries = page.flatMap((row) =>
                row.entry ? [row.entry] : [],
            );
            // a tree's rows at every depth (more than `given`, its top rows)
            const allGiven = ordered === all && all.length === given.length;
            return pagedView(entries, ordered, allGiven, given, all.length, {
                pageIndex: index,
                pageSize,
                pageCount: pageCount(shown.length, pageSize),
                groups: groupedRowsOf(
                    page,
                    pageSize === undefined ? 0 : index * pageSize,
                    groupKeys,
                    rowKey,
                    isRowSelectable,
                ),
            });
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
        derive(rows, columns, grouping) {
            const columnsOf = leaves(columns);
            // a tree (E3.3): every row at every depth is an entry, in the tree's order
            const getSubRows = grouping?.getSubRows;
            const nested = getSubRows ? treeFrom(rows, getSubRows) : null;
            const all = nested ? nested.entries : entries(rows);
            const matched = searched(
                filtered(all, state.filters, columnsOf),
                state.search,
                columnsOf,
                state.search.trim() === "" ? undefined : texts(all, columnsOf),
            );
            const expandedGroupKeys =
                grouping?.expandedGroupKeys ?? state.expandedGroupKeys;
            if (nested && grouping) {
                // the rows that pass and their ancestors, each parent's rows sorted among them
                const roots = keptOf(
                    nested.roots,
                    all,
                    matched,
                    state.sortColumns,
                    columnsOf,
                );
                return groupedView(
                    shownTree(roots, expandedGroupKeys, grouping.rowKey),
                    parentKeys(roots, grouping.rowKey),
                    // the rows the filters leave, at every depth, in the tree's order
                    treeEntries(roots),
                    all,
                    rows,
                    state.pageIndex,
                    state.pageSize,
                    grouping.rowKey,
                    grouping.isRowSelectable,
                );
            }
            const ordered = sorted(matched, state.sortColumns, columnsOf);
            const groupBy = groupByOf(grouping?.groupBy ?? []);
            if (grouping && groupBy.length > 0) {
                const groups = tree(
                    ordered,
                    groupBy,
                    columnsOf,
                    state.sortColumns,
                    grouping.aggregates,
                    grouping.rowKey,
                    grouping.isRowSelectable,
                );
                return groupedView(
                    shownOf(groups, expandedGroupKeys),
                    keysOf(groups),
                    ordered,
                    all,
                    rows,
                    state.pageIndex,
                    state.pageSize,
                    grouping.rowKey,
                    grouping.isRowSelectable,
                );
            }
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
        setExpandedGroupKeys: (expandedGroupKeys) =>
            update({ expandedGroupKeys }, false),
    };
}

/**
 * A list kept while it holds the same items (a new array of the same keys each render is the
 * same list): what a stage memoised by identity compares.
 */
function kept<T>(): (list: readonly T[]) => readonly T[] {
    let last: readonly T[] = [];
    return (list) => {
        if (!sameList(last, list, Object.is)) last = list;
        return last;
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
