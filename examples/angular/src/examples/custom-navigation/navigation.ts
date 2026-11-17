import type { CellPosition } from "@fragiola/data-grid-angular";

/** What Tab, and the arrows at a row's ends, do in the grid. */
export type Mode =
    | "leave"
    | "change-row"
    | "loop-over-row"
    | "loop-over-column";

/**
 * Where a key goes from `at`: Tab (or Shift+Tab, `step` -1) anywhere, an arrow only past a row's
 * first or last cell (inside the row the grid moves it as usual). The header is row -1: Tab goes
 * through it like any row. `null` leaves the key to the grid: Tab leaves it, an arrow at an end
 * stays.
 */
export function target(
    at: CellPosition,
    step: 1 | -1,
    tab: boolean,
    mode: Mode,
    rowCount: number,
    columnCount: number,
): CellPosition | null {
    if (mode === "leave") return null;
    if (mode === "loop-over-column") {
        if (!tab) return null;
        // past the last row, the header; before the header, the last row
        const rowIndex = at.rowIndex + step;
        return {
            rowIndex:
                rowIndex >= rowCount
                    ? -1
                    : rowIndex < -1
                      ? rowCount - 1
                      : rowIndex,
            columnIndex: at.columnIndex,
        };
    }
    const columnIndex = at.columnIndex + step;
    if (columnIndex >= 0 && columnIndex < columnCount) {
        return tab ? { rowIndex: at.rowIndex, columnIndex } : null;
    }
    const wrapped = step === 1 ? 0 : columnCount - 1;
    if (mode === "loop-over-row") {
        return { rowIndex: at.rowIndex, columnIndex: wrapped };
    }
    const rowIndex = at.rowIndex + step;
    // past the grid's first or last cell, Tab leaves it as usual
    if (rowIndex < -1 || rowIndex >= rowCount) return null;
    return { rowIndex, columnIndex: wrapped };
}
