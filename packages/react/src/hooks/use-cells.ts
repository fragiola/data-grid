import { rowCellValue } from "@fragiola/data-grid";
import type { CellInfo, RowInfo } from "../context";

import { cellsOf } from "../utils/cells-of";
import { useGridView } from "./use-grid-view";

/**
 * The cells a row renders, with their columns and values: one per rendered column, but a cell
 * spanning columns (a column's `colSpan`, Epic #85) stands for the ones it covers.
 */
export function useCells<TRow = unknown>(row: RowInfo<TRow>): CellInfo<TRow>[] {
    const view = useGridView<TRow>();
    const { group, meta } = row;
    return cellsOf(view, row.rowIndex, (columnIndex, column) => ({
        rowIndex: row.rowIndex,
        columnIndex,
        column,
        row: row.row,
        loaded: row.loaded,
        value: rowCellValue(column, row.rowIndex, group, row.row),
        group,
        meta,
    }));
}
