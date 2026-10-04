import type { Axis } from "../axis/axis";
import { holdsRow } from "../model/expansion";
import { isRowSelectable, isRowSelected } from "../model/selection";
import type { HeaderCellLayout, SortDirection } from "../model/types";
import { overlaps } from "../viewport/window";
import type { GridView } from "./types";

// Where the parts of a view go and what they say, as pure functions of a `GridView`: rows' and
// cells' boxes, pinned columns, details, ARIA and a header cell's sort. An adapter renders with
// them; the engine writes pinned cells' insets with `pinnedInset`.

/** An item's own size, without its extra (a row's cells, without its detail). */
export function cellsSizeOf(axis: Axis, index: number): number {
    return axis.sizeOf(index) - axis.extraSizeOf(index);
}

/** A body row's top in its layer. */
export function rowTop<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): number {
    return view.rowAxis.offsetOf(rowIndex) - view.rowBase;
}

/**
 * A row's left in its layer (a header row's too). With pinned columns, it starts their width and
 * the rendered columns' width (at least the view's width less theirs) before the layer, so its
 * box holds them where the browser keeps them (a row's background, its hover), and sticky, which
 * keeps a cell inside its row, holds them in place through a scroll the engine has not rendered
 * yet (the frame a browser paints before the `scroll` event), to the left as far as to the right.
 * It moves only with the rendered columns. 0 without.
 */
export function rowLeft<TRow, TNode>(view: GridView<TRow, TNode>): number {
    if (view.pinnedColumnCount === 0) return 0;
    const rendered =
        view.columnAxis.offsetOf(view.renderedColumns.end) - view.columnBase;
    return -(view.pinnedWidth + Math.max(0, rendered));
}

/**
 * A row's structural `display` (a header row's too): with pinned columns, `flex`, so the pinned
 * cells (in its flow, sticky) stack by their widths; nothing without, a row is then as it was.
 */
export function rowDisplay<TRow, TNode>(
    view: GridView<TRow, TNode>,
): "flex" | undefined {
    return view.pinnedColumnCount > 0 ? "flex" : undefined;
}

/**
 * Whether columns `columnIndex` to `columnIndex + columnSpan` (a cell, a header cell's span) are
 * pinned, and whether they end at the last pinned column (its edge).
 */
export function columnPinning<TRow, TNode>(
    view: GridView<TRow, TNode>,
    columnIndex: number,
    columnSpan = 1,
): { readonly pinned: boolean; readonly pinnedEdge: boolean } {
    const end = columnIndex + columnSpan;
    const pinned = end <= view.pinnedColumnCount;
    return { pinned, pinnedEdge: pinned && end === view.pinnedColumnCount };
}

/**
 * A pinned cell's sticky `left` inset: its column's offset less the layers' horizontal offset
 * `layerX` (what they are translated by). The browser resolves sticky in layout, before the
 * transform, against the scrolled view: the cell shows at its offset from the view's start
 * whatever the scroll, on every painted frame. Unscaled, `layerX` is the view's `columnBase`.
 */
export function pinnedInset(
    columnAxis: Axis,
    columnIndex: number,
    layerX: number,
): number {
    return columnAxis.offsetOf(columnIndex) - layerX;
}

/**
 * Where something at virtual `offset` sits in its row, after the row's start (`rowLeft`): a
 * column that scrolls, from the base. A pinned one is in the row's flow and the engine's sticky
 * inset places it (its box follows the scroll): it reports its column's offset, which is its
 * place in a body row's flow (every pinned column is rendered there, in order).
 */
function leftInRow<TRow, TNode>(
    view: GridView<TRow, TNode>,
    offset: number,
    pinned: boolean,
): number {
    return pinned ? offset : offset - view.columnBase - rowLeft(view);
}

/** A column's left in its row (the same in the header rows and in every row). */
export function columnLeft<TRow, TNode>(
    view: GridView<TRow, TNode>,
    columnIndex: number,
): number {
    return leftInRow(
        view,
        view.columnAxis.offsetOf(columnIndex),
        columnPinning(view, columnIndex).pinned,
    );
}

/**
 * The width of a row's rendered cells: from the row's start (`rowLeft`) to the last rendered
 * column's end.
 */
export function renderedWidth<TRow, TNode>(
    view: GridView<TRow, TNode>,
): number {
    const last = view.columns[view.columns.length - 1];
    if (last === undefined) return 0;
    return leftInRow(view, view.columnAxis.offsetOf(last + 1), false);
}

/**
 * A header cell's box in the header layer: its row's top, its first column's left, as wide as its
 * columns and as tall as its rows. When the columns' scroll is scaled, a group can be wider than a
 * browser lays out: its box is then cut to the rendered columns (they reach past the view).
 */
export function headerCellBox<TRow, TNode>(
    view: GridView<TRow, TNode>,
    cell: HeaderCellLayout<TRow, TNode>,
): {
    readonly top: number;
    readonly left: number;
    readonly width: number;
    readonly height: number;
} {
    const axis = view.columnAxis;
    const from = cell.columnIndex;
    const to = cell.columnIndex + cell.columnSpan;
    let start = axis.offsetOf(from);
    let end = axis.offsetOf(to);
    const { pinned } = columnPinning(view, from, cell.columnSpan);
    // a pinned cell is always whole: its columns are all rendered
    if (axis.totalSize > view.width && !pinned) {
        // the rendered columns it reaches into, or the active column it is rendered for
        const rendered = view.renderedColumns;
        const reaches = overlaps(rendered, from, to);
        const extra = view.columns.find(
            (c) =>
                (c < rendered.start || c >= rendered.end) &&
                c >= from &&
                c < to,
        );
        const clipFrom = reaches ? rendered.start : (extra ?? from);
        const clipTo = reaches ? rendered.end : (extra ?? from) + 1;
        start = Math.max(start, axis.offsetOf(clipFrom));
        end = Math.min(end, axis.offsetOf(clipTo));
    }
    return {
        top: (cell.rowIndex + view.headerRowCount) * view.headerRowHeight,
        // in its header row, as `columnLeft`
        left: leftInRow(view, start, pinned),
        width: Math.max(0, end - start),
        height: cell.rowSpan * view.headerRowHeight,
    };
}

/** A header cell's `aria-colspan` and `aria-rowspan`, each only when it spans more than one. */
export function ariaHeaderCellSpans(cell: {
    readonly columnSpan: number;
    readonly rowSpan: number;
}): { readonly "aria-colspan"?: number; readonly "aria-rowspan"?: number } {
    return {
        ...(cell.columnSpan > 1 ? { "aria-colspan": cell.columnSpan } : {}),
        ...(cell.rowSpan > 1 ? { "aria-rowspan": cell.rowSpan } : {}),
    };
}

/** Whether a row shows its detail (M1): loaded, and its key expanded. */
export function rowExpanded<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): boolean {
    return holdsRow(view.expandedRows, rowIndex);
}

/** Whether a row is selected (R7): rows are selectable, it is loaded and its key selected. */
export function rowSelected<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): boolean {
    return isRowSelected(view, rowIndex);
}

/** Whether a row can be selected (R7): rows are selectable, it is loaded and not refused. */
export function rowSelectable<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): boolean {
    return isRowSelectable(view, rowIndex);
}

/** A row's own height: its cells', without its detail. */
export function rowCellsHeight<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): number {
    return cellsSizeOf(view.rowAxis, rowIndex);
}

/**
 * An expanded row's detail area in its row (M3): below its cells (`top`, its place in the row's
 * flow), as tall as its detail and as wide as the visible area. Sticky in the flow, it is held at
 * the view's start by the inset the engine writes (the `detail` layer); `start` moves its box to
 * the row's start, before the pinned cells (−their width, 0 without), so that inset can reach the
 * view's start from wherever the row is scrolled. `null` while the row is collapsed.
 */
export function rowDetailBox<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): {
    readonly top: number;
    readonly start: number;
    readonly width: number;
    readonly height: number;
} | null {
    if (!rowExpanded(view, rowIndex)) return null;
    return {
        top: rowCellsHeight(view, rowIndex),
        start: view.pinnedWidth > 0 ? -view.pinnedWidth : 0,
        width: view.viewportWidth,
        height: view.rowAxis.extraSizeOf(rowIndex),
    };
}

/**
 * A body row's width: its rendered cells' (`renderedWidth`), and for an expanded row at least
 * what holds its detail at the view's start, as wide as the view (sticky keeps an element inside
 * its row): in a grid narrower than the view, the row reaches the view's end.
 */
export function rowWidth<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): number {
    const width = renderedWidth(view);
    if (!rowExpanded(view, rowIndex)) return width;
    return Math.max(width, leftInRow(view, view.viewportWidth, false));
}

/**
 * A detail's ARIA (M4): one cell of its row spanning every column, so expanding a row changes no
 * row count or index.
 */
export function ariaRowDetail<TRow, TNode>(
    view: GridView<TRow, TNode>,
): { readonly "aria-colindex": number; readonly "aria-colspan"?: number } {
    return {
        "aria-colindex": 1,
        ...(view.columnCount > 1 ? { "aria-colspan": view.columnCount } : {}),
    };
}

/** The grid's `aria-rowcount`: the header rows and every body row. */
export function ariaRowCount<TRow, TNode>(view: GridView<TRow, TNode>): number {
    return view.rowCount + view.headerRowCount;
}

/** A row's `aria-rowindex`: 1-based, the header rows first (they are -depth … -1). */
export function ariaRowIndex<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): number {
    return rowIndex + view.headerRowCount + 1;
}

/** A header cell's sort, as the adapters show it (S6). */
export interface HeaderCellSort {
    /** its column sorts the grid (never a group) */
    readonly sortable: boolean;
    /** the direction its column is sorted in, when it is */
    readonly direction: SortDirection | undefined;
    /** its column's place among the sorted columns, 1-based, when it is sorted */
    readonly priority: number | undefined;
    /**
     * `aria-sort`, on the first sorted column's header cell only (ARIA 1.2: one header at a time)
     */
    readonly ariaSort: SortDirection | undefined;
}

/** How a header cell shows the sort: sortable, and its direction and priority when sorted. */
export function headerCellSort<TRow, TNode>(
    view: GridView<TRow, TNode>,
    cell: HeaderCellLayout<TRow, TNode>,
): HeaderCellSort {
    const column = cell.column;
    const index = column
        ? view.sortColumns.findIndex((entry) => entry.columnKey === column.key)
        : -1;
    const sorted = view.sortColumns[index];
    return {
        sortable: column?.sortable === true,
        direction: sorted?.direction,
        priority: sorted ? index + 1 : undefined,
        ariaSort: index === 0 ? sorted?.direction : undefined,
    };
}
