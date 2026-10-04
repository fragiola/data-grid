import { type Axis, createAxis, withExtraSizes } from "../axis/axis";
import { headerCellsIn, headerRowCount } from "../header/header";
import { holdsRow, holdsRowIn } from "../model/expansion";
import { rowAt } from "../model/source";
import type { CellPosition, DataGridState, HeaderLayout } from "../model/types";
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

export function columnAxisOf<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
): Axis {
    const { columns } = state;
    return createAxis(columns.length, (index) => columns[index]?.width ?? 0);
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

/** The header cell at a header position (a group, or a column's on its rows). */
export function headerCellAt<TRow, TNode>(
    header: HeaderLayout<TRow, TNode>,
    { rowIndex, columnIndex }: CellPosition,
) {
    return header.cellAt(rowIndex, columnIndex);
}

/** A column window without the pinned columns (the overscan may reach into them). */
export function scrollingWindow(
    columns: AxisWindow,
    pinnedCount: number,
): AxisWindow {
    const { visible, rendered } = columns;
    if (rendered.start >= pinnedCount) return columns;
    const clamp = (range: Range): Range =>
        range.start >= pinnedCount
            ? range
            : {
                  start: pinnedCount,
                  end: Math.max(range.end, pinnedCount),
              };
    return { visible: clamp(visible), rendered: clamp(rendered) };
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
): number | null {
    // a pinned column is always rendered
    if (!active || active.columnIndex < pinnedCount) return null;
    if (active.rowIndex < 0) {
        const cell = headerCellAt(header, active);
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
        ): readonly HeaderRowView<TRow, TNode>[] => {
            if (count === 0) return [];
            // the pinned columns' cells first: a pinned group holds only pinned columns
            const pinnedCells =
                pinned > 0 ? headerCellsIn(header, 0, pinned) : [];
            return headerCellsIn(header, start, end, extra).map(
                (cells, level) => ({
                    rowIndex: level - count,
                    cells: [...(pinnedCells[level] ?? []), ...cells],
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
        | "rowsRevision"
        | "interaction"
    > {
    readonly state: DataGridState<TRow, TNode>;
    readonly rowWindow: AxisWindow;
    /** the columns that scroll (`scrollingWindow`) */
    readonly columnWindow: AxisWindow;
    /** the header rows' layout, kept from view to view (`createHeaderRows`) */
    readonly headerRowsFor: HeaderRowsFor<TRow, TNode>;
}

/** The view a render shows for its inputs. */
export function buildView<TRow, TNode>({
    state,
    rowWindow,
    columnWindow,
    rowAxis,
    columnAxis,
    width,
    height,
    headerHeight,
    viewportWidth,
    viewportBodyHeight,
    pinnedColumnCount: pinnedCount,
    pinnedWidth,
    rowsRevision,
    interaction,
    headerRowsFor,
}: ViewInputs<TRow, TNode>): GridView<TRow, TNode> {
    const active = state.activePosition;
    const extraColumn = activeColumn(
        active,
        state.header,
        pinnedCount,
        columnWindow.rendered,
    );
    const rowsOfHeader = headerRowCount(state);
    const { start, end } = columnWindow.rendered;
    return {
        rows: indexes(
            rowWindow.rendered.start,
            rowWindow.rendered.end,
            active && active.rowIndex >= 0 ? active.rowIndex : null,
        ),
        // the pinned columns first, always rendered
        columns: indexes(
            start,
            end,
            extraColumn,
            indexes(0, pinnedCount, null),
        ),
        renderedRows: rowWindow.rendered,
        renderedColumns: columnWindow.rendered,
        rowBase: rowAxis.offsetOf(rowWindow.rendered.start),
        columnBase: columnAxis.offsetOf(start),
        width,
        height,
        headerHeight,
        headerRowHeight: state.headerRowHeight,
        viewportWidth,
        viewportBodyHeight,
        headerRowCount: rowsOfHeader,
        headerRows: headerRowsFor(
            state.header,
            rowsOfHeader,
            start,
            end,
            extraColumn,
            pinnedCount,
        ),
        header: state.header,
        rowCount: state.rowCount,
        columnCount: state.columns.length,
        rowAxis,
        columnAxis,
        columnDefs: state.columns,
        source: state.source,
        active,
        rowsRevision,
        sortColumns: state.sortColumns,
        pinnedColumnCount: pinnedCount,
        pinnedWidth,
        expandedRows: state.expandedRows,
        rowKey: state.rowKey,
        rowSelection: state.rowSelection,
        selectedRowKeys: state.selectedRowKeys,
        isRowSelectable: state.isRowSelectable,
        interaction,
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
    "expandedRows",
    "rowKey",
    "rowSelection",
    "selectedRowKeys",
    "isRowSelectable",
    "interaction",
] as const satisfies readonly (keyof GridView)[];

/** Whether a view renders an expanded row (its rendered rows, or the active row). */
export function rendersDetail<TRow, TNode>(
    next: GridView<TRow, TNode>,
): boolean {
    const { expandedRows, renderedRows, active } = next;
    if (expandedRows.length === 0) return false;
    return (
        holdsRowIn(expandedRows, renderedRows.start, renderedRows.end) ||
        (active !== null && holdsRow(expandedRows, active.rowIndex))
    );
}

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
    // the visible area matters only to an empty grid, and its width to the details on
    // screen (as wide as the view): a resize alone renders nothing else
    return (
        ((current.rowCount === 0 || next.rowCount === 0) &&
            (current.viewportWidth !== next.viewportWidth ||
                current.viewportBodyHeight !== next.viewportBodyHeight)) ||
        (current.viewportWidth !== next.viewportWidth && rendersDetail(next))
    );
}

/** Where a cell's element is: a header cell's top row and first column. */
export function elementPosition<TRow, TNode>(
    position: CellPosition,
    header: HeaderLayout<TRow, TNode>,
): CellPosition {
    if (position.rowIndex >= 0) return position;
    const cell = headerCellAt(header, position);
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
): number | undefined {
    if (position.rowIndex >= 0) return position.columnIndex;
    const cell = headerCellAt(header, position);
    if (!cell || cell.columnSpan <= 1) return position.columnIndex;
    // a pinned group is always in view
    if (cell.columnIndex + cell.columnSpan <= pinnedCount) return undefined;
    const end = cell.columnIndex + cell.columnSpan;
    if (overlaps(visibleColumns, cell.columnIndex, end)) {
        return undefined;
    }
    return end <= visibleColumns.start ? end - 1 : cell.columnIndex;
}
