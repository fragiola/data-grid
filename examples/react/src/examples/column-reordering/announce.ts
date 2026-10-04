import type { ColumnOrder, ColumnOrGroup } from "@fragiola/data-grid-react";

// What the live region says is the app's: the grid announces nothing. A move is told from the
// order before and after it, in the columns' own names: the one sibling list that changed, and
// the entry that left its place in it (of two neighbours swapped, the one the person moved).

/**
 * A sibling list in a column order, as the grid lays it out: the entries the order lists take
 * the listed ones' places, in its order; the others keep theirs.
 */
function arranged<E extends { readonly key: string }>(
    list: readonly E[],
    columnOrder: ColumnOrder,
): readonly E[] {
    const rank = new Map(columnOrder.map((key, index) => [key, index]));
    const listed = list
        .filter((entry) => rank.has(entry.key))
        .sort((a, b) => (rank.get(a.key) ?? 0) - (rank.get(b.key) ?? 0));
    let next = 0;
    return list.map((entry) =>
        rank.has(entry.key) ? (listed[next++] ?? entry) : entry,
    );
}

/**
 * "Moved City after Email.": the column or group a change of order moved, else `null`.
 * `movedKey` tells two neighbours swapped apart: the one dragged or moved with the keys.
 */
export function describeMove<TRow>(
    entries: readonly ColumnOrGroup<TRow>[],
    before: ColumnOrder,
    after: ColumnOrder,
    movedKey?: string,
): string | null {
    const was = arranged(entries, before);
    const is = arranged(entries, after);
    let first = -1;
    let last = -1;
    is.forEach((entry, index) => {
        if (entry === was[index]) return;
        if (first < 0) first = index;
        last = index;
    });
    if (first < 0) {
        // not this list: a group's columns, then
        for (const entry of entries) {
            const moved =
                entry.children &&
                describeMove(entry.children, before, after, movedKey);
            if (moved) return moved;
        }
        return null;
    }
    // one entry left the span that changed: rightwards, it was its first and now ends it (two
    // neighbours swapped read both ways)
    const right =
        last === first + 1 && movedKey !== undefined
            ? is[last]?.key === movedKey
            : was[first] === is[last];
    const moved = right ? is[last] : is[first];
    const beside = right ? is[last - 1] : is[first + 1];
    if (!moved || !beside) return null;
    return `Moved ${moved.name ?? moved.key} ${right ? "after" : "before"} ${beside.name ?? beside.key}.`;
}
