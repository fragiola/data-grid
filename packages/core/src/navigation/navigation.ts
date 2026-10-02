import type { CellPosition } from "../model/types";

// Where the active cell goes for a key (D11, the APG grid pattern). Pure: the model commits what
// this returns, and a middleware can refuse or rewrite it.

/** A move of the active cell. */
export type Direction =
    | "up"
    | "down"
    | "left"
    | "right"
    /** the row's first cell (Home) */
    | "row-start"
    /** the row's last cell (End) */
    | "row-end"
    /** the grid's first cell: the header's first, or the first row's (Ctrl+Home) */
    | "grid-start"
    /** the grid's last cell (Ctrl+End) */
    | "grid-end"
    /** a page of rows up, never into the header (PageUp) */
    | "page-up"
    /** a page of rows down (PageDown) */
    | "page-down";

export const DIRECTIONS: readonly Direction[] = [
    "up",
    "down",
    "left",
    "right",
    "row-start",
    "row-end",
    "grid-start",
    "grid-end",
    "page-up",
    "page-down",
];

/** What a move is bounded by. */
export interface GridBounds {
    readonly rowCount: number;
    readonly columnCount: number;
    /** 1 when the grid has a header row (row -1), 0 without */
    readonly headerRowCount: number;
}

/**
 * The cell a move lands on, from `position`. Moves never wrap and stop at the edges; a page moves
 * `pageSize` rows (at least one). Row -1 is the header.
 */
export function nextPosition(
    position: CellPosition,
    direction: Direction,
    bounds: GridBounds,
    pageSize = 1,
): CellPosition {
    const firstRow = 0 - bounds.headerRowCount;
    const lastRow = Math.max(bounds.rowCount - 1, firstRow);
    const lastColumn = Math.max(bounds.columnCount - 1, 0);
    const page = Math.max(1, Math.floor(pageSize));
    const row = (index: number) => Math.min(Math.max(index, firstRow), lastRow);
    const column = (index: number) => Math.min(Math.max(index, 0), lastColumn);
    const { rowIndex, columnIndex } = position;
    switch (direction) {
        case "up":
            return { rowIndex: row(rowIndex - 1), columnIndex };
        case "down":
            return { rowIndex: row(rowIndex + 1), columnIndex };
        case "left":
            return { rowIndex, columnIndex: column(columnIndex - 1) };
        case "right":
            return { rowIndex, columnIndex: column(columnIndex + 1) };
        case "row-start":
            return { rowIndex, columnIndex: 0 };
        case "row-end":
            return { rowIndex, columnIndex: lastColumn };
        case "grid-start":
            return { rowIndex: firstRow, columnIndex: 0 };
        case "grid-end":
            return { rowIndex: lastRow, columnIndex: lastColumn };
        case "page-up":
            // a page up stops at the first row: the header is reached with ArrowUp
            return {
                rowIndex:
                    rowIndex < 0 ? rowIndex : row(Math.max(rowIndex - page, 0)),
                columnIndex,
            };
        case "page-down":
            return { rowIndex: row(rowIndex + page), columnIndex };
    }
}
