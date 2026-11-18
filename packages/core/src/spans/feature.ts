import { type DataGridFeature, defineFeature } from "../feature/feature";
import { SPANS } from "./spans";
import type { CellSpansTypes } from "./types";

// Column spans (Epic #85, E1.2; a feature since Epic #151): a column's `colSpan` makes one of a
// body (or summary) row's cells cover the columns after it, within its part. The core asks the
// spans through its `cellSpans` contribution point (`spansOf`): the cell a position is in (the
// active cell snaps to it), the cells a render lays out (`aria-colspan`), the column a scroll
// brings into view; the navigation, the ranges and the clipboard ask the same. Without it, a
// column's `colSpan` is never asked: every body cell is one column. The header's spans (column
// groups) are the core's.

/** Column spans' definition: every grid installing it shares it. */
const CELL_SPANS = defineFeature<CellSpansTypes>({
    name: "cellSpans",
    cellSpans: SPANS,
    queries: {
        "cell-span-by": (state, { rowIndex, columnIndex }) =>
            SPANS.spanAt(state, rowIndex, columnIndex),
    },
});

/**
 * Column spans (Epic #85, E1.2), as a feature (Epic #151): install it (`features:
 * [cellSpans()]`) for a column's `colSpan` to make cells span columns; without it every body cell
 * is one column.
 */
export function cellSpans(): DataGridFeature<CellSpansTypes> {
    return CELL_SPANS;
}
