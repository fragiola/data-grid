import type { RowKey, RowSelection } from "../model/types";

// The selection's extras (Epic #57, R8), in `@fragiola/data-grid/row-selection`. The grid keeps
// the selected keys; these answer questions about a list of keys the app chooses (the rows on
// screen, a page, every filtered row) and build the key lists a header checkbox sets. Pure
// functions over keys: no model, no state.

/** How much of a list of rows is selected. */
export type SelectionStatus = "all" | "some" | "none";

/** How much of `rowKeys` is selected, and how many of them are. */
export function selectionStatus(
    rowKeys: readonly RowKey[],
    selectedRowKeys: readonly RowKey[],
): { readonly status: SelectionStatus; readonly count: number } {
    const selected = new Set(selectedRowKeys);
    const rows = new Set(rowKeys);
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
    const removed = new Set(rowKeys);
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

/** A "select all" control's state over `rowKeys` (`useSelectAll`, every adapter's). */
export interface SelectAllState {
    /** how much of the rows is selected: `"some"` is a checkbox's indeterminate state */
    readonly status: SelectionStatus;
    /** how many of the rows are selected */
    readonly count: number;
    /**
     * whether its toggle does something: rows are selectable, and with one row at a time, one of
     * them is selected (to clear)
     */
    readonly canToggle: boolean;
}

const NOT_SELECTABLE: SelectAllState = {
    status: "none",
    count: 0,
    canToggle: false,
};

/**
 * A "select all" control's state over the rows the app names, while rows are selectable in
 * `mode` (none: nothing is selected, the toggle does nothing).
 */
export function selectAllState(
    mode: RowSelection | null | undefined,
    selectedRowKeys: readonly RowKey[],
    rowKeys: readonly RowKey[],
): SelectAllState {
    if (!mode) return NOT_SELECTABLE;
    const { status, count } = selectionStatus(rowKeys, selectedRowKeys);
    const canToggle = mode === "multiple" ? rowKeys.length > 0 : count > 0;
    return { status, count, canToggle };
}

/**
 * The keys a "select all" toggle sets (through `selected-rows.set`): every one of `rowKeys` added,
 * or removed when every one is selected; with one row at a time (single mode) it only clears.
 * `undefined` when it does nothing.
 */
export function selectAllToggled(
    mode: RowSelection | null | undefined,
    selectedRowKeys: readonly RowKey[],
    rowKeys: readonly RowKey[],
): readonly RowKey[] | undefined {
    if (!mode) return undefined;
    const { status, count } = selectionStatus(rowKeys, selectedRowKeys);
    if (status === "all" || mode === "single") {
        return count > 0 ? withoutRowKeys(selectedRowKeys, rowKeys) : undefined;
    }
    return withRowKeys(selectedRowKeys, rowKeys);
}
