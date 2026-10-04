import type {
    DataGridContextValue,
    HeaderCellInfo,
} from "@fragiola/data-grid-react";

// What the live region says is the app's: the grid announces nothing. A move is told from the
// grid's own header before and after it (`model.state.header`, as the grid shows it, the pinned
// columns first included), in the columns' own names: the top header row whose order changed,
// and the entry that left its place in it (of two neighbours swapped, the one the person moved).

type HeaderRows<TRow> = readonly (readonly HeaderCellInfo<TRow>[])[];

/** A header cell's name: its column's or its group's, as the app wrote it, else its key. */
function nameOf<TRow>(cell: HeaderCellInfo<TRow>): string {
    return (cell.group ?? cell.column).name ?? cell.key;
}

/**
 * "Moved City after Email.": the column or group a change of order moved, from the header's rows
 * before and after it, else `null`. `movedKey` tells two neighbours swapped apart: the one dragged
 * or moved with the keys.
 */
export function describeMove<TRow>(
    before: HeaderRows<TRow>,
    after: HeaderRows<TRow>,
    movedKey?: string,
): string | null {
    // the top row that changed holds the moved entry: a group's columns move with it, below
    for (const [level, is] of after.entries()) {
        const was = before[level] ?? [];
        let first = -1;
        let last = -1;
        is.forEach((cell, index) => {
            if (cell.key === was[index]?.key) return;
            if (first < 0) first = index;
            last = index;
        });
        if (first < 0) continue;
        // one entry left the span that changed: rightwards, it was its first and now ends it (two
        // neighbours swapped read both ways)
        const right =
            last === first + 1 && movedKey !== undefined
                ? is[last]?.key === movedKey
                : was[first]?.key === is[last]?.key;
        const moved = right ? is[last] : is[first];
        const beside = right ? is[last - 1] : is[first + 1];
        if (!moved || !beside) return null;
        return `Moved ${nameOf(moved)} ${right ? "after" : "before"} ${nameOf(beside)}.`;
    }
    return null;
}

/**
 * The column or group a change of order moved with the active cell (a press on a header cell
 * makes it the active one; the keys move the active one): its key in the grid's state after it.
 */
export function activeHeaderKey<TRow>(
    state: DataGridContextValue<TRow>["model"]["state"],
): string | undefined {
    const active = state.activePosition;
    return active && active.rowIndex < 0
        ? state.header.cellAt(active.rowIndex, active.columnIndex)?.key
        : undefined;
}
