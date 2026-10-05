import type { CellSpan } from "../model/spans";
import type { CellPosition, SummaryRowCounts } from "../model/types";
import { clamp } from "../utils";
import type { Range } from "../viewport/window";

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
     * the header's depth, shown or not (default `headerRowCount`): the top summary rows are
     * numbered before it (Epic #86, E2.1)
     */
    readonly headerDepth?: number | undefined;
    /** the summary rows: the top ones after the header, the bottom ones after the body (default none) */
    readonly summaryRows?: SummaryRowCounts | undefined;
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
    /**
     * the body cell covering a body position under column spans (E1.2): its first column and
     * span; without it, every body cell is one column
     */
    readonly cellSpanAt?:
        | ((rowIndex: number, columnIndex: number) => CellSpan)
        | undefined;
    /** the columns in view: a move down from a group lands on its first one in view */
    readonly visibleColumns?: Range | undefined;
}

/**
 * A row's line: its place top to bottom (Epic #86, E2.1), the header's rows, the top summary
 * rows, the body rows and the bottom summary rows, the body's first row at 0. The top summary rows
 * are numbered before the header's (`-(headerDepth + top)` … `-(headerDepth + 1)`), so their lines
 * come after its rows; without them, a row's line is its index. A row before every other (below
 * them all) has a line before every other too.
 */
export function rowLine(
    rowIndex: number,
    headerDepth: number,
    top: number,
): number {
    if (rowIndex >= 0) return rowIndex;
    if (rowIndex >= -headerDepth) return rowIndex - top;
    return rowIndex >= -headerDepth - top
        ? rowIndex + headerDepth
        : rowIndex - top;
}

/** The row at a line (`rowLine`'s inverse). */
export function lineRow(
    line: number,
    headerDepth: number,
    top: number,
): number {
    if (line >= 0) return line;
    return line >= -top ? line - headerDepth : line + top;
}

/**
 * What a grid's lines follow (`rowLine`): the header's depth, the top summary rows, and its first
 * and last lines, from its first header row (its first top summary row without a header) to its
 * last bottom summary row (its last body row without).
 */
function linesOf(bounds: GridBounds) {
    const top = bounds.summaryRows?.top ?? 0;
    return {
        depth: bounds.headerDepth ?? bounds.headerRowCount,
        top,
        first: 0 - bounds.headerRowCount - top,
        last: bounds.rowCount + (bounds.summaryRows?.bottom ?? 0) - 1,
    };
}

/** Whether a row index is a row of the grid: a header row shown, a summary row or a body row. */
export function isRowOf(rowIndex: number, bounds: GridBounds): boolean {
    if (!Number.isInteger(rowIndex)) return false;
    const { depth, top, first, last } = linesOf(bounds);
    const line = rowLine(rowIndex, depth, top);
    return (
        line >= first && line <= last && lineRow(line, depth, top) === rowIndex
    );
}

/**
 * The row index kept inside the grid's rows after its shape changed: the nearest row by line, or
 * `null` when it has none.
 */
export function keptRow(rowIndex: number, bounds: GridBounds): number | null {
    const { depth, top, first, last } = linesOf(bounds);
    if (last < first) return null;
    return lineRow(
        clamp(rowLine(rowIndex, depth, top), first, last),
        depth,
        top,
    );
}

/**
 * The cell a move lands on, from `position`. Moves never wrap and stop at the edges; a page moves
 * `pageSize` rows (at least one). Header rows are -1 and above (G4). A header cell's position is
 * its first column, on its row: a group's own row, or for a column spanning header rows (G2), the
 * row it was reached on, so the arrows walk every header row from end to end. Up from a column
 * reaches the group above it, Down from a group its first column in view. A body cell spanning
 * columns (E1.2) is at its first column: a move into a column it covers lands on it, a move out
 * of it leaves from its edge. With summary rows (E2.1) the moves go by line (`rowLine`): the
 * header, the top summary rows, the body, the bottom summary rows; a page stays in the body (the
 * summary rows are reached with the arrows), and Ctrl+End reaches the last bottom summary row.
 */
export function nextPosition(
    position: CellPosition,
    direction: Direction,
    bounds: GridBounds,
    pageSize = 1,
): CellPosition {
    const { depth, top, first: firstLine, last: lines } = linesOf(bounds);
    const lastLine = Math.max(lines, firstLine);
    const lastColumn = Math.max(bounds.columnCount - 1, 0);
    const page = Math.max(1, Math.floor(pageSize));
    const line = (index: number) => clamp(index, firstLine, lastLine);
    const column = (index: number) => clamp(index, 0, lastColumn);
    /** the cell holding a position, at a line: a header cell's span, or the body cell's */
    const spanAt = (at: number, columnIndex: number): HeaderCellSpan => {
        const l = line(at);
        const r = lineRow(l, depth, top);
        const c = column(columnIndex);
        // a header row's line is before the top summary rows'
        const header = l < -top ? bounds.headerCellAt?.(r, c) : undefined;
        if (header) {
            return top === 0
                ? header
                : {
                      rowIndex: header.rowIndex - top,
                      columnIndex: header.columnIndex,
                      rowSpan: header.rowSpan,
                      columnSpan: header.columnSpan,
                  };
        }
        const body = l >= -top ? bounds.cellSpanAt?.(r, c) : undefined;
        return {
            rowIndex: l,
            columnIndex: body?.columnIndex ?? c,
            rowSpan: 1,
            columnSpan: body?.columnSpan ?? 1,
        };
    };
    /** the position of the cell holding a position at a line: its first column, on that row */
    const at = (at: number, columnIndex: number): CellPosition => {
        const l = line(at);
        return {
            rowIndex: lineRow(l, depth, top),
            columnIndex: spanAt(l, columnIndex).columnIndex,
        };
    };
    const from = line(rowLine(position.rowIndex, depth, top));
    const here = spanAt(from, position.columnIndex);
    const stay = at(from, position.columnIndex);
    const first = here.rowIndex;
    const last = here.rowIndex + here.rowSpan - 1;
    /** where a move down from a group lands: its first column in view, else its first column */
    const columnBelow = () => {
        const visible = bounds.visibleColumns;
        const end = here.columnIndex + here.columnSpan;
        return visible &&
            visible.start > here.columnIndex &&
            visible.start < end
            ? visible.start
            : here.columnIndex;
    };
    switch (direction) {
        case "up":
            return first - 1 < firstLine
                ? stay
                : at(first - 1, here.columnIndex);
        case "down":
            return last + 1 > lastLine ? stay : at(last + 1, columnBelow());
        case "left":
            return here.columnIndex - 1 < 0
                ? stay
                : at(from, here.columnIndex - 1);
        case "right": {
            const next = here.columnIndex + here.columnSpan;
            return next > lastColumn ? stay : at(from, next);
        }
        case "row-start":
            return at(from, 0);
        case "row-end":
            return at(from, lastColumn);
        case "grid-start":
            return at(firstLine, 0);
        case "grid-end":
            return at(lastLine, lastColumn);
        case "page-up":
            // a page up stops at the first row: the header (and the top summary rows) are
            // reached with ArrowUp
            return from < 0
                ? stay
                : at(Math.max(from - page, 0), here.columnIndex);
        case "page-down":
            // and a page down at the last one: the bottom summary rows are reached with ArrowDown
            return last >= bounds.rowCount
                ? stay
                : at(
                      Math.min(
                          last + page,
                          Math.max(bounds.rowCount - 1, last),
                      ),
                      columnBelow(),
                  );
    }
}

/** Whether two positions are the same cell: a header cell spanning rows has one per row. */
export function sameCell(
    a: CellPosition,
    b: CellPosition,
    headerCellAt?: (
        rowIndex: number,
        columnIndex: number,
    ) => HeaderCellSpan | undefined,
): boolean {
    if (a.rowIndex === b.rowIndex && a.columnIndex === b.columnIndex) {
        return true;
    }
    if (a.rowIndex >= 0 || b.rowIndex >= 0 || !headerCellAt) return false;
    const cell = headerCellAt(a.rowIndex, a.columnIndex);
    return Boolean(cell && cell === headerCellAt(b.rowIndex, b.columnIndex));
}
