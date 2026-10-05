import type { Axis } from "../axis/axis";
import { columnPart, pinnedEndFrom } from "../header/header";
import { holdsRow } from "../model/expansion";
import { isRowSelectable, isRowSelected } from "../model/selection";
import type {
    GridDirection,
    HeaderCellLayout,
    PinnedSide,
    SortDirection,
    SummaryPosition,
    SummaryRowCounts,
} from "../model/types";
import { rowLine } from "../navigation/navigation";
import { overlaps } from "../viewport/window";
import type { GridView } from "./types";

// Where the parts of a view go and what they say, as pure functions of a `GridView`: rows' and
// cells' boxes, pinned columns, details, ARIA and a header cell's sort. An adapter renders with
// them; the engine writes pinned cells' insets with `pinnedInset`.
//
// Every offset counts from the view's inline start (E1.1): its left edge, or in a right-to-left
// grid its right edge, where an adapter places by `right` (`inlineStart`) and the engine mirrors
// what it reads and writes. Nothing here depends on the direction but that side.

/** The physical side a view's offsets count from: its inline start, the right edge in RTL. */
export function inlineStart(direction: GridDirection): "left" | "right" {
    return direction === "rtl" ? "right" : "left";
}

/**
 * -1 right to left, where a physical x (a scroll, a pointer's move, a transform) is an inline one
 * mirrored; 1 left to right.
 */
export function inlineSign(direction: GridDirection): 1 | -1 {
    return direction === "rtl" ? -1 : 1;
}

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

/** Whether a view has pinned columns, at either end. */
function hasPinned<TRow, TNode>(view: GridView<TRow, TNode>): boolean {
    return view.pinnedColumnCount > 0 || view.pinnedEndColumnCount > 0;
}

/** The width of the rendered columns that scroll: from the base to their end. */
function renderedColumnsWidth<TRow, TNode>(
    view: GridView<TRow, TNode>,
): number {
    return Math.max(
        0,
        view.columnAxis.offsetOf(view.renderedColumns.end) - view.columnBase,
    );
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
    if (!hasPinned(view)) return 0;
    return -(
        view.pinnedWidth +
        view.pinnedEndWidth +
        renderedColumnsWidth(view)
    );
}

/**
 * A row's structural `display` (a header row's too): with pinned columns, `flex`, so the pinned
 * cells (in its flow, sticky) stack by their widths; nothing without, a row is then as it was.
 */
export function rowDisplay<TRow, TNode>(
    view: GridView<TRow, TNode>,
): "flex" | undefined {
    return hasPinned(view) ? "flex" : undefined;
}

/**
 * Whether columns `columnIndex` to `columnIndex + columnSpan` (a cell, a header cell's span) are
 * pinned, where (`pinnedSide`), and whether they are the pinned part's edge: they end at the last
 * column pinned at the start, or start at the first pinned at the end.
 */
export function columnPinning<TRow, TNode>(
    view: GridView<TRow, TNode>,
    columnIndex: number,
    columnSpan = 1,
): {
    readonly pinned: boolean;
    readonly pinnedEdge: boolean;
    readonly pinnedSide: PinnedSide | undefined;
} {
    const endFrom = endPartFrom(view);
    // a span never crosses its part (E1.2): its first column tells it
    const pinnedSide = columnPart(columnIndex, view.pinnedColumnCount, endFrom);
    return {
        pinned: pinnedSide !== undefined,
        pinnedEdge:
            pinnedSide === "start"
                ? columnIndex + columnSpan === view.pinnedColumnCount
                : pinnedSide === "end" && columnIndex === endFrom,
        pinnedSide,
    };
}

/** The first column pinned at the end in effect in a view (`pinnedEndFrom`): its column count without. */
export function endPartFrom<TRow, TNode>(view: GridView<TRow, TNode>): number {
    return pinnedEndFrom(view.columnCount, view.pinnedEndColumnCount);
}

/**
 * The edge of a header cell a resize moves (E1.1), by its column's part (`columnPart`): a column
 * pinned at the end grows from its start edge (toward the start), every other one from its end.
 * What the engine's drag and keys and a resizer's state both read.
 */
export function resizeEdge(part: PinnedSide | undefined): "start" | "end" {
    return part === "end" ? "start" : "end";
}

/**
 * A pinned cell's sticky inline start inset: its column's offset less the layers' horizontal
 * offset `layerX` (what they are translated by), plus `endShift` for a column pinned at the end
 * (`pinnedEndShift`). The browser resolves sticky in layout, before the transform, against the
 * scrolled view: the cell shows at its offset from the view's start whatever the scroll, on every
 * painted frame. Unscaled, `layerX` is the view's `columnBase`.
 */
export function pinnedInset(
    columnAxis: Axis,
    columnIndex: number,
    layerX: number,
    endShift = 0,
): number {
    return columnAxis.offsetOf(columnIndex) - layerX + endShift;
}

/**
 * How far a column pinned at the end shows from its offset: from the columns' end back to the
 * view's end, a view `viewportWidth` wide (0 while the columns fit in it: they show where they
 * are).
 */
export function pinnedEndShift(
    columnAxis: Axis,
    viewportWidth: number,
): number {
    return Math.min(viewportWidth, columnAxis.totalSize) - columnAxis.totalSize;
}

/**
 * Where something at virtual `offset` sits in its row, after the row's start (`rowLeft`): a
 * column that scrolls, from the base. A pinned one is in the row's flow and the engine's sticky
 * inset places it (its box follows the scroll): it reports its place in a body row's flow, where
 * every pinned column is rendered in order, the ones pinned at the end after the others.
 */
function leftInRow<TRow, TNode>(
    view: GridView<TRow, TNode>,
    offset: number,
    pinned: PinnedSide | undefined,
): number {
    if (pinned === "start") return offset;
    if (pinned === "end") {
        return (
            view.pinnedWidth +
            offset -
            view.columnAxis.offsetOf(endPartFrom(view))
        );
    }
    return offset - view.columnBase - rowLeft(view);
}

/** A column's left in its row (the same in the header rows and in every row). */
export function columnLeft<TRow, TNode>(
    view: GridView<TRow, TNode>,
    columnIndex: number,
): number {
    return leftInRow(
        view,
        view.columnAxis.offsetOf(columnIndex),
        columnPinning(view, columnIndex).pinnedSide,
    );
}

/**
 * The width of a row's rendered cells: from the row's start (`rowLeft`) to the last rendered
 * column's end that scrolls. With columns pinned at the end, then room for them as far again as
 * the rendered columns: sticky holds them at the view's end through a scroll not rendered yet.
 */
export function renderedWidth<TRow, TNode>(
    view: GridView<TRow, TNode>,
): number {
    const endCount = view.pinnedEndColumnCount;
    const last = view.columns[view.columns.length - 1 - endCount];
    if (endCount === 0) {
        return last === undefined
            ? 0
            : leftInRow(view, view.columnAxis.offsetOf(last + 1), undefined);
    }
    // the last column that scrolls, else (none rendered: every column pinned) where they would
    // start, then the end part's room
    const end =
        last !== undefined && last >= view.pinnedColumnCount
            ? last + 1
            : view.renderedColumns.end;
    return (
        leftInRow(view, view.columnAxis.offsetOf(end), undefined) +
        view.pinnedEndWidth +
        renderedColumnsWidth(view)
    );
}

/**
 * Where columns `from` to `to` (a cell's span) are in their row: the first one's left (as
 * `columnLeft`), and as wide as they are. When the columns' scroll is scaled, a span can be wider
 * than a browser lays out: it is then cut to the rendered columns (they reach past the view).
 */
export function spanInRow<TRow, TNode>(
    view: GridView<TRow, TNode>,
    from: number,
    to: number,
): { readonly left: number; readonly width: number } {
    const axis = view.columnAxis;
    let start = axis.offsetOf(from);
    let end = axis.offsetOf(to);
    const { pinned, pinnedSide } = columnPinning(view, from, to - from);
    // a pinned span is always whole: its columns are all rendered
    if (axis.totalSize > view.width && !pinned) {
        // the rendered columns it reaches into, or the active column it is rendered for (the
        // only column rendered outside them)
        const rendered = view.renderedColumns;
        const reaches = overlaps(rendered, from, to);
        const activeIndex = view.active?.columnIndex;
        const extra =
            activeIndex !== undefined &&
            !overlaps(rendered, activeIndex, activeIndex + 1) &&
            activeIndex >= from &&
            activeIndex < to
                ? activeIndex
                : undefined;
        const clipFrom = reaches ? rendered.start : (extra ?? from);
        const clipTo = reaches ? rendered.end : (extra ?? from) + 1;
        start = Math.max(start, axis.offsetOf(clipFrom));
        end = Math.min(end, axis.offsetOf(clipTo));
    }
    return {
        left: leftInRow(view, start, pinnedSide),
        width: Math.max(0, end - start),
    };
}

/**
 * A header cell's box in the header layer: its row's top, its first column's left, as wide as its
 * columns (cut to the rendered ones under scaling, `spanInRow`) and as tall as its rows.
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
    const { left, width } = spanInRow(
        view,
        cell.columnIndex,
        cell.columnIndex + cell.columnSpan,
    );
    return {
        top: (cell.rowIndex + view.headerRowCount) * view.headerRowHeight,
        // in its header row, as `columnLeft`
        left,
        width,
        height: cell.rowSpan * view.headerRowHeight,
    };
}

/**
 * The columns a body row renders cells at (E1.2): the view's `columns`, less the ones its spans
 * cover, with a span reaching into them from a column not rendered.
 */
export function rowColumns<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): readonly number[] {
    return view.rowSpans?.get(rowIndex)?.columns ?? view.columns;
}

/** How many columns a body cell spans (E1.2): 1 unless its column's `colSpan` says more for its row. */
export function cellSpan<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
    columnIndex: number,
): number {
    return view.rowSpans?.get(rowIndex)?.spans.get(columnIndex) ?? 1;
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
 * the row's start, before the pinned cells in its flow (−their width, at both ends, 0 without), so
 * that inset can reach the view's start from wherever the row is scrolled. `null` while the row is collapsed.
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
    const pinned = view.pinnedWidth + view.pinnedEndWidth;
    return {
        top: rowCellsHeight(view, rowIndex),
        start: pinned > 0 ? -pinned : 0,
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
    return Math.max(width, leftInRow(view, view.viewportWidth, undefined));
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

/** The grid's `aria-rowcount`: the header rows, every body row and the summary rows. */
export function ariaRowCount<TRow, TNode>(view: GridView<TRow, TNode>): number {
    const { top, bottom } = view.summaryRows;
    return view.rowCount + view.headerRowCount + top + bottom;
}

/**
 * A row's `aria-rowindex`: 1-based, top to bottom (`rowLine`): the header rows first (they are
 * -depth … -1), then the top summary rows, the body rows and the bottom summary rows (E2.1).
 */
export function ariaRowIndex<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): number {
    const { top } = view.summaryRows;
    return (
        rowLine(rowIndex, view.header.depth, top) +
        view.headerRowCount +
        top +
        1
    );
}

/**
 * How tall a position's summary rows are together (0 without): a view's, or a state's (the
 * engine's body is the view less them).
 */
export function summaryHeight(
    grid: {
        readonly summaryRows: SummaryRowCounts;
        readonly summaryRowHeight: number;
    },
    position: SummaryPosition,
): number {
    return grid.summaryRows[position] * grid.summaryRowHeight;
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
     * `aria-sort`, on the first sorted column with a header cell of its own (ARIA 1.2: one header
     * at a time; a column a collapsed group hides or a header span covers holds none, and may
     * hold priority 1)
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
    // `aria-sort` on the first sorted column with a header cell of its own: one a collapsed
    // group hides (E1.3) or a header span covers (E1.2) still sorts, and keeps its priority
    const first =
        sorted &&
        view.sortColumns.find((entry) => {
            const own = view.header.cellByKey(entry.columnKey);
            return (
                own !== undefined &&
                view.header.cellAt(own.rowIndex, own.columnIndex) === own
            );
        });
    return {
        sortable: column?.sortable === true,
        direction: sorted?.direction,
        priority: sorted ? index + 1 : undefined,
        ariaSort: first === sorted ? sorted?.direction : undefined,
    };
}
