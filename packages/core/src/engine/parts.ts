import { isReorderable } from "../model/order";
import { rowSelectableWith, rowSelectedWith } from "../model/selection";
import {
    dataRowAt,
    depthOf,
    groupExpanded,
    groupKeyAt,
    rowKeyOf,
    rowMetaAt,
} from "../model/source";
import { activeInCell } from "../model/spans";
import type {
    CellPosition,
    DataGridState,
    GroupRow,
    HeaderCellLayout,
    PinnedSide,
    ReorderSide,
    RowKey,
    SortColumn,
    SortDirection,
    SummaryPosition,
    SummaryRowView,
} from "../model/types";
import {
    resizeMaximum,
    type SpanWidths,
    spanResizable,
    spanWidths,
} from "../model/widths";
import { sameCell } from "../navigation/navigation";
import { keySet } from "../utils";
import {
    COLUMN_RESIZER_ATTRIBUTE,
    GROUP_TOGGLE_ATTRIBUTE,
    ROW_DRAG_HANDLE_ATTRIBUTE,
} from "./dom";
import {
    cellSpan,
    columnLeft,
    columnPinning,
    headerCellSort,
    resizeEdge,
    rowCellsHeight,
    rowDetailBox,
    rowExpanded,
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
    /**
     * a drag is moving it (its handle's, Epic #86, E2.3); `undefined` while the grid's rows do not
     * move (`reorderableRows` off)
     */
    readonly dragging: boolean | undefined;
    /**
     * a drag would drop its row beside it, on this side (the app draws the indicator); else
     * `null`; `undefined` while the grid's rows do not move
     */
    readonly dropTarget: ReorderSide | null | undefined;
    /**
     * its depth in the grid's tree (Epic #87): 0 at the top; `undefined` while the grid's rows
     * have no kinds (`getRowMeta`)
     */
    readonly depth: number | undefined;
    /** its group, a group row's (Epic #87); `undefined` for a data row */
    readonly group: GroupRow | undefined;
    /**
     * a row heading a row group (a group row, a row that expands): whether it shows its rows;
     * `undefined` for a row that does not expand
     */
    readonly groupExpanded: boolean | undefined;
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

/** The state of a summary row (Epic #86, E2.1). */
export interface SummaryRowState {
    readonly rowIndex: number;
    /** under the header (`"top"`), or at the view's bottom edge (`"bottom"`) */
    readonly position: SummaryPosition;
    /** its index among its position's rows, the first one 0 */
    readonly summaryIndex: number;
    /** it holds the active cell */
    readonly active: boolean;
}

/**
 * The state of a summary row's cell: a body cell's (`loaded` always true: a summary row has no
 * data to wait for), and its row's position and index.
 */
export interface SummaryCellState extends CellState {
    readonly position: SummaryPosition;
    readonly summaryIndex: number;
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
    /**
     * a collapsible group's (Epic #85, E1.3): whether it is collapsed (`column-groups.toggle`
     * opens and closes it); `undefined` for a header cell that does not collapse
     */
    readonly collapsed: boolean | undefined;
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

/** The state of a row's drag handle (Epic #86, E2.3): the element the app renders in its row. */
export interface RowDragHandleState {
    readonly rowIndex: number;
    /**
     * a press on it drags its row: the grid's rows move (`reorderableRows`), the grid is not
     * sorted and the row is loaded; else it does nothing (render it disabled, or none)
     */
    readonly reorderable: boolean;
    /** a drag on it is moving its row */
    readonly dragging: boolean;
}

/**
 * The state of a row group's toggle (Epic #87): the control the app renders in a group row (or a
 * row that expands), which expands and collapses it.
 */
export interface GroupToggleState {
    readonly rowIndex: number;
    /** the key it expands by (a group row's group key, a row's own key), `undefined` when it does not */
    readonly groupKey: RowKey | undefined;
    /** its row expands: a click on it toggles; else it does nothing (render none) */
    readonly expandable: boolean;
    /** its row shows its rows */
    readonly expanded: boolean;
    /** its row's depth, 0 at the top */
    readonly depth: number;
}

/** The state of a row's detail. */
export interface RowDetailState {
    readonly rowIndex: number;
    /** its row is expanded: the detail renders only meanwhile */
    readonly expanded: boolean;
    /** its height: the detail height the grid was given for this row (0 while collapsed) */
    readonly height: number;
}

/** A body row's state, its `aria-selected` and its tree's ARIA. */
export interface RowPart {
    readonly state: RowState;
    /**
     * `aria-selected` (R7), in ARIA's own vocabulary: `false` is "selectable, not selected"; a row
     * that cannot be selected (or is not loaded) carries none (`undefined`)
     */
    readonly ariaSelected: boolean | undefined;
    /**
     * a `treegrid`'s row ARIA (Epic #87): its level, whether it is expanded (a row that expands),
     * its set's size and its place in it (when its meta says); `undefined` without row kinds
     */
    readonly ariaTree: AriaTreeRow | undefined;
}

/** A `treegrid` row's ARIA (Epic #87): `aria-level` always, the rest when they apply. */
export interface AriaTreeRow {
    readonly "aria-level": number;
    readonly "aria-expanded"?: boolean;
    readonly "aria-setsize"?: number;
    readonly "aria-posinset"?: number;
}

/** A row group's toggle's state and its attributes (Epic #87): marked with its row's index. */
export interface GroupTogglePart {
    readonly state: GroupToggleState;
    /** `undefined` for a row that does not expand: render no toggle */
    readonly attributes:
        | {
              readonly "aria-expanded": boolean;
              readonly [GROUP_TOGGLE_ATTRIBUTE]: number;
          }
        | undefined;
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

/** A summary row's cell's state, its `tabIndex` and its `aria-colspan` (as a body cell's). */
export interface SummaryCellPart extends Omit<CellPart, "state"> {
    readonly state: SummaryCellState;
}

/** A header cell's state, its `tabIndex` and its `aria-sort`. */
export interface HeaderCellPart {
    readonly state: HeaderCellState;
    /** the roving tab stop, as a body cell's */
    readonly tabIndex: 0 | -1;
    /** on the first sorted column with a header cell of its own (ARIA 1.2: one header at a time) */
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

/**
 * A row's drag handle's state and its attributes: marked with its row's index for the engine, and
 * hidden from assistive technologies (a pointer's way to move the row: the keys move it from its
 * cells, Ctrl/⌘+Shift+↑/↓).
 */
export interface RowDragHandlePart {
    readonly state: RowDragHandleState;
    readonly attributes: {
        readonly "aria-hidden": true;
        readonly [ROW_DRAG_HANDLE_ATTRIBUTE]: number;
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
    const reorder = view.rowReorder;
    const moves = view.reorderableRows;
    // the row read once (Epic #87: its kind, nothing asked of a grid without them)
    const tree = view.source.getRowMeta !== undefined;
    const meta = tree ? rowMetaAt(view.source, rowIndex) : undefined;
    // its data row, only when the selection or its key needs it
    const row =
        view.rowSelection || meta?.expandable
            ? dataRowAt(view.source, rowIndex, meta)
            : undefined;
    const selected = rowSelectedWith(view, rowIndex, meta, row);
    const groupKey = meta?.group
        ? meta.group.key
        : meta?.expandable
          ? rowKeyOf(view, rowIndex, meta, row)
          : undefined;
    const expanded =
        groupKey === undefined ? undefined : groupExpanded(view, groupKey);
    const depth = tree ? depthOf(meta) : undefined;
    return {
        state: {
            rowIndex,
            loaded,
            active: view.active?.rowIndex === rowIndex,
            expanded: rowExpanded(view, rowIndex),
            selected,
            dragging: moves ? reorder?.rowIndex === rowIndex : undefined,
            dropTarget: moves
                ? reorder?.targetIndex === rowIndex
                    ? reorder.side
                    : null
                : undefined,
            depth,
            group: meta?.group,
            groupExpanded: expanded,
        },
        ariaSelected:
            selected || rowSelectableWith(view, rowIndex, meta, row)
                ? selected
                : undefined,
        ariaTree:
            depth === undefined
                ? undefined
                : {
                      "aria-level": depth + 1,
                      ...(expanded === undefined
                          ? {}
                          : { "aria-expanded": expanded }),
                      ...(meta?.setSize === undefined
                          ? {}
                          : { "aria-setsize": meta.setSize }),
                      ...(meta?.posInSet === undefined
                          ? {}
                          : { "aria-posinset": meta.posInSet }),
                  },
    };
}

/**
 * A row group's toggle (Epic #87): whether its row expands and is expanded, and the attributes
 * that mark it for the engine (a click on it runs `row-groups.toggle`) with its `aria-expanded`.
 */
export function groupTogglePart<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): GroupTogglePart {
    const meta = rowMetaAt(view.source, rowIndex);
    const groupKey = groupKeyAt(view, rowIndex, meta);
    const expanded = groupExpanded(view, groupKey);
    return {
        state: {
            rowIndex,
            groupKey,
            expandable: groupKey !== undefined,
            expanded,
            depth: depthOf(meta),
        },
        attributes:
            groupKey === undefined
                ? undefined
                : {
                      "aria-expanded": expanded,
                      [GROUP_TOGGLE_ATTRIBUTE]: rowIndex,
                  },
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
    const active = activeInCell(
        view.active,
        cell.rowIndex,
        cell.columnIndex,
        span,
    );
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
 * (a detail below the cells is not theirs; a summary row's cell passes its row's, `height`). As
 * `headerCellBox` for a header cell. `span`, when the caller has it (`CellPart.ariaColSpan`),
 * saves its lookup.
 */
export function cellBox<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
    columnIndex: number,
    span = cellSpan(view, rowIndex, columnIndex),
    height = rowCellsHeight(view, rowIndex),
): { readonly left: number; readonly width: number; readonly height: number } {
    if (span > 1) {
        return { ...spanInRow(view, columnIndex, columnIndex + span), height };
    }
    return {
        left: columnLeft(view, columnIndex),
        width: view.columnAxis.sizeOf(columnIndex),
        height,
    };
}

/** A summary row's state (E2.1). */
export function summaryRowPart<TRow, TNode>(
    view: GridView<TRow, TNode>,
    row: SummaryRowView,
): { readonly state: SummaryRowState } {
    return {
        state: {
            rowIndex: row.rowIndex,
            position: row.position,
            summaryIndex: row.summaryIndex,
            active: view.active?.rowIndex === row.rowIndex,
        },
    };
}

/**
 * A summary row's cell's state, its `tabIndex` and its `aria-colspan` (E2.1): a body cell's
 * (`cellPart`), on its summary row.
 */
export function summaryCellPart<TRow, TNode>(
    view: GridView<TRow, TNode>,
    cell: CellPosition & {
        readonly position: SummaryPosition;
        readonly summaryIndex: number;
    },
): SummaryCellPart {
    const part = cellPart(view, {
        rowIndex: cell.rowIndex,
        columnIndex: cell.columnIndex,
        loaded: true,
    });
    return {
        ...part,
        state: {
            ...part.state,
            position: cell.position,
            summaryIndex: cell.summaryIndex,
        },
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
            collapsed:
                cell.group?.collapsible === true
                    ? keySet(view.collapsedGroupKeys).has(cell.key)
                    : undefined,
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
            edge: resizeEdge(pinnedSide),
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

/**
 * Whether a grid's rows move now (E2.3): they move (`reorderableRows`), the grid is not sorted
 * (sorted, the app orders them its own way: a move would not stay where it was dropped) and its
 * rows have no kinds (Epic #87: grouped, a row's place is its group's; moving rows between groups
 * is the app's).
 */
export function rowsMove(
    reorderableRows: boolean | undefined,
    grid: {
        readonly sortColumns: readonly SortColumn[];
        readonly source: DataGridState<unknown>["source"];
    },
): boolean {
    return (
        reorderableRows === true &&
        grid.sortColumns.length === 0 &&
        grid.source.getRowMeta === undefined
    );
}

/**
 * A row's drag handle's state and attributes (E2.3): it drags its row while rows move
 * (`rowsMove`) and the row is loaded.
 */
export function rowDragHandlePart<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
    loaded: boolean,
): RowDragHandlePart {
    return {
        state: {
            rowIndex,
            reorderable: loaded && rowsMove(view.reorderableRows, view),
            dragging: view.rowReorder?.rowIndex === rowIndex,
        },
        attributes: {
            "aria-hidden": true,
            [ROW_DRAG_HANDLE_ATTRIBUTE]: rowIndex,
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
