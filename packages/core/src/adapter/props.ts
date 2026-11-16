// The parts' props, whatever the framework (Epic #123): what each primitive and part hook puts on
// its element (ARIA, `data-*`, the roving tab stop, its structural style) and what a part renders
// by default. An adapter adds only its framework's own: refs, listeners, `render`/`as`, and the
// unit a number takes in its style (React adds `px`, Vue does not).

import { GROUP_LABEL_ATTRIBUTE } from "../engine/dom";
import {
    ariaEmptyRowIndex,
    ariaHeaderCellSpans,
    ariaRowCount,
    ariaRowDetail,
    ariaRowIndex,
    gridRole,
    headerCellBox,
    inlineStart,
    measuredRow,
    renderedWidth,
    rowColumns,
    rowDisplay,
    rowLeft,
    rowTop,
    rowWidth,
    summaryHeight,
} from "../engine/geometry";
import {
    type CellPart,
    type CellState,
    type ColumnResizerState,
    cellBox,
    cellPart,
    columnResizerPart,
    type FillHandleState,
    fillHandlePart,
    type GroupToggleState,
    groupTogglePart,
    type HeaderCellPart,
    type HeaderCellState,
    headerCellPart,
    type RowDetailState,
    type RowDragHandleState,
    type RowState,
    rowDetailPart,
    rowDragHandlePart,
    rowPart,
    type SummaryCellPart,
    type SummaryCellState,
    type SummaryRowState,
    summaryCellPart,
    summaryRowPart,
} from "../engine/parts";
import type { GridView } from "../engine/types";
import { valueText } from "../model/range";
import {
    dataRowAt,
    depthOf,
    rowCellValue,
    rowKeyOf,
    rowMetaAt,
} from "../model/source";
import type {
    Column,
    GridDirection,
    GroupRow,
    HeaderCellLayout,
    RowMeta,
    SummaryPosition,
    SummaryRowView,
} from "../model/types";

/**
 * A part's structural style (D4): the keys a primitive sets, which always win over the
 * consumer's. Lengths are numbers of pixels (an adapter whose framework adds no unit adds `px`).
 */
export interface PartStyle {
    position?: "absolute" | "relative" | "sticky";
    display?: "block" | "flex" | "grid";
    top?: number | string;
    left?: number;
    right?: number;
    width?: number;
    height?: number | "100%";
    marginTop?: number;
    marginLeft?: number;
    marginRight?: number;
    gridArea?: string;
    flexShrink?: number;
    alignSelf?: "flex-start";
    overflow?: "auto" | "clip";
    zIndex?: number;
    boxSizing?: "border-box";
}

/** A part's props: its attributes (ARIA, `data-*`, `tabIndex`, …) and its structural style. */
export type PartProps = Record<string, unknown> & { style: PartStyle };

/** What a part hook returns: its state, and the props for its element. */
export interface PartResult<S> {
    readonly state: S;
    readonly props: PartProps;
}

/** `data-*` attributes from a record: `true` → present (empty), `false`/`undefined` → absent. */
export function dataAttributes(
    record: Record<string, string | number | boolean | undefined>,
): Record<string, string> {
    const attributes: Record<string, string> = {};
    for (const key in record) {
        const value = record[key];
        if (value === true) {
            attributes[`data-${key}`] = "";
        } else if (value !== false && value !== undefined) {
            attributes[`data-${key}`] = String(value);
        }
    }
    return attributes;
}

/**
 * The structural style key of an offset from a view's inline start (E1.1): `left`, or in a
 * right-to-left grid `right`; with `"margin"`, `marginLeft` or `marginRight`.
 */
export function inlineSide(direction: GridDirection): "left" | "right";
export function inlineSide(
    direction: GridDirection,
    prefix: "margin",
): "marginLeft" | "marginRight";
export function inlineSide(
    direction: GridDirection,
    prefix?: "margin",
): "left" | "right" | "marginLeft" | "marginRight" {
    const side = inlineStart(direction);
    if (!prefix) return side;
    return side === "left" ? "marginLeft" : "marginRight";
}

/** The layers' `transform` is the engine's: a consumer's would move the rows. */
export const LAYER_KEYS = ["transform"] as const;

/**
 * A pinned cell's inline start inset (`left`, right to left `right`) is the engine's, and the
 * other insets and a `transform` would let it move from its place (`position: sticky` obeys every
 * inset it is given). A measured row's cells and a row's detail drop them too.
 */
export const PINNED_KEYS = [
    "transform",
    "left",
    "right",
    "top",
    "bottom",
    "inset",
    "insetInline",
    "insetInlineStart",
    "insetInlineEnd",
    "insetBlock",
    "insetBlockStart",
    "insetBlockEnd",
] as const;

/**
 * The layers the sticky parts take (Epic #89, E5.2): the header above the summary rows, both above
 * the body (no `z-index`: a layer whose transform makes it a stacking context, its pinned cells'
 * stacking the app's inside it).
 */
export const HEADER_LAYER = 2;
export const SUMMARY_LAYER = 1;

/** A measured row's grid areas (Epic #86): its cells share the first, its detail the one below. */
export const CELLS_AREA = "1 / 1";
export const DETAIL_AREA = "2 / 1";

/** A body row, as `DataGrid.Rows` hands it to its children (each adapter's `RowInfo`). */
export interface GridRowInfo<TRow = unknown> {
    readonly rowIndex: number;
    /** `undefined` while the row is not loaded, and for a group row (it has none) */
    readonly row: TRow | undefined;
    /** a data row loaded, or a group row (Epic #87: nothing to wait for) */
    readonly loaded: boolean;
    /** the row's key: `rowKey(row, index)`, or its index; a group row's group key */
    readonly key: string | number;
    /** a group row's group (Epic #87, `getRowMeta`); `undefined` for a data row */
    readonly group: GroupRow | undefined;
    /** its depth in the grid's tree (Epic #87): 0 at the top, and without row kinds */
    readonly depth: number;
    /** its kind as the grid read it (`getRowMeta`'s answer, Epic #87): its parts read no more */
    readonly meta: RowMeta | undefined;
}

/** A body cell, as `DataGrid.Cells` hands it to its children (each adapter's `CellInfo`). */
export interface GridCellInfo<TRow = unknown, TNode = unknown> {
    readonly rowIndex: number;
    readonly columnIndex: number;
    readonly column: Column<TRow, TNode>;
    /** `undefined` while the row is not loaded, and on a group row */
    readonly row: TRow | undefined;
    readonly loaded: boolean;
    /**
     * `column.getValue(row)`, or `row[column.key]`; `undefined` while the row is not loaded. On a
     * group row (Epic #87), the group's value in the column it groups by, else its aggregate
     */
    readonly value: unknown;
    /** its row's group, on a group row (Epic #87) */
    readonly group: GroupRow | undefined;
    /** its row's kind (Epic #87), as its row's info */
    readonly meta: RowMeta | undefined;
}

/** A summary row's cell, as `DataGrid.SummaryCells` hands it to its children. */
export interface GridSummaryCellInfo<TRow = unknown, TNode = unknown> {
    readonly rowIndex: number;
    readonly columnIndex: number;
    readonly column: Column<TRow, TNode>;
    readonly position: SummaryPosition;
    readonly summaryIndex: number;
}

/** The rows a render shows, with their data, keys and kinds (Epic #87: a group row, a depth). */
export function rowsOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
): GridRowInfo<TRow>[] {
    const { source } = view;
    return view.rows.map((rowIndex) => {
        // read once: its kind (a grid without them asks for none), its data row, and its key by
        // the core's one rule (the engine's measured keys share it)
        const meta = rowMetaAt(source, rowIndex);
        const row = dataRowAt(source, rowIndex, meta);
        const group = meta?.group;
        return {
            rowIndex,
            row,
            loaded: row !== undefined || group !== undefined,
            key: rowKeyOf(view, rowIndex, meta, row) ?? rowIndex,
            group,
            depth: depthOf(meta),
            meta,
        };
    });
}

/**
 * A rendered row's key among its siblings: the app's key when it gives some (a row not loaded yet
 * has none: its index), else its index, so a row loading in place keeps its elements (and
 * focus); the prefixes keep a key and an index apart.
 */
export function rowElementKey<TRow, TNode>(
    view: GridView<TRow, TNode>,
    row: GridRowInfo<TRow>,
): string {
    return view.rowKey !== undefined && row.loaded
        ? `k${row.key}`
        : `i${row.rowIndex}`;
}

/**
 * A row's cells (a body row's or a summary row's), each made from its column: one per rendered
 * column, but a cell spanning columns (Epic #85) stands for the ones it covers (`rowColumns`).
 */
function cellsOf<TRow, TNode, Cell>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
    cell: (columnIndex: number, column: Column<TRow, TNode>) => Cell,
): Cell[] {
    return rowColumns(view, rowIndex).flatMap((columnIndex) => {
        const column = view.columnDefs[columnIndex];
        return column ? [cell(columnIndex, column)] : [];
    });
}

/**
 * The cells a row renders, with their columns and values: one per rendered column, but a cell
 * spanning columns (a column's `colSpan`, Epic #85) stands for the ones it covers.
 */
export function rowCellsOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    row: GridRowInfo<TRow>,
): GridCellInfo<TRow, TNode>[] {
    const { group, meta } = row;
    return cellsOf(view, row.rowIndex, (columnIndex, column) => ({
        rowIndex: row.rowIndex,
        columnIndex,
        column,
        row: row.row,
        loaded: row.loaded,
        value: rowCellValue(column, row.rowIndex, group, row.row),
        group,
        meta,
    }));
}

/**
 * The cells a summary row renders, with their columns: one per rendered column, but a cell
 * spanning columns (a column's `colSpan` asked with `type: "summary"`) stands for the ones it
 * covers.
 */
export function summaryCellsOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    row: SummaryRowView,
): GridSummaryCellInfo<TRow, TNode>[] {
    return cellsOf(view, row.rowIndex, (columnIndex, column) => ({
        rowIndex: row.rowIndex,
        columnIndex,
        column,
        position: row.position,
        summaryIndex: row.summaryIndex,
    }));
}

/**
 * A row's structural style (a header row's too, at `top`): in its layer, from `rowLeft`, as wide
 * as its rendered cells (an expanded row, as what holds its detail); with pinned columns, a flex
 * container their sticky cells stack in. A `measured` body row (Epic #86) has no height: a grid
 * whose one area its cells share, as tall as the tallest, its detail in the area below.
 */
export function rowStyle<TRow, TNode>(
    view: GridView<TRow, TNode>,
    top: number,
    height: number,
    width: number = renderedWidth(view),
    measured = false,
): PartStyle {
    const display = measured ? "grid" : rowDisplay(view);
    return {
        position: "absolute",
        ...(display ? { display } : {}),
        top,
        [inlineSide(view.direction)]: rowLeft(view),
        width,
        ...(measured ? {} : { height }),
        boxSizing: "border-box",
    };
}

/**
 * The props a body cell and a header cell share, in one record: the roving tab stop, ARIA,
 * `data-*` and their structural style. A cell that scrolls is positioned in its row (from its
 * inline start); a pinned one is in the row's flow, `sticky`: the browser's scrolling keeps it in
 * place, at the inline start inset the engine writes (it is the engine's, like a layer's
 * transform). In a `measured` row (Epic #86) every cell is in its row's one grid area, at its
 * inline start margin, as tall as the row's tallest cell (no height of its own).
 */
export function cellProps<TRow, TNode>(
    view: GridView<TRow, TNode>,
    part: CellPart | HeaderCellPart | SummaryCellPart,
    box: {
        readonly left: number;
        readonly width: number;
        readonly height: number;
    },
    measured = false,
): PartProps {
    const { state } = part;
    // a header cell's state is the one with a `group` (its sort comes with it), a summary row
    // cell's the one with a `position`
    const header = "group" in state ? state : undefined;
    const summary = "position" in state ? state.position : undefined;
    const ariaSort = "ariaSort" in part ? part.ariaSort : undefined;
    const ariaColSpan = "ariaColSpan" in part ? part.ariaColSpan : undefined;
    // a body or summary row cell's (Epic #88): in the range, its edges, edited
    const ariaSelected = "ariaSelected" in part ? part.ariaSelected : undefined;
    const body = "rangeEdges" in state ? state : undefined;
    const { pinned } = state;
    const { width, height } = box;
    return {
        role: header ? "columnheader" : "gridcell",
        "aria-colindex": state.columnIndex + 1,
        ...(header ? ariaHeaderCellSpans(header) : undefined),
        ...(ariaColSpan ? { "aria-colspan": ariaColSpan } : undefined),
        ...(ariaSort ? { "aria-sort": ariaSort } : undefined),
        ...(ariaSelected === undefined
            ? undefined
            : { "aria-selected": ariaSelected }),
        tabIndex: part.tabIndex,
        ...dataAttributes({
            "grid-part": header
                ? "header-cell"
                : summary
                  ? "summary-cell"
                  : "cell",
            summary,
            "row-index": state.rowIndex,
            "column-index": state.columnIndex,
            loading: "loaded" in state && !state.loaded,
            active: state.active,
            group: header?.group,
            sortable: header?.sortable,
            sort: header?.sortDirection,
            "sort-priority": header?.sortPriority,
            pinned: state.pinnedSide,
            "pinned-edge": state.pinnedEdge,
            interacting: state.interacting,
            resizable: header?.resizable,
            resizing: header?.resizing,
            collapsible: header !== undefined && header.collapsed !== undefined,
            collapsed: header?.collapsed,
            reorderable: header?.reorderable,
            dragging: header?.dragging,
            "drop-target": header?.dropTarget ?? undefined,
            "selected-cell": body?.selected,
            "range-edge": body?.rangeEdges,
            editing: body?.editing,
            "fill-target": body?.fillTarget,
        }),
        style: measured
            ? {
                  position: pinned ? "sticky" : "relative",
                  gridArea: CELLS_AREA,
                  [inlineSide(view.direction, "margin")]: box.left,
                  width,
                  boxSizing: "border-box",
              }
            : pinned
              ? { position: "sticky", width, height, boxSizing: "border-box" }
              : {
                    position: "absolute",
                    top: 0,
                    [inlineSide(view.direction)]: box.left,
                    width,
                    height,
                    boxSizing: "border-box",
                },
    };
}

/**
 * A body or summary row cell's part, with its span and whether its row is measured: its state,
 * its props (`cellProps`) on its box in its row, `height` tall (default: its row's own height),
 * or in a `measured` row as tall as its row's tallest cell.
 */
function cellPartProps<TRow, TNode, P extends CellPart | SummaryCellPart>(
    view: GridView<TRow, TNode>,
    part: P,
    cell: { readonly rowIndex: number; readonly columnIndex: number },
    height?: number,
    measured = false,
): PartResult<P["state"]> & { columnSpan: number; measured: boolean } {
    const columnSpan = part.ariaColSpan ?? 1;
    return {
        state: part.state,
        props: cellProps(
            view,
            part,
            cellBox(view, cell.rowIndex, cell.columnIndex, columnSpan, height),
            measured,
        ),
        columnSpan,
        measured,
    };
}

/**
 * A body cell's state and props (`useCell`), with how many columns it spans (a table cell's
 * `colSpan`) and whether its row is measured (its insets dropped as a pinned cell's).
 */
export function cellPartOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    cell: GridCellInfo<TRow, TNode>,
): PartResult<CellState> & { columnSpan: number; measured: boolean } {
    return cellPartProps(
        view,
        cellPart(view, cell),
        cell,
        undefined,
        measuredRow(view, cell.loaded),
    );
}

/** A summary row cell's state and props (`useSummaryCell`), with its span (as a body cell's). */
export function summaryCellPartOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    cell: GridSummaryCellInfo<TRow, TNode>,
): PartResult<SummaryCellState> & { columnSpan: number; measured: boolean } {
    return cellPartProps(
        view,
        summaryCellPart(view, cell),
        cell,
        view.summaryRowHeight,
    );
}

/** A header cell's state and props (`useHeaderCell`): at its row's top, spanning down past it. */
export function headerCellPartOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    cell: HeaderCellLayout<TRow, TNode>,
): PartResult<HeaderCellState> {
    const part = headerCellPart(view, cell);
    return {
        state: part.state,
        props: cellProps(view, part, headerCellBox(view, cell)),
    };
}

/**
 * A body row's state and props (`useRow`), and whether it is measured (Epic #86): then its
 * element registers as the engine's `row` layer (the adapter's ref).
 */
export function rowPartOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    row: GridRowInfo<TRow>,
): PartResult<RowState> & { measured: boolean } {
    // the row's kind, read once by `rowsOf`
    const { state, ariaSelected, ariaTree } = rowPart(
        view,
        row.rowIndex,
        row.loaded,
        row,
    );
    const measured = measuredRow(view, row.loaded);
    return {
        state,
        measured,
        props: {
            role: "row",
            "aria-rowindex": ariaRowIndex(view, row.rowIndex),
            ...(ariaSelected === undefined
                ? {}
                : { "aria-selected": ariaSelected }),
            // a treegrid's row (Epic #87): its level, expansion and set
            ...ariaTree,
            ...dataAttributes({
                "grid-part": "row",
                "row-index": row.rowIndex,
                loading: !row.loaded,
                active: state.active,
                expanded: state.expanded,
                selected: state.selected,
                // while a drag moves it, or would drop beside it (Epic #86)
                dragging: state.dragging,
                "drop-target": state.dropTarget ?? undefined,
                // its kind (Epic #87): a group row, a row group expanded, its depth
                "group-row": state.group !== undefined,
                "group-expanded": state.groupExpanded,
                depth: state.depth,
            }),
            // an expanded row's box holds its detail, below its cells
            style: rowStyle(
                view,
                rowTop(view, row.rowIndex),
                view.rowAxis.sizeOf(row.rowIndex),
                rowWidth(view, row.rowIndex),
                measured,
            ),
        },
    };
}

/**
 * A row's detail (M3): its state, and the props for its element (rendered only while
 * `state.expanded`). One cell of its row spanning every column (M4), in the row's flow below its
 * cells, sticky at the view's start (the engine writes its `left`), as wide as the visible area.
 */
export function rowDetailPartOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    row: GridRowInfo<TRow>,
): PartResult<RowDetailState> {
    const { state, box } = rowDetailPart(view, row.rowIndex);
    if (!box) return { state, props: { style: {} } };
    const flex = rowDisplay(view) === "flex";
    // a measured detail is as tall as its content (Epic #86)
    const height = view.measuredDetails ? {} : { height: box.height };
    return {
        state,
        props: {
            role: "gridcell",
            ...ariaRowDetail(view),
            ...dataAttributes({
                "grid-part": "row-detail",
                "row-index": row.rowIndex,
            }),
            // in a measured row, the area below its cells'
            style: measuredRow(view, row.loaded)
                ? {
                      position: "sticky",
                      display: "block",
                      gridArea: DETAIL_AREA,
                      width: box.width,
                      ...height,
                      boxSizing: "border-box",
                  }
                : {
                      position: "sticky",
                      display: "block",
                      marginTop: box.top,
                      // in a row of pinned cells (flex), from the row's start, never shrunk,
                      // and measured, never stretched to the row's height
                      ...(flex
                          ? {
                                [inlineSide(view.direction, "margin")]:
                                    box.start,
                                flexShrink: 0,
                                ...(view.measuredDetails
                                    ? { alignSelf: "flex-start" as const }
                                    : {}),
                            }
                          : {}),
                      width: box.width,
                      ...height,
                      boxSizing: "border-box",
                  },
        },
    };
}

/**
 * A summary row's state and props (Epic #86): ARIA (`role="row"`, its `aria-rowindex` after the
 * header's or the body's rows), `data-summary`, and its structural style in its summary (from
 * `rowLeft`, a summary row tall; a flex container with pinned columns, as a body row).
 */
export function summaryRowPartOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    row: SummaryRowView,
): PartResult<SummaryRowState> {
    const { state } = summaryRowPart(view, row);
    return {
        state,
        props: {
            role: "row",
            "aria-rowindex": ariaRowIndex(view, row.rowIndex),
            ...dataAttributes({
                "grid-part": "summary-row",
                summary: row.position,
                "row-index": row.rowIndex,
                active: state.active,
            }),
            style: rowStyle(
                view,
                row.summaryIndex * view.summaryRowHeight,
                view.summaryRowHeight,
            ),
        },
    };
}

/**
 * A control the app renders in a part (a resizer, a row's drag handle, a fill handle, a group's
 * toggle): its state, and while it has its attributes (`undefined`: none to render), them and
 * its `data-*` (`dataOf` its state, a module function: nothing is allocated for a control with
 * none), with no style of its own.
 */
function controlPart<S>(
    state: S,
    attributes: Record<string, unknown> | undefined,
    dataOf: (state: S) => Parameters<typeof dataAttributes>[0],
): PartResult<S> {
    return {
        state,
        props: attributes
            ? { ...attributes, ...dataAttributes(dataOf(state)), style: {} }
            : { style: {} },
    };
}

const resizerData = (state: ColumnResizerState) => ({
    "grid-part": "column-resizer",
    resizing: state.resizing,
});

const dragHandleData = (state: RowDragHandleState) => ({
    "grid-part": "row-drag-handle",
    reorderable: state.reorderable,
    dragging: state.dragging,
});

const fillHandleData = (state: FillHandleState) => ({
    "grid-part": "fill-handle",
    filling: state.filling,
});

const groupToggleData = (state: GroupToggleState) => ({
    "grid-part": "group-toggle",
    expanded: state.expanded,
});

/** A column resizer's state and props (`useColumnResizer`): none under a cell that does not resize. */
export function columnResizerPartOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    cell: HeaderCellLayout<TRow, TNode>,
): PartResult<ColumnResizerState> {
    const { state, tabIndex, attributes } = columnResizerPart(view, cell);
    return controlPart(
        state,
        state.resizable ? { ...attributes, tabIndex } : undefined,
        resizerData,
    );
}

/** A row's drag handle's state and props (`useRowDragHandle`). */
export function rowDragHandlePartOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    row: { readonly rowIndex: number; readonly loaded: boolean },
): PartResult<RowDragHandleState> {
    const { state, attributes } = rowDragHandlePart(
        view,
        row.rowIndex,
        row.loaded,
    );
    return controlPart(state, attributes, dragHandleData);
}

/** A fill handle's state and props (`useFillHandle`): none in a cell but the range's corner. */
export function fillHandlePartOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    cell: { readonly rowIndex: number; readonly columnIndex: number },
): PartResult<FillHandleState> {
    const { state, attributes } = fillHandlePart(view, cell);
    return controlPart(state, attributes, fillHandleData);
}

/** A row group's toggle's state and props (`useGroupToggle`): none under a row that does not expand. */
export function groupTogglePartOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    row: {
        readonly rowIndex: number;
        /** the row's kind as read (a row's or a cell's info carries it): not read again */
        readonly meta?: RowMeta | undefined;
    },
): PartResult<GroupToggleState> {
    const { state, attributes } = groupTogglePart(
        view,
        row.rowIndex,
        "meta" in row ? { meta: row.meta } : undefined,
    );
    return controlPart(state, attributes, groupToggleData);
}

/** The state of a group's label: the key of the header cell it labels. */
export interface GroupLabelState {
    readonly groupKey: string;
}

/**
 * A group's label's state and props (Epic #85, E1.3), its ref apart (the engine's `label` layer):
 * sticky in its cell, the engine writes its inline start inset.
 */
export function groupLabelPartOf<TRow, TNode>(
    cell: HeaderCellLayout<TRow, TNode>,
): PartResult<GroupLabelState> {
    return {
        state: { groupKey: cell.key },
        props: {
            [GROUP_LABEL_ATTRIBUTE]: cell.key,
            ...dataAttributes({ "grid-part": "group-label" }),
            style: { position: "sticky" },
        },
    };
}

/** The root's props: the scroll container, no tab stop of its own, the direction given. */
export function rootPropsOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
): PartProps {
    return {
        ...dataAttributes({ "grid-part": "root", empty: view.rowCount === 0 }),
        // a scroll container is a tab stop in some browsers: the grid has its own
        tabIndex: -1,
        // the direction given (the prop, `direction.set`): rendered, never the engine's
        ...(view.givenDirection ? { dir: view.givenDirection } : {}),
        style: { position: "relative", overflow: "auto" },
    };
}

/** The grid's state. */
export interface GridState {
    readonly rowCount: number;
    readonly columnCount: number;
}

/**
 * The grid's state and props: its role (`treegrid` while its rows have kinds), its counts, the
 * grid's tab stop until a cell is active, and the sizer's size (the whole dataset).
 */
export function gridPartOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
): PartResult<GridState> {
    const empty = view.rowCount === 0;
    // without rows, and with expanded rows (a detail is as wide as the view), the sizer spans at
    // least the visible area: it clips what it holds
    const wide = empty || view.expandedRows.length > 0;
    return {
        state: { rowCount: view.rowCount, columnCount: view.columnCount },
        props: {
            role: gridRole(view),
            "aria-rowcount": ariaRowCount(view),
            "aria-colcount": view.columnCount,
            // many rows selectable (R7), or ranges of cells (Epic #88)
            ...(view.rowSelection === "multiple" || view.cellSelection
                ? { "aria-multiselectable": true }
                : {}),
            // the grid's tab stop until a cell is active (roving: then that cell is)
            // (a nested grid's only while its holder's active cell holds it: Epic #89, E5.2)
            tabIndex: view.active || !view.tabbable ? -1 : 0,
            ...dataAttributes({ "grid-part": "grid", empty }),
            style: {
                position: "relative",
                display: "block",
                // without rows, the sizer still spans the visible area: the empty state has room
                width: wide
                    ? Math.max(view.width, view.viewportWidth)
                    : view.width,
                height:
                    view.headerHeight +
                    summaryHeight(view, "top") +
                    summaryHeight(view, "bottom") +
                    (empty
                        ? Math.max(view.height, view.viewportBodyHeight)
                        : view.height),
                // clips the rendered rows to the sizer without being a scroll container (sticky
                // headers stick to the viewport)
                overflow: "clip",
                boxSizing: "border-box",
            },
        },
    };
}

/** The body's props: the layer the engine moves with the rows, below the header and top summary rows. */
export function bodyPropsOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
): PartProps {
    return {
        role: "rowgroup",
        ...dataAttributes({ "grid-part": "body" }),
        style: {
            position: "absolute",
            top: view.headerHeight + summaryHeight(view, "top"),
            [inlineSide(view.direction)]: 0,
            boxSizing: "border-box",
        },
    };
}

/** The header's props: sticky at the viewport's top, as tall as its rows, above the rest. */
export function headerPropsOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
): PartProps {
    return {
        role: "rowgroup",
        ...dataAttributes({ "grid-part": "header" }),
        style: {
            position: "sticky",
            top: 0,
            // above the rows scrolling under it and the summary rows (Epic #89, E5.2); its
            // background is the app's
            zIndex: HEADER_LAYER,
            display: "block",
            height: view.headerHeight,
            boxSizing: "border-box",
        },
    };
}

/** The state of a header row. */
export interface HeaderRowState {
    /** -1 for the columns' row, above it for groups */
    readonly rowIndex: number;
}

/** A header row's state and props: a layer the engine moves with the columns. */
export function headerRowPartOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): PartResult<HeaderRowState> {
    return {
        state: { rowIndex },
        props: {
            role: "row",
            "aria-rowindex": ariaRowIndex(view, rowIndex),
            ...dataAttributes({ "grid-part": "header-row" }),
            style: {
                ...rowStyle(
                    view,
                    (rowIndex + view.headerRowCount) * view.headerRowHeight,
                    view.headerRowHeight,
                ),
                // with several rows, an upper one stays above the next: a cell spanning down
                // from it is not covered by the row it reaches into
                ...(view.headerRowCount > 1 ? { zIndex: -rowIndex } : {}),
            },
        },
    };
}

/** The state of a position's summary rows. */
export interface SummaryState {
    readonly position: SummaryPosition;
}

/**
 * A position's summary rows' state and props, sticky: the top ones under the header, the bottom
 * ones as far down as the view's bottom edge (a sticky inset's percentage is the scroll
 * container's height, so no measure places them).
 */
export function summaryPartOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    position: SummaryPosition,
): PartResult<SummaryState> {
    const height = summaryHeight(view, position);
    return {
        state: { position },
        props: {
            role: "rowgroup",
            ...dataAttributes({ "grid-part": "summary", summary: position }),
            style: {
                position: "sticky",
                top:
                    position === "top"
                        ? view.headerHeight
                        : `calc(100% - ${height}px)`,
                // above the rows scrolling under them, below the header (E5.2)
                zIndex: SUMMARY_LAYER,
                display: "block",
                height,
                boxSizing: "border-box",
            },
        },
    };
}

/**
 * The structural style of the empty state's row (and of its cell as a table's): a block the
 * area's full height.
 */
export const EMPTY_FILL = {
    display: "block",
    height: "100%",
    boxSizing: "border-box",
} as const satisfies PartStyle;

/**
 * The empty state's cell's props (Epic #89, E5.2): a cell spanning every column, the area's full
 * height (a div's display left to the app: its content's layout).
 */
export function emptyCellPropsOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
): PartProps {
    const columns = Math.max(1, view.columnCount);
    return {
        ...dataAttributes({ "grid-part": "empty" }),
        role: "gridcell",
        ...(columns > 1 ? { "aria-colspan": columns } : {}),
        style: { height: "100%", boxSizing: "border-box" },
    };
}

/**
 * The empty state's area (a `<tbody>` for a table) and row (a `<tr>`): in the flow after the
 * header, sticky at the inline start, as tall as the visible body and as wide as the columns, at
 * most the view (Epic #113); the row the body's first line while it has no other.
 */
export function emptyAreaPropsOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    table: boolean,
): { readonly area: PartProps; readonly row: PartProps } {
    return {
        area: {
            "data-grid-part": "empty-area",
            style: {
                position: "sticky",
                [inlineSide(view.direction)]: 0,
                display: "block",
                // under the columns in view (Epic #113): as wide as they are, at most the view;
                // no columns, the whole view
                width:
                    view.width > 0
                        ? Math.min(view.width, view.viewportWidth)
                        : view.viewportWidth,
                height: view.viewportBodyHeight,
                boxSizing: "border-box",
            },
        },
        row: {
            "data-grid-part": "empty-row",
            ...(table ? {} : { role: "row" }),
            "aria-rowindex": ariaEmptyRowIndex(view),
            style: EMPTY_FILL,
        },
    };
}

/**
 * What a header cell shows by default (`DataGrid.HeaderCell` without children): its group's or
 * its column's `renderHeaderCell`, else its `name`. An app that adds its own content to a header
 * cell (a resizer) renders this first.
 */
export function headerCellContent<TRow, TNode>(
    cell: HeaderCellLayout<TRow, TNode>,
): TNode | string | undefined {
    if (cell.group) {
        return cell.group.renderHeaderCell
            ? cell.group.renderHeaderCell({
                  group: cell.group,
                  columnIndex: cell.columnIndex,
                  columnSpan: cell.columnSpan,
              })
            : cell.group.name;
    }
    return cell.column.renderHeaderCell
        ? cell.column.renderHeaderCell({
              column: cell.column,
              columnIndex: cell.columnIndex,
          })
        : cell.column.name;
}

/**
 * A value rendered as text when a cell has no children and its column no renderer: a string as it
 * is, a number, a big integer or a boolean written out (`valueText`, what a copy takes, Epic #88);
 * nothing (`null`) for anything else.
 */
export function plainCellText(value: unknown): string | null {
    return typeof value === "string" ? value : valueText(value) || null;
}

/**
 * What a body cell shows by default, but while it is edited (its column's `renderEditCell`, the
 * adapter's: it follows the draft): on a group row (Epic #87) its column's `renderGroupCell`, else
 * its value as text; on a loaded row its column's `renderCell`, else its value as text; nothing
 * while its row is not loaded.
 */
export function cellContent<TRow, TNode>(
    cell: GridCellInfo<TRow, TNode>,
): TNode | string | null {
    if (cell.group) {
        // a group row has no data row: its group's value and aggregates (Epic #87)
        return cell.column.renderGroupCell
            ? cell.column.renderGroupCell({
                  group: cell.group,
                  rowIndex: cell.rowIndex,
                  column: cell.column,
                  columnIndex: cell.columnIndex,
                  value: cell.value,
              })
            : plainCellText(cell.value);
    }
    if (cell.loaded && cell.row !== undefined) {
        return cell.column.renderCell
            ? cell.column.renderCell({
                  row: cell.row,
                  rowIndex: cell.rowIndex,
                  column: cell.column,
                  columnIndex: cell.columnIndex,
                  value: cell.value,
              })
            : plainCellText(cell.value);
    }
    return null;
}

/** What a summary row's cell shows by default: its column's `renderSummaryCell`, else nothing. */
export function summaryCellContent<TRow, TNode>(
    cell: GridSummaryCellInfo<TRow, TNode>,
): TNode | null {
    const { column } = cell;
    return (
        column.renderSummaryCell?.({
            position: cell.position,
            summaryIndex: cell.summaryIndex,
            column,
            columnIndex: cell.columnIndex,
        }) ?? null
    );
}
