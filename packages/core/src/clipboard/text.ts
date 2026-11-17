import { type BodyShape, isBodyCell, rangeBounds } from "../model/range";
import { dataRowAt, rowCellValue, rowMetaAt, valueText } from "../model/source";
import {
    cellCovering,
    hasColumnSpans,
    type SpansState,
    spanPartStart,
} from "../model/spans";
import type {
    CellPosition,
    CellRange,
    ColSpanArgs,
    Column,
    GroupRow,
    RangePaste,
} from "../model/types";
import { toTsv } from "./clipboard";

// A range's text on the clipboard and where a paste lands (Epic #88, E4.2): the clipboard
// feature's (Epic #144).

/**
 * A row's cell's text on the clipboard, its row read once (`rangeText`): a loaded data row's
 * through its column's `getCopyText`, else its value as text; a group row's value as text; empty
 * for a row not loaded.
 */
function copyText<TRow, TNode>(
    column: Column<TRow, TNode> | undefined,
    columnIndex: number,
    rowIndex: number,
    group: GroupRow | undefined,
    row: TRow | undefined,
): string {
    if (!column) return "";
    const value = rowCellValue(column, rowIndex, group, row);
    if (group || row === undefined) return valueText(value);
    return column.getCopyText
        ? column.getCopyText({ row, rowIndex, column, columnIndex, value })
        : valueText(value);
}

/**
 * A range's cells as TSV (E4.2), a row per line: each cell's text (`copyText`); under column
 * spans, a span's at its first column in the range and the columns it covers there empty. Each
 * row is read once (its kind, its data row) and its spans walked once, left to right
 * (`cellCovering`, as a render's `rowSpansOf`). Every cell of the range is read: rows not loaded
 * copy empty.
 */
export function rangeText<TRow>(
    state: SpansState<TRow>,
    range: CellRange,
): string {
    const { columns: cells, source } = state;
    const { rows, columns } = rangeBounds(range);
    const spans = hasColumnSpans(cells);
    /** the cell the walk is at (one for every row) */
    const cell = { columnIndex: 0, columnSpan: 1 };
    const lines: string[][] = [];
    for (let rowIndex = rows.start; rowIndex < rows.end; rowIndex++) {
        const meta = rowMetaAt(source, rowIndex);
        const group = meta?.group;
        const row = group ? undefined : dataRowAt(source, rowIndex, meta);
        const args: ColSpanArgs<TRow> | null = !spans
            ? null
            : group
              ? { type: "group", group, rowIndex }
              : row === undefined
                ? null
                : { type: "row", row, rowIndex };
        const line: string[] = [];
        /** where the next cell starts at the earliest: the end of the last one */
        let reach = 0;
        let start = columns.start;
        for (
            let columnIndex = columns.start;
            columnIndex < columns.end;
            columnIndex++
        ) {
            if (args && columnIndex >= reach) {
                cellCovering(
                    cells,
                    args,
                    Math.max(reach, spanPartStart(cells, columnIndex)),
                    columnIndex,
                    cell,
                );
                start = cell.columnIndex;
                reach = cell.columnIndex + cell.columnSpan;
            } else if (!args) {
                start = columnIndex;
            }
            line.push(
                start === columnIndex || columnIndex === columns.start
                    ? copyText(cells[start], start, rowIndex, group, row)
                    : "",
            );
        }
        lines.push(line);
    }
    return toTsv(lines);
}

/**
 * Where a paste lands (E4.2): from `at` (the selected range's first cell, or the active cell), as
 * many rows and columns as `values` (rows padded with empty values to the longest), cut at the
 * grid's last row and column; `null` when nothing lands (no values, `at` no body cell).
 */
export function pastedRange(
    state: BodyShape,
    at: CellPosition,
    values: readonly (readonly string[])[],
): RangePaste | null {
    if (!isBodyCell(state, at)) return null;
    const width = values.reduce(
        (widest, row) => Math.max(widest, row.length),
        0,
    );
    const rowCount = Math.min(values.length, state.rowCount - at.rowIndex);
    const columnCount = Math.min(width, state.columns.length - at.columnIndex);
    if (rowCount <= 0 || columnCount <= 0) return null;
    const cut = values
        .slice(0, rowCount)
        .map((row) =>
            Array.from(
                { length: columnCount },
                (_, column) => row[column] ?? "",
            ),
        );
    return {
        range: {
            anchor: at,
            focus: {
                rowIndex: at.rowIndex + rowCount - 1,
                columnIndex: at.columnIndex + columnCount - 1,
            },
        },
        values: cut,
    };
}
