import type { CellRangeState } from "../range/types";
import { clamp, isIndex } from "../utils/utils";
import type { Range } from "../viewport/window";
import { spansOf } from "./bounds";
import type {
    CellPosition,
    CellRange,
    DataGridState,
    SpansState,
} from "./types";

// A range of cells (Epic #88, E4.1–E4.2): the model keeps one, `{ anchor, focus }`, between body
// cells (rows 0 to the last, the grid's columns: never the header nor the summary rows; a group
// row's cells are cells of the range). Its rows and columns are the rectangle between its two
// corners. A cell spanning columns (E1.2) is in it while any of its columns is; on the clipboard,
// a span's value is at its first column in the range, the columns it covers there empty. The
// range, clipboard and fill features share these (Epic #144): the grid's own entry never imports
// them.

/** What a range is read from: the model's state, or a view. */
type RangeState<TRow> = Pick<DataGridState<TRow>, "rowCount" | "columns"> &
    Pick<CellRangeState, "cellSelection" | "selectedRange">;

/** A grid's body: its rows and its columns (whatever the row type). */
export interface BodyShape {
    readonly rowCount: number;
    readonly columns: { readonly length: number };
}

/** Whether two ranges (or none) are the same cells, from the same anchor to the same focus. */
export function sameCellRange(
    a: CellRange | null | undefined,
    b: CellRange | null | undefined,
): boolean {
    if (!a || !b) return (a ?? null) === (b ?? null);
    return (
        a === b ||
        (a.anchor.rowIndex === b.anchor.rowIndex &&
            a.anchor.columnIndex === b.anchor.columnIndex &&
            a.focus.rowIndex === b.focus.rowIndex &&
            a.focus.columnIndex === b.focus.columnIndex)
    );
}

/** Whether a position is a body cell of the grid: a body row, and a column. */
export function isBodyCell(
    state: BodyShape,
    position: CellPosition | null | undefined,
): boolean {
    return (
        position != null &&
        isIndex(position.rowIndex, state.rowCount) &&
        isIndex(position.columnIndex, state.columns.length)
    );
}

/** A range's rows and its columns, ends excluded (`Range`'s). */
export function rangeBounds(range: CellRange): {
    readonly rows: Range;
    readonly columns: Range;
} {
    const { anchor, focus } = range;
    return {
        rows: {
            start: Math.min(anchor.rowIndex, focus.rowIndex),
            end: Math.max(anchor.rowIndex, focus.rowIndex) + 1,
        },
        columns: {
            start: Math.min(anchor.columnIndex, focus.columnIndex),
            end: Math.max(anchor.columnIndex, focus.columnIndex) + 1,
        },
    };
}

/**
 * A range kept inside the grid's body after its shape changed (rows gone, columns gone, cells no
 * longer selectable): each corner clamped to the last row and column, none without rows or
 * columns; the same object when it is inside.
 */
export function keptRange(
    state: BodyShape & Pick<RangeState<unknown>, "cellSelection">,
    range: CellRange | null,
): CellRange | null {
    if (!range) return null;
    const columnCount = state.columns.length;
    if (!state.cellSelection || state.rowCount === 0 || columnCount === 0) {
        return null;
    }
    const kept = (position: CellPosition): CellPosition | null =>
        Number.isInteger(position?.rowIndex) &&
        Number.isInteger(position?.columnIndex)
            ? isBodyCell(state, position)
                ? position
                : {
                      rowIndex: clamp(position.rowIndex, 0, state.rowCount - 1),
                      columnIndex: clamp(
                          position.columnIndex,
                          0,
                          columnCount - 1,
                      ),
                  }
            : null;
    const anchor = kept(range.anchor);
    const focus = kept(range.focus);
    if (!anchor || !focus) return null;
    return anchor === range.anchor && focus === range.focus
        ? range
        : { anchor, focus };
}

/**
 * Whether a body cell (its first column, spanning `columnSpan`) is in the selected range: any of
 * its columns, on one of its rows. Nothing allocated.
 */
export function inRange(
    range: CellRange | null,
    rowIndex: number,
    columnIndex: number,
    columnSpan = 1,
): boolean {
    if (!range) return false;
    const { anchor, focus } = range;
    return (
        rowIndex >= Math.min(anchor.rowIndex, focus.rowIndex) &&
        rowIndex <= Math.max(anchor.rowIndex, focus.rowIndex) &&
        columnIndex + columnSpan - 1 >=
            Math.min(anchor.columnIndex, focus.columnIndex) &&
        columnIndex <= Math.max(anchor.columnIndex, focus.columnIndex)
    );
}

/** The range edges' names, by their bits (top 1, bottom 2, start 4, end 8): no string built. */
const EDGES = Array.from({ length: 16 }, (_, bits) =>
    (["top", "bottom", "start", "end"] as const)
        .filter((_, edge) => bits & (1 << edge))
        .join(" "),
);

/**
 * The edges of the range a cell in it sits on (`"top bottom start end"`, those that apply, in
 * that order; logical: `start` is the right edge right to left), for its borders; `undefined` for
 * a cell inside it, or outside. A cell spanning columns sits on the start edge when it starts at
 * or before it, the end edge when it reaches it or past it.
 */
export function rangeEdgesOf(
    range: CellRange | null,
    rowIndex: number,
    columnIndex: number,
    columnSpan = 1,
): string | undefined {
    if (!range || !inRange(range, rowIndex, columnIndex, columnSpan)) {
        return undefined;
    }
    const { anchor, focus } = range;
    const bits =
        (rowIndex === Math.min(anchor.rowIndex, focus.rowIndex) ? 1 : 0) |
        (rowIndex === Math.max(anchor.rowIndex, focus.rowIndex) ? 2 : 0) |
        (columnIndex <= Math.min(anchor.columnIndex, focus.columnIndex)
            ? 4
            : 0) |
        (columnIndex + columnSpan - 1 >=
        Math.max(anchor.columnIndex, focus.columnIndex)
            ? 8
            : 0);
    return bits === 0 ? undefined : EDGES[bits];
}

/** Whether a body cell is in the selected range, cells being selectable (`is("cell-selected")`). */
export function isCellSelected<TRow>(
    state: RangeState<TRow> & SpansState<TRow>,
    { rowIndex, columnIndex }: CellPosition,
): boolean {
    const range = state.selectedRange;
    if (!state.cellSelection || !range) return false;
    const spans = spansOf(state);
    if (!spans) return inRange(range, rowIndex, columnIndex);
    const span = spans.spanAt(state, rowIndex, columnIndex);
    return inRange(range, rowIndex, span.columnIndex, span.columnSpan);
}

/**
 * The cells a copy, a paste or a fill acts on (E4.2, E4.4): the selected range, else the active
 * body cell, as its first cell (`anchor`: top row, first column) and its last (`focus`); `null`
 * without either.
 */
export function selectedArea(
    state: BodyShape &
        Pick<DataGridState<unknown>, "activePosition"> &
        Pick<CellRangeState, "selectedRange">,
): CellRange | null {
    const range = state.selectedRange;
    const active = state.activePosition;
    if (range) {
        const { rows, columns } = rangeBounds(range);
        return {
            anchor: { rowIndex: rows.start, columnIndex: columns.start },
            focus: { rowIndex: rows.end - 1, columnIndex: columns.end - 1 },
        };
    }
    return active && isBodyCell(state, active)
        ? { anchor: active, focus: active }
        : null;
}

/**
 * An area (its first cell and its last) widened to the column spans it cuts (E1.2, E4.4): on each
 * of its rows, a cell covering its first column from before it or its last one past it moves
 * that edge, again until no span crosses it; the same object without one. Each row is read once
 * a pass (a fill's source, once a press).
 */
export function spannedArea<TRow>(
    state: SpansState<TRow>,
    area: CellRange,
): CellRange {
    const { columns } = state;
    const spans = spansOf(state);
    if (!spans) return area;
    let start = area.anchor.columnIndex;
    let end = area.focus.columnIndex;
    /** the cell the walk is at (one for every row) */
    const cell = { columnIndex: 0, columnSpan: 1 };
    let widened = true;
    while (widened) {
        widened = false;
        for (
            let rowIndex = area.anchor.rowIndex;
            rowIndex <= area.focus.rowIndex;
            rowIndex++
        ) {
            const args = spans.rowArgs(state, rowIndex);
            if (!args) continue;
            spans.covering(
                columns,
                args,
                spans.partStart(columns, start),
                start,
                cell,
            );
            if (cell.columnIndex < start) {
                start = cell.columnIndex;
                widened = true;
            }
            spans.covering(
                columns,
                args,
                spans.partStart(columns, end),
                end,
                cell,
            );
            if (cell.columnIndex + cell.columnSpan - 1 > end) {
                end = cell.columnIndex + cell.columnSpan - 1;
                widened = true;
            }
        }
    }
    return start === area.anchor.columnIndex && end === area.focus.columnIndex
        ? area
        : {
              anchor: { rowIndex: area.anchor.rowIndex, columnIndex: start },
              focus: { rowIndex: area.focus.rowIndex, columnIndex: end },
          };
}
