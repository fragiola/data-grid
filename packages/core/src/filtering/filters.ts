// The column filters' rules (Epic #153): which keys a filter may have, and what a filter keeps of
// itself when the columns change.

import { entryByKey, isColumnGroup } from "../header/header";
import { isEmptyFilter } from "../model/filters";
import { fail, ok } from "../model/result";
import type { ColumnOrGroup, CommandResult } from "../model/types";
import type { ColumnFilters } from "./types";

/** The column with this key among the entries (a hidden one's too), or why there is none. */
export function filterableColumn<TRow, TNode>(
    columns: readonly ColumnOrGroup<TRow, TNode>[],
    columnKey: unknown,
): CommandResult<string> {
    const entry = entryByKey(columns, columnKey);
    if (!entry || isColumnGroup(entry)) {
        return fail("not_found", `no column "${String(columnKey)}"`);
    }
    return ok(entry.key);
}

/**
 * What filters keep of themselves among these columns: each key a column's, each value not
 * empty. The same object when they keep everything.
 */
export function validColumnFilters<TRow, TNode>(
    columns: readonly ColumnOrGroup<TRow, TNode>[],
    columnFilters: ColumnFilters,
): ColumnFilters {
    const entries = Object.entries(columnFilters);
    const kept = entries.filter(
        ([columnKey, value]) =>
            !isEmptyFilter(value) && filterableColumn(columns, columnKey).ok,
    );
    return kept.length === entries.length
        ? columnFilters
        : Object.fromEntries(kept);
}
