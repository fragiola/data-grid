import { type GridView, rowColumns } from "@fragiola/data-grid";
import type { ReactNode } from "react";
import type { Column } from "../context";

/**
 * A row's cells (a body row's or a summary row's), each made from its column: one per rendered
 * column, but a cell spanning columns (Epic #85) stands for the ones it covers (`rowColumns`).
 */
export function cellsOf<TRow, Cell>(
    view: GridView<TRow, ReactNode>,
    rowIndex: number,
    cell: (columnIndex: number, column: Column<TRow>) => Cell,
): Cell[] {
    return rowColumns(view, rowIndex).flatMap((columnIndex) => {
        const column = view.columnDefs[columnIndex];
        return column ? [cell(columnIndex, column)] : [];
    });
}
