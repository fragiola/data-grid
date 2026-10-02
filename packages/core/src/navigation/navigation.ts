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

/** A header cell's place: its position (its top row, its first column) and its spans. */
export interface HeaderCellSpan {
    readonly rowIndex: number;
    readonly columnIndex: number;
    readonly rowSpan: number;
    readonly columnSpan: number;
}

/** What a move is bounded by. */
export interface GridBounds {
    readonly rowCount: number;
    readonly columnCount: number;
    /** the header rows (-1 and above), 0 without a header */
    readonly headerRowCount: number;
    /**
     * the header cell covering a header position (column groups span columns, a shallow column
     * spans rows); without it, every header cell is one column and one row
     */
    readonly headerCellAt?:
        | ((
              rowIndex: number,
              columnIndex: number,
          ) => HeaderCellSpan | undefined)
        | undefined;
    /** the columns in view: a move down from a group lands on its first one in view */
    readonly visibleColumns?:
        | { readonly start: number; readonly end: number }
        | undefined;
}

/**
 * The cell a move lands on, from `position`. Moves never wrap and stop at the edges; a page moves
 * `pageSize` rows (at least one). Header rows are -1 and above (G4). A header cell's position is
 * its first column, on its row: a group's own row, or for a column spanning header rows (G2), the
 * row it was reached on, so the arrows walk every header row from end to end. Up from a column
 * reaches the group above it, Down from a group its first column in view.
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
    /** the cell holding a position: a header cell's span, or the body cell itself */
    const spanAt = (rowIndex: number, columnIndex: number): HeaderCellSpan => {
        const r = row(rowIndex);
        const c = column(columnIndex);
        const header = r < 0 ? bounds.headerCellAt?.(r, c) : undefined;
        return (
            header ?? { rowIndex: r, columnIndex: c, rowSpan: 1, columnSpan: 1 }
        );
    };
    /** the position of the cell holding a position: its first column, on that row */
    const at = (rowIndex: number, columnIndex: number): CellPosition => {
        const r = row(rowIndex);
        return { rowIndex: r, columnIndex: spanAt(r, columnIndex).columnIndex };
    };
    const here = spanAt(position.rowIndex, position.columnIndex);
    const stay = at(position.rowIndex, position.columnIndex);
    const top = here.rowIndex;
    const bottom = here.rowIndex + here.rowSpan - 1;
    switch (direction) {
        case "up":
            return top - 1 < firstRow ? stay : at(top - 1, here.columnIndex);
        case "down": {
            if (bottom + 1 > lastRow) return stay;
            // from a group: its first column in view, else its first column
            const visible = bounds.visibleColumns;
            const end = here.columnIndex + here.columnSpan;
            const columnIndex =
                visible &&
                visible.start > here.columnIndex &&
                visible.start < end
                    ? visible.start
                    : here.columnIndex;
            return at(bottom + 1, columnIndex);
        }
        case "left":
            return here.columnIndex - 1 < 0
                ? stay
                : at(stay.rowIndex, here.columnIndex - 1);
        case "right": {
            const next = here.columnIndex + here.columnSpan;
            return next > lastColumn ? stay : at(stay.rowIndex, next);
        }
        case "row-start":
            return at(stay.rowIndex, 0);
        case "row-end":
            return at(stay.rowIndex, lastColumn);
        case "grid-start":
            return at(firstRow, 0);
        case "grid-end":
            return at(lastRow, lastColumn);
        case "page-up":
            // a page up stops at the first row: the header is reached with ArrowUp
            return stay.rowIndex < 0
                ? stay
                : at(Math.max(stay.rowIndex - page, 0), here.columnIndex);
        case "page-down":
            return at(bottom + page, here.columnIndex);
    }
}

/** Whether two positions are the same cell: a header cell spanning rows has one per row. */
export function sameCell(
    a: CellPosition,
    b: CellPosition,
    headerCellAt?: GridBounds["headerCellAt"],
): boolean {
    if (a.rowIndex === b.rowIndex && a.columnIndex === b.columnIndex) {
        return true;
    }
    if (a.rowIndex >= 0 || b.rowIndex >= 0 || !headerCellAt) return false;
    const cell = headerCellAt(a.rowIndex, a.columnIndex);
    return Boolean(cell && cell === headerCellAt(b.rowIndex, b.columnIndex));
}
