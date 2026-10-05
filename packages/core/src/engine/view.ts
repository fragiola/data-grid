import { type Axis, createAxis, withExtraSizes } from "../axis/axis";
import { headerCellsIn, headerRowCount, pinnedEndFrom } from "../header/header";
import { holdsRow, holdsRowIn } from "../model/expansion";
import { rowAt } from "../model/source";
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
import type { GridView, HeaderRowView } from "./types";

// The view (D9), as pure functions: the axes a state lays out, the view a render shows built from
// the state, the windows and the sizes, and whether a new one differs from the last (scrolling
// inside the overscan renders nothing). The header lookups the engine scrolls and focuses by too.

export function rowAxisOf<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
): Axis {
    return createAxis(state.rowCount, state.rowHeight);
}

/** The rows' axis with the expanded rows' details on top of their own heights (M2). */
export function withDetails<TRow, TNode>(
    base: Axis,
    state: DataGridState<TRow, TNode>,
): Axis {
    if (state.expandedRows.length === 0) return base;
    const { detailHeight, source } = state;
    const sizeOf =
        typeof detailHeight === "number"
            ? () => detailHeight
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
 * The column rendered outside the window for the active cell: its own, or none for a header
 * cell whose span reaches into the window (it is rendered with the window's cells).
 */
export function activeColumn<TRow, TNode>(
    active: CellPosition | null,
    header: HeaderLayout<TRow, TNode>,
    pinnedCount: number,
    renderedColumns: Range,
    endFrom = Number.POSITIVE_INFINITY,
): number | null {
    // a pinned column is always rendered
    if (
        !active ||
        active.columnIndex < pinnedCount ||
        active.columnIndex >= endFrom
    ) {
        return null;
    }
    if (active.rowIndex < 0) {
        const cell = header.cellAt(active.rowIndex, active.columnIndex);
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
    );
    const rowsOfHeader = headerRowCount(state);
    const { start, end } = columnWindow.rendered;
    return {
        ...measures,
        rows: indexes(
            rowWindow.rendered.start,
            rowWindow.rendered.end,
            active && active.rowIndex >= 0 ? active.rowIndex : null,
        ),
        // the pinned columns first and last, always rendered
        columns: indexes(
            endFrom,
            columnCount,
            null,
            indexes(start, end, extraColumn, indexes(0, pinnedCount, null)),
        ),
        renderedRows: rowWindow.rendered,
        renderedColumns: columnWindow.rendered,
        rowBase: rowAxis.offsetOf(rowWindow.rendered.start),
        columnBase: columnAxis.offsetOf(start),
        headerRowHeight: state.headerRowHeight,
        headerRowCount: rowsOfHeader,
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
    "interaction",
    "columnResize",
    "columnReorder",
    "direction",
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
    const { expandedRows, renderedRows, active } = next;
    // the visible area matters only to an empty grid, and its width to the details on
    // screen (as wide as the view): a resize alone renders nothing else
    return (
        ((current.rowCount === 0 || next.rowCount === 0) &&
            (current.viewportWidth !== next.viewportWidth ||
                current.viewportBodyHeight !== next.viewportBodyHeight)) ||
        (current.viewportWidth !== next.viewportWidth &&
            // an expanded row it renders (its rendered rows, or the active row)
            (holdsRowIn(expandedRows, renderedRows.start, renderedRows.end) ||
                (active !== null && holdsRow(expandedRows, active.rowIndex))))
    );
}

/** Where a cell's element is: a header cell's top row and first column. */
export function elementPosition<TRow, TNode>(
    position: CellPosition,
    header: HeaderLayout<TRow, TNode>,
): CellPosition {
    if (position.rowIndex >= 0) return position;
    const cell = header.cellAt(position.rowIndex, position.columnIndex);
    return cell
        ? { rowIndex: cell.rowIndex, columnIndex: cell.columnIndex }
        : position;
}

/**
 * The column to scroll to for a cell: its own, or for a header cell spanning columns, none
 * while any of them is in view (`visibleColumns`), else the one nearest to the view.
 */
export function columnToScrollTo<TRow, TNode>(
    position: CellPosition,
    header: HeaderLayout<TRow, TNode>,
    pinnedCount: number,
    visibleColumns: Range,
    endFrom = Number.POSITIVE_INFINITY,
): number | undefined {
    if (position.rowIndex >= 0) return position.columnIndex;
    const cell = header.cellAt(position.rowIndex, position.columnIndex);
    if (!cell || cell.columnSpan <= 1) return position.columnIndex;
    // a pinned group is always in view
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
