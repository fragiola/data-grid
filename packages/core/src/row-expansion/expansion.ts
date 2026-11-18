import { firstRowFrom, sameRowKeys } from "../model/expansion";
import { loadedRowKey, type RowsState } from "../model/source";
import type { DataGridState, RowKey } from "../model/types";
import { keySet } from "../utils/utils";
import type { Range } from "../viewport/window";
import type { RowExpansionState } from "./types";

// Expanded rows (M1): the model keeps their keys, the app's state, and derives the indexes of the
// rows shown expanded: each loaded, its key (`rowKey`, else its index) among the keys. Without a
// `rowKey` the keys are the indexes, and nothing is searched.
//
// With one, the rows behind a source change only through `data.set` and `rows.changed` (D6), so
// a key is looked for only where it may be: first where it was last seen (the rows shown
// expanded, and where a toggle or a search found it: O(k)), then, for the keys still missing, in
// the rows the app named: a `rows.changed` range, the rows added behind the same `getRow`, every
// row of a new source. The search stops once every key is found: a long pass happens only while
// a key's row is not loaded, or not in the data.

/** Where each expanded key's row was last seen: a cache, checked before it is used. */
export type RowKeyHints = Map<RowKey, number>;

/**
 * The state with the expanded rows found again after the rows or the keys changed: a key missing
 * from where it was is looked for in `search` (every row by default).
 */
export function withExpandedRows<
    S extends DataGridState<unknown, unknown> & RowExpansionState,
>(
    state: S,
    hints: RowKeyHints,
    search: Range = { start: 0, end: state.rowCount },
): S {
    const expandedRows = expandedRowsOf(state, hints, search);
    return sameRowKeys(expandedRows, state.expandedRows)
        ? state
        : { ...state, expandedRows };
}

const EMPTY: readonly number[] = [];

/**
 * The indexes of the rows shown expanded, ascending: each key where it was last seen, else
 * searched for in `search` (the rows to look in for the keys still missing). `hints` learns where
 * every key was found.
 */
export function expandedRowsOf<TRow>(
    state: RowsState<TRow> &
        Pick<RowExpansionState, "expandedRowKeys" | "expandedRows">,
    hints: RowKeyHints,
    search: Range,
): readonly number[] {
    const keys = keySet(state.expandedRowKeys);
    for (const key of hints.keys()) if (!keys.has(key)) hints.delete(key);
    if (keys.size === 0) return EMPTY;
    if (!state.rowKey) {
        // the keys are the indexes: each, when its row is loaded
        const rows: number[] = [];
        for (const key of keys) {
            const index = Number(key);
            if (loadedRowKey(state, index) === key) rows.push(index);
        }
        return rows.sort((a, b) => a - b);
    }
    const found = new Map<RowKey, number>();
    const look = (index: number) => {
        const key = loadedRowKey(state, index);
        if (key !== undefined && keys.has(key) && !found.has(key)) {
            found.set(key, index);
        }
    };
    for (const index of state.expandedRows) look(index);
    for (const index of hints.values()) {
        if (found.size === keys.size) break;
        look(index);
    }
    const end = Math.min(search.end, state.rowCount);
    for (
        let index = Math.max(0, search.start);
        index < end && found.size < keys.size;
        index++
    ) {
        look(index);
    }
    for (const [key, index] of found) hints.set(key, index);
    if (found.size === 0) return EMPTY;
    return [...found.values()].sort((a, b) => a - b);
}

/** `rows` (ascending) with `rowIndex` added in its place. */
export function withRow(
    rows: readonly number[],
    rowIndex: number,
): readonly number[] {
    const next = rows.slice();
    next.splice(firstRowFrom(rows, rowIndex), 0, rowIndex);
    return next;
}
