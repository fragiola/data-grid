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
        !Number.isInteger(fromIndex) ||
        !Number.isInteger(toIndex) ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= rows.length ||
        toIndex >= rows.length
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
 * A move of the rows a grid shows (`shown`: some of `rows`, in their order, as a filter or a page
 * leaves them) applied to `rows`: the moved row goes before the row it lands before on screen, or
 * after the last one shown when it lands last. A new array; `rows` itself when nothing moves (a
 * row not found among them).
 */
export function moveShownRow<TRow>(
    rows: readonly TRow[],
    shown: readonly TRow[],
    fromIndex: number,
    toIndex: number,
): readonly TRow[] {
    const count = shown.length;
    // on screen it lands before the row now at `toIndex` (the next one, moving down), or last:
    // after the last one shown
    const last = toIndex === count - 1;
    const row = shown[fromIndex];
    const beside =
        shown[last ? count - 1 : toIndex < fromIndex ? toIndex : toIndex + 1];
    if (
        fromIndex === toIndex ||
        toIndex < 0 ||
        row === undefined ||
        beside === undefined
    ) {
        return rows;
    }
    const from = rows.indexOf(row);
    const at = rows.indexOf(beside);
    if (from < 0 || at < 0) return rows;
    // where it goes among the rows, as an index once moved
    const to = last ? at + 1 : at;
    return moveRow(rows, from, to > from ? to - 1 : to);
}
