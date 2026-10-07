import { isIndex } from "../utils";

// Moving a row in memory (Epic #86, E2.3): the grid tells a move (`row-move`, a root's
// `onRowMove`) and never orders the rows itself; the app applies it to its own rows.

/**
 * `rows` with the row at `fromIndex` moved to `toIndex`, its index once moved (the rows without
 * it, it inserted there), as a grid's `row-move` tells it. A new array; `rows` itself when nothing
 * moves (the same index, or one outside the rows).
 */
export function moveRow<TRow>(
    rows: readonly TRow[],
    fromIndex: number,
    toIndex: number,
): readonly TRow[] {
    if (
        fromIndex === toIndex ||
        !isIndex(fromIndex, rows.length) ||
        !isIndex(toIndex, rows.length)
    ) {
        return rows;
    }
    const rest = rows.filter((_, index) => index !== fromIndex);
    return [
        ...rest.slice(0, toIndex),
        ...rows.slice(fromIndex, fromIndex + 1),
        ...rest.slice(toIndex),
    ];
}

/**
 * The move among `rows` that a move of the rows a grid shows is: the shown rows are at
 * `rowIndexes` among them (in their order: a filter's, a page's; `LocalRowsView.rowIndexes`), by
 * position, so rows equal to each other are told apart. The moved row goes before the row it
 * lands before on screen, or after the last one shown when it lands last. `null` when nothing
 * moves.
 */
export function shownRowMove(
    rowIndexes: readonly number[],
    fromIndex: number,
    toIndex: number,
): { readonly fromIndex: number; readonly toIndex: number } | null {
    const count = rowIndexes.length;
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= count) return null;
    // on screen it lands before the row now at `toIndex` (the next one, moving down), or last:
    // after the last one shown
    const last = toIndex === count - 1;
    const from = rowIndexes[fromIndex];
    const beside =
        rowIndexes[
            last ? count - 1 : toIndex < fromIndex ? toIndex : toIndex + 1
        ];
    if (from === undefined || beside === undefined) return null;
    // where it goes among the rows, as an index once moved
    const to = last ? beside + 1 : beside;
    return { fromIndex: from, toIndex: to > from ? to - 1 : to };
}

/**
 * `rows` with a move of the rows a grid shows applied (`shownRowMove`: the shown rows at
 * `rowIndexes` among them). A new array; `rows` itself when nothing moves.
 */
export function moveShownRow<TRow>(
    rows: readonly TRow[],
    rowIndexes: readonly number[],
    fromIndex: number,
    toIndex: number,
): readonly TRow[] {
    const move = shownRowMove(rowIndexes, fromIndex, toIndex);
    return move ? moveRow(rows, move.fromIndex, move.toIndex) : rows;
}
