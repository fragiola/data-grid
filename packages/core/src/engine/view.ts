import { type Axis, createAxis, withExtraSizes } from "../axis/axis";
import {
    headerCellsIn,
    headerRowCount,
    isHeaderRow,
    pinnedEndFrom,
} from "../header/header";
import { holdsRow, holdsRowIn } from "../model/expansion";
import { rowAt } from "../model/source";
import {
    type CellSpan,
    cellCovering,
    coveringCell,
    hasColumnSpans,
    rowSpanArgs,
    type SpansState,
    spanAt,
    spanPartStart,
} from "../model/spans";
import { summaryRowIndexes } from "../model/summary";
import type {
    CellPosition,
    ColumnWidths,
    DataGridState,
    HeaderLayout,
} from "../model/types";
import { columnWidth, NO_WIDTHS } from "../model/widths";
import { memo } from "../utils";
import {
    type AxisWindow,
    overlaps,
    type Range,
    sameRange,
} from "../viewport/window";
import type { GridView, HeaderRowView, RowSpans } from "./types";

// The view (D9), as pure functions: the axes a state lays out, the view a render shows built from
// the state, the windows and the sizes, and whether a new one differs from the last (scrolling
// inside the overscan renders nothing). The header lookups the engine scrolls and focuses by too.

/** The rows' own heights: measured ones (`"auto"`, E2.2) at their estimate, which an engine corrects. */
export function rowAxisOf<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
): Axis {
    const { rowHeight } = state;
    return createAxis(
        state.rowCount,
        rowHeight === "auto" ? state.estimatedRowHeight : rowHeight,
    );
}

/**
 * The rows' axis with the expanded rows' details on top of their own heights (M2): a measured
 * detail (`"auto"`, E2.2) its height in `measured`, else its estimate.
 */
export function withDetails<TRow, TNode>(
    base: Axis,
    state: DataGridState<TRow, TNode>,
    measured?: { heightAt(index: number): number | undefined },
): Axis {
    if (state.expandedRows.length === 0) return base;
    const { detailHeight, source } = state;
    const sizeOf =
        typeof detailHeight === "number"
            ? () => detailHeight
            : detailHeight === "auto"
              ? (index: number) =>
                    measured?.heightAt(index) ?? state.estimatedDetailHeight
              : (index: number) => {
                    const row = rowAt(source, index);
                    return row === undefined ? 0 : detailHeight(row, index);
                };
    return withExtraSizes(
        base,
        state.expandedRows.map((index) => ({ index, size: sizeOf(index) })),
    );
}

/**
 * The columns' axis: each one's width on screen, its resized width, else the engine's for it
 * (`autoWidths`: an automatic width, a flex share), else its own, within its limits (W1, A1).
 */
export function columnAxisOf<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    autoWidths: ColumnWidths = NO_WIDTHS,
): Axis {
    const { columns, columnWidths } = state;
    return createAxis(columns.length, (index) => {
        const column = columns[index];
        return column ? columnWidth(column, columnWidths, autoWidths) : 0;
    });
}

/** `list` with `start` … `end` appended, and `extra` added in order when it is outside. */
function indexes(
    start: number,
    end: number,
    extra: number | null,
    list: number[] = [],
): number[] {
    if (extra !== null && extra >= 0 && extra < start) list.push(extra);
    for (let i = start; i < end; i++) list.push(i);
    if (extra !== null && extra >= end) list.push(extra);
    return list;
}

/**
 * A column window without the pinned columns (the overscan may reach into them): from the first
 * column after those pinned at the start (`pinnedCount`) to the first pinned at the end
 * (`endFrom`, none without).
 */
export function scrollingWindow(
    columns: AxisWindow,
    pinnedCount: number,
    endFrom = Number.POSITIVE_INFINITY,
): AxisWindow {
    const { visible, rendered } = columns;
    if (rendered.start >= pinnedCount && rendered.end <= endFrom) {
        return columns;
    }
    return {
        visible: between(visible, pinnedCount, endFrom),
        rendered: between(rendered, pinnedCount, endFrom),
    };
}

/** A range kept between the pinned columns: from `from` on, before `to`. */
function between(range: Range, from: number, to: number): Range {
    if (range.start >= from && range.end <= to) return range;
    const start = Math.min(Math.max(range.start, from), to);
    return { start, end: Math.min(Math.max(range.end, start), to) };
}

/**
 * The column rendered outside the window for the active cell: its own, or none for a cell whose
 * span reaches into the window (it is rendered with the window's cells): a header cell's, or
 * `activeSpan`, a body cell's under column spans (E1.2).
 */
export function activeColumn<TRow, TNode>(
    active: CellPosition | null,
    header: HeaderLayout<TRow, TNode>,
    pinnedCount: number,
    renderedColumns: Range,
    endFrom = Number.POSITIVE_INFINITY,
    activeSpan?: CellSpan,
): number | null {
    // a pinned column is always rendered
    if (
        !active ||
        active.columnIndex < pinnedCount ||
        active.columnIndex >= endFrom
    ) {
        return null;
    }
    const cell = isHeaderRow(active.rowIndex, header)
        ? header.cellAt(active.rowIndex, active.columnIndex)
        : activeSpan;
    if (
        cell &&
        overlaps(
            renderedColumns,
            cell.columnIndex,
            cell.columnIndex + cell.columnSpan,
        )
    ) {
        return null;
    }
    return active.columnIndex;
}

/** The header rows for the rendered columns (`createHeaderRows`). */
export type HeaderRowsFor<TRow, TNode> = (
    header: HeaderLayout<TRow, TNode>,
    count: number,
    start: number,
    end: number,
    extra: number | null,
    pinned: number,
    endFrom: number | null,
) => readonly HeaderRowView<TRow, TNode>[];

/** The header rows for the rendered columns: laid out again only when they change. */
export function createHeaderRows<TRow, TNode>(): HeaderRowsFor<TRow, TNode> {
    return memo(
        (
            header: HeaderLayout<TRow, TNode>,
            count: number,
            start: number,
            end: number,
            extra: number | null,
            pinned: number,
            endFrom: number | null,
        ): readonly HeaderRowView<TRow, TNode>[] => {
            if (count === 0) return [];
            // the cells of the columns pinned at the start first, at the end last: a pinned group
            // holds only columns pinned where it is
            const pinnedCells =
                pinned > 0 ? headerCellsIn(header, 0, pinned) : [];
            const endCells =
                endFrom !== null
                    ? headerCellsIn(header, endFrom, Number.POSITIVE_INFINITY)
                    : [];
            return headerCellsIn(header, start, end, extra).map(
                (cells, level) => ({
                    rowIndex: level - count,
                    cells: [
                        ...(pinnedCells[level] ?? []),
                        ...cells,
                        ...(endCells[level] ?? []),
                    ],
                }),
            );
        },
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
export function rowSpansOf<TRow, TNode>(
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

/** What a view is built from: the model's state, the windows, and the view's own measures. */
export interface ViewInputs<TRow, TNode>
    extends Pick<
        GridView<TRow, TNode>,
        | "rowAxis"
        | "columnAxis"
        | "width"
        | "height"
        | "headerHeight"
        | "viewportWidth"
        | "viewportBodyHeight"
        | "pinnedColumnCount"
        | "pinnedWidth"
        | "pinnedEndColumnCount"
        | "pinnedEndWidth"
        | "rowsRevision"
        | "interaction"
        | "columnResize"
        | "columnReorder"
        | "reorderableRows"
        | "rowReorder"
        | "fillable"
        | "fill"
        | "direction"
    > {
    readonly state: DataGridState<TRow, TNode>;
    readonly rowWindow: AxisWindow;
    /** the columns that scroll (`scrollingWindow`) */
    readonly columnWindow: AxisWindow;
    /** the header rows' layout, kept from view to view (`createHeaderRows`) */
    readonly headerRowsFor: HeaderRowsFor<TRow, TNode>;
}

/** The view a render shows for its inputs: its own measures as given, the rest from the state. */
export function buildView<TRow, TNode>({
    state,
    rowWindow,
    columnWindow,
    headerRowsFor,
    ...measures
}: ViewInputs<TRow, TNode>): GridView<TRow, TNode> {
    const {
        rowAxis,
        columnAxis,
        pinnedColumnCount: pinnedCount,
        pinnedEndColumnCount: endCount,
    } = measures;
    const active = state.activePosition;
    const columnCount = state.columns.length;
    const endFrom = pinnedEndFrom(columnCount, endCount);
    const extraColumn = activeColumn(
        active,
        state.header,
        pinnedCount,
        columnWindow.rendered,
        endFrom,
        active && hasColumnSpans(state.columns)
            ? spanAt(state, active.rowIndex, active.columnIndex)
            : undefined,
    );
    const rowsOfHeader = headerRowCount(state);
    const { start, end } = columnWindow.rendered;
    // the active body row (a summary row is always rendered), and the row a drag is moving
    // (E2.3): its handle holds the pointer while the edge scroll takes it out of the window
    const rows = indexes(
        rowWindow.rendered.start,
        rowWindow.rendered.end,
        active && active.rowIndex >= 0 && active.rowIndex < state.rowCount
            ? active.rowIndex
            : null,
    );
    const dragged = measures.rowReorder?.rowIndex;
    if (
        dragged !== undefined &&
        dragged < state.rowCount &&
        !rows.includes(dragged)
    ) {
        const at = rows.findIndex((rowIndex) => rowIndex > dragged);
        rows.splice(at < 0 ? rows.length : at, 0, dragged);
    }
    // the pinned columns first and last, always rendered
    const columns = indexes(
        endFrom,
        columnCount,
        null,
        indexes(start, end, extraColumn, indexes(0, pinnedCount, null)),
    );
    const { summaryRows } = state;
    return {
        ...measures,
        rows,
        columns,
        // the summary rows' cells span too (E2.1)
        rowSpans: rowSpansOf(
            state,
            summaryRows.top + summaryRows.bottom > 0 &&
                hasColumnSpans(state.columns)
                ? [...rows, ...summaryRowIndexes(state)]
                : rows,
            columns,
        ),
        renderedRows: rowWindow.rendered,
        renderedColumns: columnWindow.rendered,
        rowBase: rowAxis.offsetOf(rowWindow.rendered.start),
        columnBase: columnAxis.offsetOf(start),
        headerRowHeight: state.headerRowHeight,
        headerRowCount: rowsOfHeader,
        summaryRows,
        summaryRowHeight: state.summaryRowHeight,
        summaryRevision: state.summaryRevision,
        headerRows: headerRowsFor(
            state.header,
            rowsOfHeader,
            start,
            end,
            extraColumn,
            pinnedCount,
            endCount > 0 ? endFrom : null,
        ),
        header: state.header,
        rowCount: state.rowCount,
        columnCount,
        columnDefs: state.columns,
        source: state.source,
        active,
        sortColumns: state.sortColumns,
        expandedRows: state.expandedRows,
        rowKey: state.rowKey,
        rowSelection: state.rowSelection,
        selectedRowKeys: state.selectedRowKeys,
        isRowSelectable: state.isRowSelectable,
        cellSelection: state.cellSelection,
        selectedRange: state.selectedRange,
        editingCell: state.editingCell,
        collapsedGroupKeys: state.collapsedGroupKeys,
        expandedGroupKeys: state.expandedGroupKeys,
        givenDirection: state.direction,
        measuredRows: state.rowHeight === "auto",
        measuredDetails: state.detailHeight === "auto",
    };
}

/**
 * The view's fields compared by identity to tell a new view; the rest follow from them and the
 * rendered ranges (the rows and columns to render, the header's height).
 */
const VIEW_KEYS = [
    "width",
    "height",
    "headerRowHeight",
    "header",
    "summaryRows",
    "summaryRowHeight",
    "summaryRevision",
    "rowAxis",
    "columnAxis",
    "columnDefs",
    "source",
    "active",
    "rowsRevision",
    "sortColumns",
    "pinnedColumnCount",
    "pinnedEndColumnCount",
    "expandedRows",
    "rowKey",
    "rowSelection",
    "selectedRowKeys",
    "isRowSelectable",
    "cellSelection",
    "selectedRange",
    "editingCell",
    "fillable",
    "fill",
    "collapsedGroupKeys",
    "expandedGroupKeys",
    "interaction",
    "columnResize",
    "columnReorder",
    "reorderableRows",
    "rowReorder",
    "direction",
    "givenDirection",
    "measuredRows",
    "measuredDetails",
] as const satisfies readonly (keyof GridView)[];

/** Whether `next` renders anything `current` does not: a new view to publish. */
export function viewChanged<TRow, TNode>(
    current: GridView<TRow, TNode>,
    next: GridView<TRow, TNode>,
): boolean {
    if (
        !sameRange(current.renderedRows, next.renderedRows) ||
        !sameRange(current.renderedColumns, next.renderedColumns)
    ) {
        return true;
    }
    if (VIEW_KEYS.some((key) => current[key] !== next[key])) return true;
    const { expandedRows, renderedRows, active, rowReorder } = next;
    // the visible area matters only to an empty grid, and its width to the details on
    // screen (as wide as the view): a resize alone renders nothing else
    return (
        ((current.rowCount === 0 || next.rowCount === 0) &&
            (current.viewportWidth !== next.viewportWidth ||
                current.viewportBodyHeight !== next.viewportBodyHeight)) ||
        (current.viewportWidth !== next.viewportWidth &&
            // an expanded row it renders (its rendered rows, the active row, a dragged row)
            (holdsRowIn(expandedRows, renderedRows.start, renderedRows.end) ||
                (active !== null && holdsRow(expandedRows, active.rowIndex)) ||
                (rowReorder !== null &&
                    holdsRow(expandedRows, rowReorder.rowIndex))))
    );
}

/**
 * Where a cell's element is: a header cell's top row and first column, a body cell spanning
 * columns its first column (E1.2).
 */
export function elementPosition<TRow, TNode>(
    position: CellPosition,
    state: SpansState<TRow, TNode> & Pick<DataGridState<TRow, TNode>, "header">,
): CellPosition {
    const cell = coveringCell(state, position);
    return !cell || cell === position
        ? position
        : { rowIndex: cell.rowIndex, columnIndex: cell.columnIndex };
}

/**
 * The column to scroll to for a cell: its own, or for a cell spanning columns (a header cell's
 * span, `cellSpan` a body or summary row cell's under column spans), none while any of them is in
 * view (`visibleColumns`), else the one nearest to the view.
 */
export function columnToScrollTo<TRow, TNode>(
    position: CellPosition,
    header: HeaderLayout<TRow, TNode>,
    pinnedCount: number,
    visibleColumns: Range,
    endFrom = Number.POSITIVE_INFINITY,
    cellSpan?: CellSpan,
): number | undefined {
    const cell = isHeaderRow(position.rowIndex, header)
        ? header.cellAt(position.rowIndex, position.columnIndex)
        : cellSpan;
    if (!cell || cell.columnSpan <= 1) return position.columnIndex;
    // a pinned span is always in view
    if (
        cell.columnIndex + cell.columnSpan <= pinnedCount ||
        cell.columnIndex >= endFrom
    ) {
        return undefined;
    }
    const end = cell.columnIndex + cell.columnSpan;
    if (overlaps(visibleColumns, cell.columnIndex, end)) {
        return undefined;
    }
    return end <= visibleColumns.start ? end - 1 : cell.columnIndex;
}
