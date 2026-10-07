// The sort's rules: which columns sort, the toggle's cycle, and what a sort keeps when the
// columns change. The toggle (ascending, descending, none; Ctrl adds a column last or cycles it
// in place) and the `sortColumns` shape follow react-data-grid's header cell sort
// (src/HeaderCell.tsx), Original work Copyright (c) 2014 Prometheus Research, Modified work
// Copyright 2015 Comcast, under the MIT licence (see the root LICENSE).

import { entryByKey, isColumnGroup } from "../header/header";
import { sameList } from "../utils";
import { fail, ok } from "./result";
import type {
    Column,
    ColumnOrGroup,
    CommandResult,
    SortColumn,
    SortDirection,
} from "./types";

export const SORT_DIRECTIONS: readonly SortDirection[] = [
    "ascending",
    "descending",
];

/**
 * The sortable column with this key among the columns (or the entries' leaves: a column a
 * collapsed group hides keeps its sort, E1.3), or why there is none.
 */
export function sortableColumn<TRow, TNode>(
    columns: readonly ColumnOrGroup<TRow, TNode>[],
    columnKey: unknown,
): CommandResult<Column<TRow, TNode>> {
    const entry = entryByKey(columns, columnKey);
    const column = entry && !isColumnGroup(entry) ? entry : undefined;
    if (!column) return fail("not_found", `no column "${String(columnKey)}"`);
    if (column.sortable !== true) {
        return fail("refused", `column "${column.key}" is not sortable`);
    }
    return ok(column);
}

/**
 * What a sort keeps of itself among these columns (or the entries' leaves, hidden ones
 * included): each entry a sortable column, once, with a direction. The same array when it keeps
 * everything.
 */
export function validSortColumns<TRow, TNode>(
    columns: readonly ColumnOrGroup<TRow, TNode>[],
    sortColumns: readonly SortColumn[],
): readonly SortColumn[] {
    const seen = new Set<string>();
    const kept = sortColumns.filter((entry) => {
        const keep =
            !seen.has(entry.columnKey) &&
            SORT_DIRECTIONS.includes(entry.direction) &&
            sortableColumn(columns, entry.columnKey).ok;
        seen.add(entry.columnKey);
        return keep;
    });
    return kept.length === sortColumns.length ? sortColumns : kept;
}

/** The sort after toggling a column: ascending, descending, not sorted. */
export function toggledSort(
    sortColumns: readonly SortColumn[],
    columnKey: string,
    multi: boolean,
): readonly SortColumn[] {
    const index = sortColumns.findIndex(
        (entry) => entry.columnKey === columnKey,
    );
    const current = sortColumns[index];
    const next: SortColumn | null = !current
        ? { columnKey, direction: "ascending" }
        : current.direction === "ascending"
          ? { columnKey, direction: "descending" }
          : null;
    if (!multi) return next ? [next] : [];
    if (!current) return next ? [...sortColumns, next] : sortColumns;
    return next
        ? sortColumns.map((entry, i) => (i === index ? next : entry))
        : sortColumns.filter((_, i) => i !== index);
}

/** Whether two sorts are the same columns, in the same directions and order. */
export function sameSortColumns(
    a: readonly SortColumn[],
    b: readonly SortColumn[],
): boolean {
    return sameList(
        a,
        b,
        (x, y) => x.columnKey === y?.columnKey && x.direction === y?.direction,
    );
}
