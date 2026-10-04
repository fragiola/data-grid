import { rowAt } from "./source";
import type { DataGridState, RowKey } from "./types";

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

/** A detail's height when none is given. */
export const DEFAULT_DETAIL_HEIGHT = 300;

type Keyed<TRow> = Pick<
    DataGridState<TRow>,
    "source" | "rowCount" | "rowKey" | "expandedRowKeys" | "expandedRows"
>;

/** Where each expanded key's row was last seen: a cache, checked before it is used. */
export type RowKeyHints = Map<RowKey, number>;

/** Rows to look in for the keys still missing: from `start` to `end` (excluded). */
export interface SearchRange {
    readonly start: number;
    readonly end: number;
}

/** A key the model accepts: a string, or a finite number. */
export function isRowKey(key: unknown): key is RowKey {
    return (
        typeof key === "string" ||
        (typeof key === "number" && Number.isFinite(key))
    );
}

/** The keys, once each, in order: `undefined` when one is not a key. */
export function uniqueRowKeys(
    keys: readonly unknown[],
): readonly RowKey[] | undefined {
    const unique = new Set<RowKey>();
    for (const key of keys) {
        if (!isRowKey(key)) return undefined;
        unique.add(key);
    }
    return [...unique];
}

/** Whether two key lists hold the same keys in the same order. */
export function sameRowKeys(
    a: readonly RowKey[],
    b: readonly RowKey[],
): boolean {
    return a.length === b.length && a.every((key, i) => key === b[i]);
}

/** The key of a loaded row; `undefined` while it is not loaded (its key is unknown). */
export function loadedRowKey<TRow>(
    state: Pick<Keyed<TRow>, "source" | "rowCount" | "rowKey">,
    rowIndex: number,
): RowKey | undefined {
    if (!Number.isInteger(rowIndex) || rowIndex < 0) return undefined;
    if (rowIndex >= state.rowCount) return undefined;
    const row = rowAt(state.source, rowIndex);
    if (row === undefined) return undefined;
    return state.rowKey ? state.rowKey(row, rowIndex) : rowIndex;
}

const EMPTY: readonly number[] = [];

/**
 * The indexes of the rows shown expanded, ascending: each key where it was last seen, else
 * searched for in `search`. `hints` learns where every key was found.
 */
export function expandedRowsOf<TRow>(
    state: Keyed<TRow>,
    hints: RowKeyHints,
    search: SearchRange,
): readonly number[] {
    const keys = new Set(state.expandedRowKeys);
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

/** Whether `rows` (ascending) holds an index from `start` to `end` (excluded). */
export function holdsRowIn(
    rows: readonly number[],
    start: number,
    end: number,
): boolean {
    let low = 0;
    let high = rows.length;
    while (low < high) {
        const middle = (low + high) >>> 1;
        if ((rows[middle] ?? 0) < start) low = middle + 1;
        else high = middle;
    }
    const first = rows[low];
    return first !== undefined && first < end;
}

/** Whether `rows` (ascending) holds `rowIndex`. */
export function holdsRow(rows: readonly number[], rowIndex: number): boolean {
    return holdsRowIn(rows, rowIndex, rowIndex + 1);
}
