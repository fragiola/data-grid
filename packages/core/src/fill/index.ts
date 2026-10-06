import type { RangeFill } from "../engine/types";
import type { CellPosition } from "../model/types";

// The fill's extras (Epic #88, E4.4), opt-in: `@fragiola/data-grid/fill`. The grid tells a fill
// (its source and its target); what the target's cells become is the app's. This answers the
// usual one, the source repeated: pure, over positions, no model and no state.

/** A cell a fill writes, and its value. */
export interface FilledCell {
    readonly rowIndex: number;
    readonly columnIndex: number;
    readonly value: unknown;
}

/**
 * The source repeated over the target (a spreadsheet's fill without a series): a fill down gives
 * each target cell the value of the source cell in its column at its row's place in the source's
 * rows (row by row, starting again after the last one); a fill to the end, the same along the
 * columns. `valueAt` reads a source cell's value (the app's rows, `cell-value-by`). Top to
 * bottom, start to end.
 */
export function repeatedFill(
    { source, target }: RangeFill,
    valueAt: (cell: CellPosition) => unknown,
): FilledCell[] {
    const top = source.anchor.rowIndex;
    const start = source.anchor.columnIndex;
    const height = source.focus.rowIndex - top + 1;
    const width = source.focus.columnIndex - start + 1;
    const down = target.anchor.rowIndex > source.focus.rowIndex;
    const cells: FilledCell[] = [];
    for (
        let rowIndex = target.anchor.rowIndex;
        rowIndex <= target.focus.rowIndex;
        rowIndex++
    ) {
        for (
            let columnIndex = target.anchor.columnIndex;
            columnIndex <= target.focus.columnIndex;
            columnIndex++
        ) {
            const from = down
                ? {
                      rowIndex:
                          top + ((rowIndex - target.anchor.rowIndex) % height),
                      columnIndex,
                  }
                : {
                      rowIndex,
                      columnIndex:
                          start +
                          ((columnIndex - target.anchor.columnIndex) % width),
                  };
            cells.push({ rowIndex, columnIndex, value: valueAt(from) });
        }
    }
    return cells;
}
