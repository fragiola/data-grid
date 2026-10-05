import { isReorderable } from "../model/order";
import { spanHolds } from "../model/spans";
import type {
    CellPosition,
    HeaderCellLayout,
    PinnedSide,
    ReorderSide,
    SortDirection,
} from "../model/types";
import {
    resizeMaximum,
    type SpanWidths,
    spanResizable,
    spanWidths,
} from "../model/widths";
import { sameCell } from "../navigation/navigation";
import { COLUMN_RESIZER_ATTRIBUTE } from "./dom";
import {
    cellSpan,
    columnLeft,
    columnPinning,
    headerCellSort,
    rowCellsHeight,
    rowDetailBox,
    rowExpanded,
    rowSelectable,
    rowSelected,
    spanInRow,
} from "./geometry";
import type { GridView } from "./types";

// What a part of a view is, as pure functions of a `GridView`: a row's, a cell's, a header cell's
// and a detail's state, with what ARIA says of it beyond the state, and a cell's box. An adapter
// maps them to attributes and style, and adds nothing.

/** The state of a body row: what its `className`/`style` functions and `render` receive. */
export interface RowState {
    readonly rowIndex: number;
    readonly loaded: boolean;
    /** it holds the active cell */
    readonly active: boolean;
    /** it shows its detail (`DataGrid.RowDetail`): loaded, and its key expanded */
    readonly expanded: boolean;
    /** it is selected: rows are selectable, it is loaded and its key selected */
    readonly selected: boolean;
}

/** The state of a body cell. */
export interface CellState {
    readonly rowIndex: number;
    readonly columnIndex: number;
    readonly loaded: boolean;
    /** it is the active cell (the one the keyboard moves) */
    readonly active: boolean;
    /** its column is pinned, at the start or at the end: sticky, it stays in view sideways */
    readonly pinned: boolean;
    /**
     * its column is its pinned part's edge, the last pinned at the start or the first pinned at
     * the end (for a divider or a shadow)
     */
    readonly pinnedEdge: boolean;
    /** where its column is pinned, `undefined` when it scrolls */
    readonly pinnedSide: PinnedSide | undefined;
    /** its controls have the keys (Enter or F2 on it, a click on one; Escape gives them back) */
    readonly interacting: boolean;
}

/** The state of a header cell. */
export interface HeaderCellState {
    /** its (top) header row: -1 for the columns' row; above it for groups and for a column spanning rows */
    readonly rowIndex: number;
    /** its first column */
    readonly columnIndex: number;
    readonly columnSpan: number;
    readonly rowSpan: number;
    /** it is a group's cell */
    readonly group: boolean;
    /** it is the active cell */
    readonly active: boolean;
    /** its column sorts the grid: a click, Enter or Space toggles it (never a group) */
    readonly sortable: boolean;
    /** the direction its column is sorted in, when it is */
    readonly sortDirection: SortDirection | undefined;
    /** its column's place among the sorted columns, 1-based, when it is sorted */
    readonly sortPriority: number | undefined;
    /** its columns are pinned, at the start or at the end: sticky, it stays in view sideways */
    readonly pinned: boolean;
    /**
     * it is its pinned part's edge: it ends at the last column pinned at the start, or starts at
     * the first pinned at the end (for a divider or a shadow)
     */
    readonly pinnedEdge: boolean;
    /** where its columns are pinned, `undefined` when they scroll */
    readonly pinnedSide: PinnedSide | undefined;
    /** its controls have the keys (Enter or F2 on it, a click on one; Escape gives them back) */
    readonly interacting: boolean;
    /** its column is resizable, or for a group one of its columns (a resizer can resize it) */
    readonly resizable: boolean;
    /** a drag is resizing it (its resizer's) */
    readonly resizing: boolean;
    /** its column or group can be moved among its siblings (its drag, Ctrl/⌘+Shift+←/→) */
    readonly reorderable: boolean;
    /** a drag is moving it */
    readonly dragging: boolean;
    /** a drag would drop beside it, on this side (the app draws the indicator); else `null` */
    readonly dropTarget: ReorderSide | null;
}

/** The state of a column resizer: the handle the app renders in a resizable header cell. */
export interface ColumnResizerState {
    /** its header cell's column's or group's key */
    readonly columnKey: string;
    /** its column is resizable, or for a group one of its columns; else it does nothing */
    readonly resizable: boolean;
    /** a drag on it is resizing its column */
    readonly resizing: boolean;
    /** its column's width on screen, or its group's (its columns'), in pixels */
    readonly width: number;
    /** the narrowest it resizes to: each resizable column at its minimum, the others as they are */
    readonly minWidth: number;
    /** the widest it resizes to, or `undefined` when a resizable column has no maximum */
    readonly maxWidth: number | undefined;
    /**
     * the edge of its header cell it moves (Epic #85): `"end"`, the column growing toward the end;
     * `"start"` for columns pinned at the end, whose boundary with the columns that scroll is
     * their start edge, growing toward the start. Place the handle there (`inset-inline-start` or
     * `inset-inline-end`): it follows the pointer
     */
    readonly edge: "start" | "end";
}

/** The state of a row's detail. */
export interface RowDetailState {
    readonly rowIndex: number;
    /** its row is expanded: the detail renders only meanwhile */
    readonly expanded: boolean;
    /** its height: the detail height the grid was given for this row (0 while collapsed) */
    readonly height: number;
}

/** A body row's state, and its `aria-selected`. */
export interface RowPart {
    readonly state: RowState;
    /**
     * `aria-selected` (R7), in ARIA's own vocabulary: `false` is "selectable, not selected"; a row
     * that cannot be selected (or is not loaded) carries none (`undefined`)
     */
    readonly ariaSelected: boolean | undefined;
}

/** A body cell's state, its `tabIndex` and its `aria-colspan`. */
export interface CellPart {
    readonly state: CellState;
    /** the roving tab stop: 0 on the active cell, the grid's tab stop; -1 on the others */
    readonly tabIndex: 0 | -1;
    /**
     * how many columns it spans, when more than one (a column's `colSpan`, E1.2): its
     * `aria-colspan` (and a table cell's `colSpan`); `undefined` for a cell of one column
     */
    readonly ariaColSpan: number | undefined;
}

/** A header cell's state, its `tabIndex` and its `aria-sort`. */
export interface HeaderCellPart {
    readonly state: HeaderCellState;
    /** the roving tab stop, as a body cell's */
    readonly tabIndex: 0 | -1;
    /** on the first sorted column's header cell only (ARIA 1.2: one header at a time) */
    readonly ariaSort: SortDirection | undefined;
}

/**
 * A column resizer's state, its `tabIndex` and its attributes: a vertical separator whose values
 * are widths in pixels, marked with its key for the engine. It has no name: that is the app's
 * (`aria-label`).
 */
export interface ColumnResizerPart {
    readonly state: ColumnResizerState;
    /**
     * a control of its header cell: the grid keeps it at -1 outside interaction, and gives it
     * back (Tab reaches it among the cell's controls)
     */
    readonly tabIndex: 0;
    readonly attributes: {
        readonly role: "separator";
        readonly "aria-orientation": "vertical";
        readonly "aria-valuenow": number;
        readonly "aria-valuemin": number;
        /**
         * its maximum; without one, the wider of its width and the view's (a separator's value
         * always has a maximum: ARIA's default is 100)
         */
        readonly "aria-valuemax": number;
        readonly [COLUMN_RESIZER_ATTRIBUTE]: string;
    };
}

/** A row's detail's state, and its box while its row is expanded (`rowDetailBox`). */
export interface RowDetailPart {
    readonly state: RowDetailState;
    readonly box: ReturnType<typeof rowDetailBox>;
}

/** Whether a cell (at its element's position) is the one whose controls have the keys. */
function interacting<TRow, TNode>(
    view: GridView<TRow, TNode>,
    cell: CellPosition,
): boolean {
    return view.interaction !== null && sameCell(view.interaction, cell);
}

/** A body row's state, and its `aria-selected`. */
export function rowPart<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
    loaded: boolean,
): RowPart {
    const selected = rowSelected(view, rowIndex);
    return {
        state: {
            rowIndex,
            loaded,
            active: view.active?.rowIndex === rowIndex,
            expanded: rowExpanded(view, rowIndex),
            selected,
        },
        ariaSelected:
            selected || rowSelectable(view, rowIndex) ? selected : undefined,
    };
}

/**
 * A body cell's state, its `tabIndex` and its `aria-colspan`: a cell spanning columns (E1.2) is
 * active on any of them.
 */
export function cellPart<TRow, TNode>(
    view: GridView<TRow, TNode>,
    cell: CellPosition & { readonly loaded: boolean },
): CellPart {
    const span = cellSpan(view, cell.rowIndex, cell.columnIndex);
    const { pinned, pinnedEdge, pinnedSide } = columnPinning(
        view,
        cell.columnIndex,
        span,
    );
    const { active: position } = view;
    const active =
        position !== null &&
        (span === 1
            ? sameCell(position, cell)
            : position.rowIndex === cell.rowIndex &&
              spanHolds(
                  { columnIndex: cell.columnIndex, columnSpan: span },
                  position.columnIndex,
              ));
    return {
        state: {
            rowIndex: cell.rowIndex,
            columnIndex: cell.columnIndex,
            loaded: cell.loaded,
            active,
            pinned,
            pinnedEdge,
            pinnedSide,
            interacting: interacting(view, cell),
        },
        tabIndex: active ? 0 : -1,
        ariaColSpan: span > 1 ? span : undefined,
    };
}

/**
 * A body cell's box in its row: its column's left, as wide as its column (a span's columns, E1.2:
 * cut to the rendered ones under scaling, as a header cell's) and as tall as its row's own height
 * (a detail below the cells is not theirs). As `headerCellBox` for a header cell. `span`, when
 * the caller has it (`CellPart.ariaColSpan`), saves its lookup.
 */
export function cellBox<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
    columnIndex: number,
    span = cellSpan(view, rowIndex, columnIndex),
): { readonly left: number; readonly width: number; readonly height: number } {
    const height = rowCellsHeight(view, rowIndex);
    if (span > 1) {
        return { ...spanInRow(view, columnIndex, columnIndex + span), height };
    }
    return {
        left: columnLeft(view, columnIndex),
        width: view.columnAxis.sizeOf(columnIndex),
        height,
    };
}

/**
 * A header cell's state, its `tabIndex` and its `aria-sort`: a column spanning header rows is
 * active on any of them.
 */
export function headerCellPart<TRow, TNode>(
    view: GridView<TRow, TNode>,
    cell: HeaderCellLayout<TRow, TNode>,
): HeaderCellPart {
    const sort = headerCellSort(view, cell);
    const { pinned, pinnedEdge, pinnedSide } = columnPinning(
        view,
        cell.columnIndex,
        cell.columnSpan,
    );
    const active =
        view.active !== null && sameCell(view.active, cell, view.header.cellAt);
    const reorder = view.columnReorder;
    return {
        state: {
            resizable: spanResizable(view.columnDefs, cell),
            resizing: view.columnResize?.columnKey === cell.key,
            reorderable: isReorderable(cell),
            dragging: reorder?.columnKey === cell.key,
            dropTarget: reorder?.targetKey === cell.key ? reorder.side : null,
            rowIndex: cell.rowIndex,
            columnIndex: cell.columnIndex,
            columnSpan: cell.columnSpan,
            rowSpan: cell.rowSpan,
            group: cell.group !== undefined,
            active,
            sortable: sort.sortable,
            sortDirection: sort.direction,
            sortPriority: sort.priority,
            pinned,
            pinnedEdge,
            pinnedSide,
            interacting: interacting(view, cell),
        },
        tabIndex: active ? 0 : -1,
        ariaSort: sort.ariaSort,
    };
}

/**
 * The state and attributes of the resizer in a header cell (W3): its column's, or for a group's
 * cell its columns' together (W5).
 */
export function columnResizerPart<TRow, TNode>(
    view: GridView<TRow, TNode>,
    cell: HeaderCellLayout<TRow, TNode>,
): ColumnResizerPart {
    const resizable = spanResizable(view.columnDefs, cell);
    const axis = view.columnAxis;
    // a cell whose columns do not resize is its width, with nothing to move within
    const fixed =
        axis.offsetOf(cell.columnIndex + cell.columnSpan) -
        axis.offsetOf(cell.columnIndex);
    const span: SpanWidths = resizable
        ? spanWidths(view.columnDefs, axis, cell)
        : { width: fixed, minWidth: fixed, maxWidth: fixed };
    const { width, minWidth, maxWidth } = span;
    const { pinnedSide } = columnPinning(
        view,
        cell.columnIndex,
        cell.columnSpan,
    );
    return {
        state: {
            columnKey: cell.key,
            resizable,
            resizing: view.columnResize?.columnKey === cell.key,
            width,
            minWidth,
            maxWidth,
            edge: pinnedSide === "end" ? "start" : "end",
        },
        tabIndex: 0,
        attributes: {
            role: "separator",
            "aria-orientation": "vertical",
            "aria-valuenow": width,
            "aria-valuemin": minWidth,
            "aria-valuemax": resizeMaximum(span, view.viewportWidth),
            [COLUMN_RESIZER_ATTRIBUTE]: cell.key,
        },
    };
}

/** A row's detail's state (0 tall while collapsed), and its box while its row is expanded. */
export function rowDetailPart<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): RowDetailPart {
    const box = rowDetailBox(view, rowIndex);
    return {
        state: { rowIndex, expanded: box !== null, height: box?.height ?? 0 },
        box,
    };
}
