import type {
    SummaryPosition,
    SummaryRowCounts,
    SummaryRowView,
} from "./types";

// Summary rows (Epic #86, E2.1): rows the app fills (totals, counts, averages) that stay under
// the header (top) and at the view's bottom edge (bottom). They hold no data of their own: a
// column's `renderSummaryCell` draws each of their cells from the app's own closure, so the grid
// keeps one generic, the row type (D10). The model keeps how many there are; their row indexes
// extend the grid's on both sides, the header's and the body's untouched:
//
//   header rows          -depth … -1 (as without summary rows)
//   top summary rows     -(depth + top) … -(depth + 1), the first one first
//   body rows            0 … rowCount - 1
//   bottom summary rows  rowCount … rowCount + bottom - 1
//
// (`depth` is the header's, shown or not). Top to bottom on screen, a grid's rows are the header's,
// the top summary rows, the body rows and the bottom summary rows: the keys move in that order
// (`rowLine`), and ARIA counts them in it.

/** No summary rows: a grid's counts when it is given none. */
export const NO_SUMMARY_ROWS: SummaryRowCounts = { top: 0, bottom: 0 };

/** What a grid's row indexes follow: its body rows, its header's depth and its summary rows. */
export interface RowBands {
    readonly rowCount: number;
    readonly header: { readonly depth: number };
    readonly summaryRows: SummaryRowCounts;
}

/** Where a grid's summary rows start: the first top one's row index, and the first bottom one's. */
function firstRows(grid: RowBands): Record<SummaryPosition, number> {
    return {
        top: 0 - grid.header.depth - grid.summaryRows.top,
        bottom: grid.rowCount,
    };
}

/** The row index of a summary row (see the scheme above). */
export function summaryRowIndex(
    grid: RowBands,
    position: SummaryPosition,
    summaryIndex: number,
): number {
    return firstRows(grid)[position] + summaryIndex;
}

/** The summary row at a row index, or `undefined` for a header or a body row. */
export function summaryRowAt(
    grid: RowBands,
    rowIndex: number,
): SummaryRowView | undefined {
    const first = firstRows(grid);
    const position: SummaryPosition = rowIndex < 0 ? "top" : "bottom";
    const summaryIndex = rowIndex - first[position];
    return summaryIndex >= 0 && summaryIndex < grid.summaryRows[position]
        ? { rowIndex, position, summaryIndex }
        : undefined;
}

/** A position's summary rows, the first one first. */
export function summaryRowsOf(
    grid: RowBands,
    position: SummaryPosition,
): SummaryRowView[] {
    const first = firstRows(grid)[position];
    return Array.from({ length: grid.summaryRows[position] }, (_, index) => ({
        rowIndex: first + index,
        position,
        summaryIndex: index,
    }));
}

/** Every summary row's index, the top ones first. */
export function summaryRowIndexes(grid: RowBands): number[] {
    return [
        ...summaryRowsOf(grid, "top"),
        ...summaryRowsOf(grid, "bottom"),
    ].map((row) => row.rowIndex);
}

/** Whether a count is one: a whole number, 0 or more. */
function isCount(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * The counts a payload or an option gives (a count left out is 0), or `null` when one is not a
 * whole number, 0 or more. `current` is returned when they are the same.
 */
export function summaryRowCounts(
    given: { readonly top?: unknown; readonly bottom?: unknown } | undefined,
    current: SummaryRowCounts = NO_SUMMARY_ROWS,
): SummaryRowCounts | null {
    const top = given?.top ?? 0;
    const bottom = given?.bottom ?? 0;
    if (!isCount(top) || !isCount(bottom)) return null;
    return top === current.top && bottom === current.bottom
        ? current
        : { top, bottom };
}
