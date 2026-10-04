import type { RowKey } from "../model/types";

// The selection's extras (Epic #57, R8), opt-in: `@fragiola/data-grid/selection`. The grid keeps
// the selected keys; these answer questions about a list of keys the app chooses (the rows on
// screen, a page, every filtered row) and build the key lists a header checkbox sets. Pure
// functions over keys: no model, no state.

/** How much of a list of rows is selected. */
export type SelectionStatus = "all" | "some" | "none";

const sets = new WeakMap<readonly RowKey[], ReadonlySet<RowKey>>();

/** A key list as a set, built once per list (the grid's lists are never changed in place). */
function setOf(keys: readonly RowKey[]): ReadonlySet<RowKey> {
    let set = sets.get(keys);
    if (!set) {
        set = new Set(keys);
        sets.set(keys, set);
    }
    return set;
}

/** How much of `rowKeys` is selected, and how many of them are. */
export function selectionStatus(
    rowKeys: readonly RowKey[],
    selectedRowKeys: readonly RowKey[],
): { readonly status: SelectionStatus; readonly count: number } {
    const selected = setOf(selectedRowKeys);
    const rows = setOf(rowKeys);
    let count = 0;
    for (const key of rows) if (selected.has(key)) count++;
    const total = rows.size;
    const status =
        count === 0 ? "none" : count === total ? "all" : ("some" as const);
    return { status, count };
}

/** The selected keys with `rowKeys` added after them (each once). */
export function withRowKeys(
    selectedRowKeys: readonly RowKey[],
    rowKeys: readonly RowKey[],
): readonly RowKey[] {
    return [...new Set([...selectedRowKeys, ...rowKeys])];
}

/** The selected keys without `rowKeys`. */
export function withoutRowKeys(
    selectedRowKeys: readonly RowKey[],
    rowKeys: readonly RowKey[],
): readonly RowKey[] {
    const removed = setOf(rowKeys);
    return selectedRowKeys.filter((key) => !removed.has(key));
}

/**
 * What a "select all" checkbox sets: `rowKeys` removed when every one is selected, else added.
 */
export function toggledRowKeys(
    selectedRowKeys: readonly RowKey[],
    rowKeys: readonly RowKey[],
): readonly RowKey[] {
    return selectionStatus(rowKeys, selectedRowKeys).status === "all"
        ? withoutRowKeys(selectedRowKeys, rowKeys)
        : withRowKeys(selectedRowKeys, rowKeys);
}
