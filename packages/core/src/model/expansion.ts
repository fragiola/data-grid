import { lowerBound, sameList } from "../utils/utils";
import type { Range } from "../viewport/window";
import type { DataGridState, RowKey } from "./types";

// Row keys and the rows showing a detail, as the core reads them: a key the model accepts, the
// rows' details on the rows' axis (M2, the core's: the axis, sizes and measured heights, D7).
// Which rows are expanded is row expansion's (Epic #151, `rowExpansion()`): it tells the core
// through its `rowDetails` contribution point; none without it.

/** A detail's height when none is given. */
export const DEFAULT_DETAIL_HEIGHT = 300;

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

/** Whether `rows` (ascending) holds an index from `start` to `end` (excluded). */
export function holdsRowIn(
    rows: readonly number[],
    start: number,
    end: number,
): boolean {
    // none expanded (the usual case): nothing to look for
    if (rows.length === 0) return false;
    const first = rows[firstRowFrom(rows, start)];
    return first !== undefined && first < end;
}

/** Where the first index from `start` on is in `rows` (ascending): where `start` would go. */
export function firstRowFrom(rows: readonly number[], start: number): number {
    return lowerBound(rows.length, (i) => (rows[i] ?? 0) < start);
}

/** Whether `rows` (ascending) holds `rowIndex`. */
export function holdsRow(rows: readonly number[], rowIndex: number): boolean {
    return holdsRowIn(rows, rowIndex, rowIndex + 1);
}

/**
 * Whether the details' sizes may differ between two states (`rowsBefore`, `rowsAfter`: the rows
 * showing a detail in each): the rows shown expanded changed, or, with rows expanded, their
 * height did.
 */
export function detailsChanged<TRow, TNode>(
    before: DataGridState<TRow, TNode>,
    after: DataGridState<TRow, TNode>,
    rowsBefore: readonly number[],
    rowsAfter: readonly number[],
): boolean {
    return (
        rowsAfter !== rowsBefore ||
        (rowsAfter.length > 0 &&
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
                                rowsAfter,
                                after.rowsChanged.start,
                                after.rowsChanged.end,
                            ))))))
    );
}

/** No row showing a detail: a grid without row expansion's. */
export const NO_DETAILS: readonly number[] = Object.freeze([]);

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
