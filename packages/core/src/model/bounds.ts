import { headerRowCount } from "../header/header";
import { type GridBounds, isRowOf } from "../navigation/navigation";
import { isIndex } from "../utils/utils";
import { coveringCell, hasColumnSpans, spanAt } from "./spans";
import type { CellPosition, DataGridState } from "./types";

// What positions in a grid are bounded by, and a position as its cell's: the model's rules for the
// active position (the core's) and the moves of the navigation and the cell ranges (Epic #144).

/**
 * What moves in the grid are bounded by: its rows, its columns, its header's cells, its summary
 * rows (E2.1) and, with column spans, its body and summary rows' cells (E1.2).
 */
export function boundsOf<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
): GridBounds {
    return {
        rowCount: state.rowCount,
        columnCount: state.columns.length,
        headerRowCount: headerRowCount(state),
        headerDepth: state.header.depth,
        summaryRows: state.summaryRows,
        headerCellAt: state.header.cellAt,
        cellSpanAt: hasColumnSpans(state.columns)
            ? (rowIndex, columnIndex) => spanAt(state, rowIndex, columnIndex)
            : undefined,
    };
}

/**
 * What the keys move a range's focus in (E4.1): the body's rows only (no header, no summary rows),
 * the columns, and their spans (E1.2).
 */
export function bodyBoundsOf<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
): GridBounds {
    const bounds = boundsOf(state);
    return {
        rowCount: bounds.rowCount,
        columnCount: bounds.columnCount,
        headerRowCount: 0,
        cellSpanAt: bounds.cellSpanAt,
    };
}

/**
 * A position inside a cell's span, as that cell's position: its first column, on the same row (a
 * header cell's; a column spanning header rows has a position on each of them; a body cell's
 * under a column span, E1.2).
 */
export function cellPosition<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    position: CellPosition,
): CellPosition {
    const columnIndex = coveringCell(state, position)?.columnIndex;
    return columnIndex !== undefined && columnIndex !== position.columnIndex
        ? { rowIndex: position.rowIndex, columnIndex }
        : position;
}

/** Whether a position is a cell: a header row shown, a summary row or a body row, and a column. */
export function isCell<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    { rowIndex, columnIndex }: CellPosition,
): boolean {
    return (
        isRowOf(rowIndex, boundsOf(state)) &&
        isIndex(columnIndex, state.columns.length)
    );
}
