import type { RowSpans } from "../engine/types";
import { keptSpan, partEnd, partStart, pinnedPartsOf } from "../header/header";
import { dataRowAt, rowMetaAt } from "../model/source";
import { summaryRowAt } from "../model/summary";
import type {
    CellSpan,
    CellSpans,
    ColSpanArgs,
    Column,
    SpansState,
} from "../model/types";
import { lowerBound } from "../utils/utils";

// Column spans (Epic #85, E1.2; `cellSpans()`'s since Epic #151): a column's `colSpan` makes one of its cells cover the columns
// after it, within its part (pinned at the start, at the end, or not). Pure, and asked only for
// the cells a render or a move needs: a body cell's span depends on its row, so nothing is
// worked out for every row. A row's cells partition each part from its start: a column a span
// covers is never asked.

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
function hasColumnSpans<TRow, TNode>(
    columns: readonly Column<TRow, TNode>[],
): boolean {
    return spanColumnsOf(columns).indexes.length > 0;
}

/**
 * The first column of the part holding `columnIndex` among the grid's columns (`partStart` over
 * their pinned parts): where a row's cells start again.
 */
function spanPartStart<TRow, TNode>(
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
 * The walk of a row's cells (E1.2): the cell covering `columnIndex`, its row's cells starting
 * again at `from` (its part's start, or the column right after a cell), written into `cell` (a
 * walk reuses one). A column with no `colSpan` is a cell of its own, so only the ones with one
 * between them are asked, each once, and a column a span covers never is.
 */
function cellCovering<TRow, TNode>(
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
function rowSpanArgs<TRow, TNode>(
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
function spanAt<TRow, TNode>(
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
 * The body cells of the rows a view renders where columns span (E1.2): for each loaded row with a
 * span, the columns its cells start at (`columns`, ascending, less the ones a span covers, plus a
 * span reaching into them from a column not rendered) and the spans over 1. `null` without one:
 * every row renders `columns`. Asked of the rendered rows only, along one walk per row
 * (`cellCovering`, from each cell to the next rendered column); a row without a span allocates
 * nothing.
 */
function rowSpansOf<TRow, TNode>(
    state: SpansState<TRow, TNode>,
    rows: readonly number[],
    columns: readonly number[],
): ReadonlyMap<number, RowSpans> | null {
    if (!hasColumnSpans(state.columns)) return null;
    let found: Map<number, RowSpans> | null = null;
    /** the cell the walk is at (one for every row) */
    const cell = { columnIndex: 0, columnSpan: 1 };
    for (const rowIndex of rows) {
        const args = rowSpanArgs(state, rowIndex);
        if (!args) continue;
        /** from the first span on: the columns the cells start at, and the spans */
        let starts: number[] | null = null;
        let spans: Map<number, number> | null = null;
        /** where the next cell starts at the earliest: the end of the last one */
        let reach = 0;
        for (let at = 0; at < columns.length; at++) {
            const columnIndex = columns[at] ?? 0;
            if (columnIndex < reach) continue;
            // a new part starts its cells again: nothing between it and the last part is asked
            // (the columns between the rendered ones and the end part)
            const from = Math.max(
                reach,
                spanPartStart(state.columns, columnIndex),
            );
            cellCovering(state.columns, args, from, columnIndex, cell);
            if (cell.columnSpan > 1) {
                // every column before the first span is a cell of its own
                starts ??= columns.slice(0, at);
                spans ??= new Map();
                spans.set(cell.columnIndex, cell.columnSpan);
            }
            starts?.push(cell.columnIndex);
            reach = cell.columnIndex + cell.columnSpan;
        }
        if (starts && spans) {
            found ??= new Map();
            found.set(rowIndex, { columns: starts, spans });
        }
    }
    return found;
}

/** The column spans as the core and the other features ask them (`spansOf`): one for every grid. */
export const SPANS: CellSpans = {
    hasSpans: hasColumnSpans,
    spanAt,
    rowArgs: rowSpanArgs,
    covering: cellCovering,
    partStart: spanPartStart,
    rowSpans: rowSpansOf,
};
