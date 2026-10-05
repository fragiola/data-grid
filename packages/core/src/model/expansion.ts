import { keySet, lowerBound, sameList } from "../utils";
import type { Range } from "../viewport/window";
import { loadedRowKey, type RowsState } from "./source";
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

/** Where each expanded key's row was last seen: a cache, checked before it is used. */
export type RowKeyHints = Map<RowKey, number>;

/**
 * The state with the expanded rows found again after the rows or the keys changed: a key missing
 * from where it was is looked for in `search` (every row by default).
 */
export function withExpandedRows<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    hints: RowKeyHints,
    search: Range = { start: 0, end: state.rowCount },
): DataGridState<TRow, TNode> {
    const expandedRows = expandedRowsOf(state, hints, search);
    return sameRowKeys(expandedRows, state.expandedRows)
        ? state
        : { ...state, expandedRows };
}

/**
 * The rows a new source may hold expanded keys in: behind the same `getRow` and `rowKey`, only
 * the rows it added (the others change through `rows.changed`); anything else, every row.
 */
export function newRowsOf<TRow, TNode>(
    before: DataGridState<TRow, TNode>,
    after: DataGridState<TRow, TNode>,
): Range {
    const same =
        "getRow" in before.source &&
        "getRow" in after.source &&
        before.source.getRow === after.source.getRow &&
        before.rowKey === after.rowKey;
    return { start: same ? before.rowCount : 0, end: after.rowCount };
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
    return sameList(a, b, (x, y) => x === y);
}

const EMPTY: readonly number[] = [];

/**
 * The indexes of the rows shown expanded, ascending: each key where it was last seen, else
 * searched for in `search` (the rows to look in for the keys still missing). `hints` learns where
 * every key was found.
 */
export function expandedRowsOf<TRow>(
    state: RowsState<TRow> &
        Pick<DataGridState<TRow>, "expandedRowKeys" | "expandedRows">,
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

/** Whether `rows` (ascending) holds an index from `start` to `end` (excluded). */
export function holdsRowIn(
    rows: readonly number[],
    start: number,
    end: number,
): boolean {
    const first = rows[firstRowFrom(rows, start)];
    return first !== undefined && first < end;
}

/** Where the first index from `start` on is in `rows` (ascending): where `start` would go. */
function firstRowFrom(rows: readonly number[], start: number): number {
    return lowerBound(rows.length, (i) => (rows[i] ?? 0) < start);
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

/** Whether `rows` (ascending) holds `rowIndex`. */
export function holdsRow(rows: readonly number[], rowIndex: number): boolean {
    return holdsRowIn(rows, rowIndex, rowIndex + 1);
}

/**
 * Whether the details' sizes may differ between two states: the rows shown expanded changed, or,
 * with rows expanded, their height did.
 */
export function detailsChanged<TRow, TNode>(
    before: DataGridState<TRow, TNode>,
    after: DataGridState<TRow, TNode>,
): boolean {
    return (
        after.expandedRows !== before.expandedRows ||
        (after.expandedRows.length > 0 &&
            (after.detailHeight !== before.detailHeight ||
                // a measured detail's estimate (E2.2)
                (after.detailHeight === "auto" &&
                    after.estimatedDetailHeight !==
                        before.estimatedDetailHeight) ||
                // a detail's height may be a function of its row, whose data changed
                (typeof after.detailHeight === "function" &&
                    (after.source !== before.source ||
                        (after.rowsChanged !== before.rowsChanged &&
                            holdsRowIn(
                                after.expandedRows,
                                after.rowsChanged.start,
                                after.rowsChanged.end,
                            ))))))
    );
}
