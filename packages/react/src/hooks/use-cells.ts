import { rowCellsOf } from "@fragiola/data-grid";
import type { CellInfo, RowInfo } from "../context";

import { useGridView } from "./use-grid-view";

/**
 * The cells a row renders, with their columns and values: one per rendered column, but a cell
 * spanning columns (a column's `colSpan`, Epic #85) stands for the ones it covers.
 */
export function useCells<TRow = unknown>(row: RowInfo<TRow>): CellInfo<TRow>[] {
    return rowCellsOf(useGridView<TRow>(), row);
}
