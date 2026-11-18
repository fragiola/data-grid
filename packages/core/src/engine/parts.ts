import type { PartAttributes } from "../feature/feature";
import { activeInCell } from "../model/bounds";
import { depthOf, rowMetaAt } from "../model/source";
import type {
    CellPosition,
    GroupRow,
    HeaderCellLayout,
    PinnedSide,
    ReorderSide,
    RowMeta,
    SummaryPosition,
} from "../model/types";
import { sameCell } from "../navigation/navigation";
import type { COLUMN_RESIZER_ATTRIBUTE } from "./dom";
import {
    cellSpan,
    columnLeft,
    columnPinning,
    rowCellsHeight,
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
    /**
     * it is selected: rows are selectable, it is loaded and its key selected (row selection's,
     * `@fragiola/data-grid/row-selection`: false without it)
     */
    readonly selected: boolean;
    /**
     * a drag is moving it (its handle's, Epic #86, E2.3); `undefined` while the grid's rows do not
     * move (`reorderableRows` off; row reorder's, `@fragiola/data-grid/row-reorder`)
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
    /**
     * it is in the selected range of cells (Epic #88, E4.1; a cell spanning columns while any of
     * them is); `undefined` while cells are not selectable (`cellSelection`), and in a summary row.
     * Cell ranges' (`@fragiola/data-grid/range`), as `rangeEdges`
     */
    readonly selected: boolean | undefined;
    /**
     * the range's edges it sits on, for its borders: `top`, `bottom`, `start`, `end`, those that
     * apply, space-separated in that order (`start` is the right edge right to left); `undefined`
     * for a cell inside the range or outside it, and while cells are not selectable
     */
    readonly rangeEdges: string | undefined;
    /**
     * it is the cell being edited (Epic #88, E4.3): it shows its editor; `undefined` without
     * editing (`@fragiola/data-grid/editing`)
     */
    readonly editing: boolean | undefined;
    /**
     * a fill's drag would fill it (Epic #88, E4.4: in its target); `undefined` while cells do not
     * fill (the fill handle's, `@fragiola/data-grid/fill`)
     */
    readonly fillTarget: boolean | undefined;
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
    /**
     * its column sorts the grid: a click, Enter or Space toggles it (never a group). Sorting's
     * (`@fragiola/data-grid/sorting`): `undefined` without it, as the two below
     */
    readonly sortable?: boolean | undefined;
    /** the direction its column is sorted in, when it is (sorting's) */
    readonly sortDirection?: "ascending" | "descending" | undefined;
    /** its column's place among the sorted columns, 1-based, when it is sorted (sorting's) */
    readonly sortPriority?: number | undefined;
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
    /**
     * its column is resizable, or for a group one of its columns (a resizer can resize it).
     * Resizing's (`@fragiola/data-grid/column-resize`, Epic #148): `undefined` without it, as
     * `resizing`
     */
    readonly resizable?: boolean | undefined;
    /** a drag is resizing it (its resizer's; resizing's) */
    readonly resizing?: boolean | undefined;
    /**
     * its column or group can be moved among its siblings (its drag, Ctrl/⌘+Shift+←/→).
     * Reordering's (`@fragiola/data-grid/column-reorder`, Epic #148): `undefined` without it, as
     * `dragging` and `dropTarget`
     */
    readonly reorderable?: boolean | undefined;
    /** a drag is moving it (reordering's) */
    readonly dragging?: boolean | undefined;
    /**
     * a drag would drop beside it, on this side (the app draws the indicator); else `null`
     * (reordering's)
     */
    readonly dropTarget?: ReorderSide | null | undefined;
    /**
     * a collapsible group's (Epic #85, E1.3): whether it is collapsed (`column-groups.toggle`
     * opens and closes it); `undefined` for a header cell that does not collapse, and without
     * collapsing (`@fragiola/data-grid/column-group-collapse`, Epic #148)
     */
    readonly collapsed?: boolean | undefined;
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

/**
 * A row's kind as its caller read it (Epic #87: `rowMetaAt`; an adapter's row info carries it),
 * so a part reads `getRowMeta` no more.
 */
export interface RowRead {
    readonly meta: RowMeta | undefined;
}

/**
 * What the features fill in a body row's part (`FeatureSpec.row`, Epic #144): its fields start
 * as a grid without them has them. One object the parts reuse: nothing is allocated per row.
 */
export interface RowShare {
    selected: boolean;
    ariaSelected: boolean | undefined;
    /** a row heading a row group: whether it shows its rows (row grouping's, Epic #151) */
    groupExpanded: boolean | undefined;
    /** a `treegrid`'s row ARIA (row grouping's, Epic #151) */
    ariaTree: AriaTreeRow | undefined;
    /** a drag is moving it (row reorder's, Epic #151) */
    dragging: boolean | undefined;
    /** a drag would drop its row beside it, on this side (row reorder's, Epic #151) */
    dropTarget: ReorderSide | null | undefined;
}

/**
 * What the features fill in a body cell's part (`FeatureSpec.cell`, Epic #144): its fields start
 * as a grid without them has them (`undefined`). One object the parts reuse: nothing is allocated
 * per cell.
 */
export interface CellShare {
    selected: boolean | undefined;
    rangeEdges: string | undefined;
    editing: boolean | undefined;
    fillTarget: boolean | undefined;
    ariaSelected: boolean | undefined;
}

/** The share a row's part is made with (reset per row). */
const ROW_SHARE: RowShare = {
    selected: false,
    ariaSelected: undefined,
    groupExpanded: undefined,
    ariaTree: undefined,
    dragging: undefined,
    dropTarget: undefined,
};
/** The share a cell's part is made with (reset per cell). */
const CELL_SHARE: CellShare = {
    selected: undefined,
    rangeEdges: undefined,
    editing: undefined,
    fillTarget: undefined,
    ariaSelected: undefined,
};

/** A body row's state, its `aria-selected` and its tree's ARIA. */
export interface RowPart {
    readonly state: RowState;
    /**
     * `aria-selected` (R7), in ARIA's own vocabulary: `false` is "selectable, not selected"; a row
     * that cannot be selected (or is not loaded) carries none (`undefined`); none without row
     * selection
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

/** A body cell's state, its `tabIndex`, its `aria-colspan` and its `aria-selected`. */
export interface CellPart {
    readonly state: CellState;
    /**
     * the roving tab stop: 0 on the active cell, the grid's tab stop; -1 on the others;
     * `undefined` (none) without navigation (Epic #144: no cell takes focus from the grid)
     */
    readonly tabIndex: 0 | -1 | undefined;
    /**
     * `aria-selected` (Epic #88), in ARIA's own vocabulary while cells are selectable: `true` in
     * the selected range, `false` ("selectable, not selected") elsewhere; `undefined` (none)
     * while they are not, and in a summary row
     */
    readonly ariaSelected: boolean | undefined;
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

/** A header cell's state, its `tabIndex` and the attributes its features add. */
export interface HeaderCellPart {
    readonly state: HeaderCellState;
    /** the roving tab stop, as a body cell's */
    readonly tabIndex: 0 | -1 | undefined;
    /**
     * what the installed features add to its element (sorting's `aria-sort`, `data-sort`, …);
     * `undefined` without them
     */
    readonly attributes: PartAttributes | undefined;
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
 * Whether a cell (at its element's position) is the one a view's state holds, if any: the one
 * whose controls have the keys (`interaction`), the one being edited (editing's `editingCell`).
 */
export function isHeldCell(
    held: CellPosition | null,
    cell: CellPosition,
): boolean {
    return held !== null && sameCell(held, cell);
}

/** A body row's state, and its `aria-selected`. */
export function rowPart<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
    loaded: boolean,
    read?: RowRead,
): RowPart {
    // the row read once (Epic #87: its kind, as the caller read it, nothing asked of a grid
    // without them)
    const tree = view.source.getRowMeta !== undefined;
    const meta = read
        ? read.meta
        : tree
          ? rowMetaAt(view.source, rowIndex)
          : undefined;
    // what the features add (row selection's: selected; row grouping's: expanded, its tree's
    // ARIA), from a grid without them
    const share = ROW_SHARE;
    share.selected = false;
    share.ariaSelected = undefined;
    share.groupExpanded = undefined;
    share.ariaTree = undefined;
    share.dragging = undefined;
    share.dropTarget = undefined;
    view.features.row?.(
        view as GridView<unknown, unknown>,
        rowIndex,
        meta,
        share,
    );
    const depth = tree ? depthOf(meta) : undefined;
    return {
        state: {
            rowIndex,
            loaded,
            active: view.active?.rowIndex === rowIndex,
            expanded: rowExpanded(view, rowIndex),
            selected: share.selected,
            dragging: share.dragging,
            dropTarget: share.dropTarget,
            depth,
            group: meta?.group,
            groupExpanded: share.groupExpanded,
        },
        ariaSelected: share.ariaSelected,
        ariaTree: share.ariaTree,
    };
}

/**
 * The roving tab stop of a cell (`active`): 0 on the active cell while the grid's tab stop is in
 * the page's order (a nested grid's: E5.2), -1 on the others; none without navigation (Epic #144).
 */
function tabStop<TRow, TNode>(
    view: GridView<TRow, TNode>,
    active: boolean,
): 0 | -1 | undefined {
    if (!view.features.navigable) return undefined;
    return active && view.tabbable ? 0 : -1;
}

/**
 * A body cell's state, its `tabIndex` and its `aria-colspan`: a cell spanning columns (E1.2) is
 * active on any of them. The features fill the rest (a range's, an edit's, a fill's: `CellShare`).
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
    // what the features add (a range's, a fill's), from a grid without them
    const share = CELL_SHARE;
    share.selected = undefined;
    share.rangeEdges = undefined;
    share.editing = undefined;
    share.fillTarget = undefined;
    share.ariaSelected = undefined;
    view.features.cell?.(view as GridView<unknown, unknown>, cell, span, share);
    return {
        state: {
            rowIndex: cell.rowIndex,
            columnIndex: cell.columnIndex,
            loaded: cell.loaded,
            active,
            pinned,
            pinnedEdge,
            pinnedSide,
            interacting: isHeldCell(view.interaction, cell),
            selected: share.selected,
            rangeEdges: share.rangeEdges,
            editing: share.editing,
            fillTarget: share.fillTarget,
        },
        tabIndex: tabStop(view, active),
        ariaColSpan: span > 1 ? span : undefined,
        ariaSelected: share.ariaSelected,
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

/**
 * A header cell's state, its `tabIndex` and what its features add (Epic #141): a column spanning
 * header rows is active on any of them.
 */
export function headerCellPart<TRow, TNode>(
    view: GridView<TRow, TNode>,
    cell: HeaderCellLayout<TRow, TNode>,
): HeaderCellPart {
    const { pinned, pinnedEdge, pinnedSide } = columnPinning(
        view,
        cell.columnIndex,
        cell.columnSpan,
    );
    const active =
        view.active !== null && sameCell(view.active, cell, view.header.cellAt);
    const state: HeaderCellState = {
        rowIndex: cell.rowIndex,
        columnIndex: cell.columnIndex,
        columnSpan: cell.columnSpan,
        rowSpan: cell.rowSpan,
        group: cell.group !== undefined,
        active,
        pinned,
        pinnedEdge,
        pinnedSide,
        interacting: isHeldCell(view.interaction, cell),
    };
    // the tab stop while the grid's is in the page's order (a nested grid's: E5.2)
    const tabIndex = tabStop(view, active);
    const share = view.features.headerCell?.(
        view as GridView<unknown, unknown>,
        cell as HeaderCellLayout<unknown, unknown>,
    );
    return share
        ? {
              state: { ...state, ...share.state },
              tabIndex,
              attributes: share.attributes,
          }
        : { state, tabIndex, attributes: undefined };
}
