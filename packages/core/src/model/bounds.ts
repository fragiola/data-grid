import { headerRowCount, isHeaderRow } from "../header/header";
import { type GridBounds, isRowOf } from "../navigation/navigation";
import { isIndex } from "../utils/utils";
import type {
    CellPosition,
    CellSpans,
    DataGridState,
    SpansState,
} from "./types";

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
        cellSpanAt: spansCellAt(state),
    };
}

/**
 * The body cells' column spans in effect (Epic #151: `cellSpans()`'s), or `null` without them or
 * without a column that spans: then every body cell is one column, and nothing is asked.
 */
export function spansOf<TRow, TNode>(
    state: Pick<DataGridState<TRow, TNode>, "cellSpans" | "columns">,
): CellSpans | null {
    const spans = state.cellSpans;
    return spans?.hasSpans(state.columns) ? spans : null;
}

/** The body cell covering a position under column spans, or `undefined` without them. */
function spansCellAt<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
): GridBounds["cellSpanAt"] {
    const spans = spansOf(state);
    return spans
        ? (rowIndex, columnIndex) => spans.spanAt(state, rowIndex, columnIndex)
        : undefined;
}

/**
 * Whether the active position is in a body cell (E1.2): on its row, its column one the cell's
 * span (from `columnIndex`, `columnSpan` columns) holds. What the navigation's `cell-active`
 * question and a cell's part both ask.
 */
export function activeInCell(
    active: CellPosition | null,
    rowIndex: number,
    columnIndex: number,
    columnSpan: number,
): boolean {
    return (
        active !== null &&
        active.rowIndex === rowIndex &&
        active.columnIndex >= columnIndex &&
        active.columnIndex < columnIndex + columnSpan
    );
}

/**
 * The cell covering a position, at its own position (G4, E1.2): a header cell's top row and
 * first column (`header.cellAt`), a body or summary row cell's first column under a span
 * (`spansOf`) on its row; `undefined` for a header position no cell covers. What the model snaps
 * an active position to and the engine finds a cell's element by.
 */
export function coveringCell<TRow, TNode>(
    state: SpansState<TRow, TNode>,
    position: CellPosition,
): CellPosition | undefined {
    const { rowIndex, columnIndex } = position;
    if (isHeaderRow(rowIndex, state.header)) {
        return state.header.cellAt(rowIndex, columnIndex);
    }
    const spans = spansOf(state);
    if (!spans) return position;
    const start = spans.spanAt(state, rowIndex, columnIndex).columnIndex;
    return start === columnIndex ? position : { rowIndex, columnIndex: start };
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
