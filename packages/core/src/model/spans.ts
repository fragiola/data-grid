import {
    isHeaderRow,
    keptSpan,
    partEnd,
    partStart,
    pinnedPartsOf,
} from "../header/header";
import { lowerBound } from "../utils";
import { dataRowAt, rowMetaAt } from "./source";
import { summaryRowAt } from "./summary";
import type { CellPosition, ColSpanArgs, Column, DataGridState } from "./types";

// Column spans (Epic #85, E1.2): a column's `colSpan` makes one of its cells cover the columns
// after it, within its part (pinned at the start, at the end, or not). Pure, and asked only for
// the cells a render or a move needs: a body cell's span depends on its row, so nothing is
// worked out for every row. A row's cells partition each part from its start: a column a span
// covers is never asked.

/** A cell's columns in its row: its first column, and how many it spans. */
export interface CellSpan {
    readonly columnIndex: number;
    readonly columnSpan: number;
}

/** What a grid's columns ask of the spans: worked out once per list. */
interface SpanColumns {
    /** the indexes of the columns with a `colSpan`, ascending (none: no span anywhere) */
    readonly indexes: readonly number[];
    /** how many are pinned at the start, and the first pinned at the end: the parts' edges */
    readonly startCount: number;
    readonly endFrom: number;
}

const spanColumns = new WeakMap<object, SpanColumns>();

/** The columns with a `colSpan`, and the parts' edges (`SpanColumns`), once per list. */
function spanColumnsOf<TRow, TNode>(
    columns: readonly Column<TRow, TNode>[],
): SpanColumns {
    let found = spanColumns.get(columns);
    if (!found) {
        const indexes: number[] = [];
        columns.forEach((column, index) => {
            if (column.colSpan) indexes.push(index);
        });
        found = { indexes, ...pinnedPartsOf(columns) };
        spanColumns.set(columns, found);
    }
    return found;
}

/** Whether a column of the grid has a `colSpan`: without one, every cell is one column. */
export function hasColumnSpans<TRow, TNode>(
    columns: readonly Column<TRow, TNode>[],
): boolean {
    return spanColumnsOf(columns).indexes.length > 0;
}

/**
 * The first column of the part holding `columnIndex` among the grid's columns (`partStart` over
 * their pinned parts): where a row's cells start again.
 */
export function spanPartStart<TRow, TNode>(
    columns: readonly Column<TRow, TNode>[],
    columnIndex: number,
): number {
    const { startCount, endFrom } = spanColumnsOf(columns);
    return partStart(columnIndex, startCount, endFrom);
}

/**
 * How many columns a column's cell spans, asked with `args`: its `colSpan`, kept within its part
 * (and the columns). 1 without one.
 */
function columnSpanOf<TRow, TNode>(
    columns: readonly Column<TRow, TNode>[],
    columnIndex: number,
    args: ColSpanArgs<TRow>,
): number {
    const colSpan = columns[columnIndex]?.colSpan;
    if (!colSpan) return 1;
    const { startCount, endFrom } = spanColumnsOf(columns);
    return keptSpan(
        colSpan(args),
        columnIndex,
        partEnd(columnIndex, startCount, endFrom, columns.length),
    );
}

/**
 * What a body cell's span is read from: the columns and the rows (the summary rows', E2.1, with
 * the header's depth and the row count their indexes follow).
 */
export type SpansState<TRow, TNode = unknown> = Pick<
    DataGridState<TRow, TNode>,
    "columns" | "source" | "rowCount" | "header" | "summaryRows"
>;

/**
 * Whether the active position is in a body cell (E1.2): on its row, its column one the cell's
 * span (from `columnIndex`, `columnSpan` columns) holds. What `is("cell-active")` and a cell's
 * part both ask.
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
 * The walk of a row's cells (E1.2): the cell covering `columnIndex`, its row's cells starting
 * again at `from` (its part's start, or the column right after a cell), written into `cell` (a
 * walk reuses one). A column with no `colSpan` is a cell of its own, so only the ones with one
 * between them are asked, each once, and a column a span covers never is.
 */
export function cellCovering<TRow, TNode>(
    columns: readonly Column<TRow, TNode>[],
    args: ColSpanArgs<TRow>,
    from: number,
    columnIndex: number,
    cell: { columnIndex: number; columnSpan: number } = {
        columnIndex,
        columnSpan: 1,
    },
): CellSpan {
    const { indexes } = spanColumnsOf(columns);
    cell.columnIndex = columnIndex;
    cell.columnSpan = 1;
    /** the first column no cell covers yet: the next cell starts there or later */
    let reach = from;
    for (
        let i = lowerBound(indexes.length, (j) => (indexes[j] ?? 0) < from);
        i < indexes.length;
        i++
    ) {
        const start = indexes[i];
        if (start === undefined || start > columnIndex) break;
        if (start < reach) continue;
        const columnSpan = columnSpanOf(columns, start, args);
        if (start + columnSpan > columnIndex) {
            cell.columnIndex = start;
            cell.columnSpan = columnSpan;
            break;
        }
        reach = start + columnSpan;
    }
    return cell;
}

/**
 * What a loaded row's cells are asked with, a summary row's (E2.1) or a group row's (Epic #87), or
 * `null` for a row not loaded (or no column spans).
 */
export function rowSpanArgs<TRow, TNode>(
    state: SpansState<TRow, TNode>,
    rowIndex: number,
): ColSpanArgs<TRow> | null {
    if (!hasColumnSpans(state.columns)) return null;
    const summary = summaryRowAt(state, rowIndex);
    if (summary) return { type: "summary", ...summary };
    if (rowIndex < 0) return null;
    const meta = rowMetaAt(state.source, rowIndex);
    if (meta?.group) return { type: "group", group: meta.group, rowIndex };
    const row = dataRowAt(state.source, rowIndex, meta);
    return row === undefined ? null : { type: "row", row, rowIndex };
}

/**
 * The body cell covering a position (E1.2): the cell starting at it, or the span reaching it from
 * a column before it in its part (`cellCovering` from the part's start); a row not loaded spans
 * nothing.
 */
export function spanAt<TRow, TNode>(
    state: SpansState<TRow, TNode>,
    rowIndex: number,
    columnIndex: number,
): CellSpan {
    const args = rowSpanArgs(state, rowIndex);
    if (!args) return { columnIndex, columnSpan: 1 };
    const { columns } = state;
    return cellCovering(
        columns,
        args,
        spanPartStart(columns, columnIndex),
        columnIndex,
    );
}

/**
 * The cell covering a position, at its own position (G4, E1.2): a header cell's top row and
 * first column (`header.cellAt`), a body or summary row cell's first column under a span
 * (`spanAt`) on its row; `undefined` for a header position no cell covers. What the model snaps
 * an active position to and the engine finds a cell's element by.
 */
export function coveringCell<TRow, TNode>(
    state: SpansState<TRow, TNode> & Pick<DataGridState<TRow, TNode>, "header">,
    position: CellPosition,
): CellPosition | undefined {
    const { rowIndex, columnIndex } = position;
    if (isHeaderRow(rowIndex, state.header)) {
        return state.header.cellAt(rowIndex, columnIndex);
    }
    const start = spanAt(state, rowIndex, columnIndex).columnIndex;
    return start === columnIndex ? position : { rowIndex, columnIndex: start };
}
