import {
    type AxisWindow,
    ariaHeaderCellSpans,
    ariaRowDetail,
    ariaRowIndex,
    type CellPart,
    type CellState,
    type ColumnResizerState,
    cellBox,
    cellPart,
    cellValue,
    columnResizerPart,
    dataRowAt,
    depthOf,
    EMPTY_WINDOW,
    GROUP_LABEL_ATTRIBUTE,
    type GridDirection,
    type GridView,
    type GroupToggleState,
    groupCellValue,
    groupTogglePart,
    type HeaderCellPart,
    type HeaderCellState,
    headerCellBox,
    headerCellPart,
    inlineStart,
    measuredRow,
    type RowDetailState,
    type RowDragHandleState,
    type RowMeta,
    type RowState,
    renderedWidth,
    rowColumns,
    rowDetailPart,
    rowDisplay,
    rowDragHandlePart,
    rowKeyOf,
    rowLeft,
    rowMetaAt,
    rowPart,
    rowTop,
    rowWidth,
    type SummaryCellPart,
    type SummaryCellState,
    type SummaryPosition,
    type SummaryRowState,
    summaryCellPart,
    summaryRowPart,
    summaryRowsOf,
} from "@fragiola/data-grid";
import type * as React from "react";
import {
    type ReactNode,
    useContext,
    useMemo,
    useSyncExternalStore,
} from "react";
import {
    type CellInfo,
    type Column,
    type HeaderCellInfo,
    HeaderRowContext,
    type HeaderRowInfo,
    type RowInfo,
    type SummaryCellInfo,
    SummaryContext,
    SummaryRowContext,
    type SummaryRowInfo,
    useGrid,
    useRootGrid,
    ViewContext,
} from "./context";
import { type DataGridRef, noSubscription } from "./gridRef";
import { layerRef } from "./utils/layerRef";
import { dataAttributes } from "./utils/useRender";

export type {
    CellState,
    ColumnResizerState,
    GroupToggleState,
    HeaderCellState,
    RowDetailState,
    RowDragHandleState,
    RowState,
    SummaryCellState,
    SummaryRowState,
} from "@fragiola/data-grid";
export { useDataGrid } from "./context";

/** What a part hook returns: its state, and the props for its element (the structural style in `props.style`). */
interface PartHookResult<S> {
    state: S;
    props: Record<string, unknown> & { style: React.CSSProperties };
}

/** The view the engine reports: what to render. A component re-renders only when it changes. */
export function useGridView<TRow = unknown>(): GridView<TRow, ReactNode> {
    const view = useContext(ViewContext);
    if (!view) {
        throw new Error("useGridView() must be used inside <DataGrid.Root>");
    }
    // the root that provides it was given the row type
    return view as GridView<TRow, ReactNode>;
}

function useWindow<TRow>(
    event: "row-window" | "column-window",
    gridRef: DataGridRef<TRow> | undefined,
): AxisWindow {
    const engine = useGrid(
        gridRef,
        "a window hook must be used inside <DataGrid.Root>, or be given a gridRef",
    )?.engine;
    const subscribe = useMemo(
        () =>
            engine
                ? (listener: () => void) => engine.subscribe(event, listener)
                : noSubscription,
        [engine, event],
    );
    const read = () => (engine ? engine.get(event) : EMPTY_WINDOW);
    return useSyncExternalStore(subscribe, read, read);
}

/**
 * The rows in view and rendered; re-renders when either range changes (e.g. to show them). With
 * a `gridRef`, from outside the `Root` too (the empty window until a `Root` takes the ref).
 */
export function useRowWindow<TRow>(gridRef?: DataGridRef<TRow>): AxisWindow {
    return useWindow("row-window", gridRef);
}

/** The columns in view and rendered; re-renders when either range changes. Takes a `gridRef` too. */
export function useColumnWindow<TRow>(gridRef?: DataGridRef<TRow>): AxisWindow {
    return useWindow("column-window", gridRef);
}

/** The rows a render shows, with their data, keys and kinds (Epic #87: a group row, a depth). */
export function useRows<TRow = unknown>(): RowInfo<TRow>[] {
    // outside a `Root`, the grid's own error first
    useRootGrid();
    const view = useGridView<TRow>();
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
 * The structural style key of an offset from a view's inline start (E1.1): `left`, or in a
 * right-to-left grid `right`; with `"margin"`, `marginLeft` or `marginRight`. Written straight
 * into the part's style object.
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

/**
 * A row's structural style (a header row's too, at `top`): in its layer, from `rowLeft`, as wide
 * as its rendered cells (an expanded row, as what holds its detail); with pinned columns, a flex
 * container their sticky cells stack in. A `measured` body row (Epic #86) has no height: a grid
 * whose one area its cells share, as tall as the tallest, its detail in the area below.
 */
export function rowStyle<TRow>(
    view: GridView<TRow, ReactNode>,
    top: number,
    height: number,
    width: number = renderedWidth(view),
    measured = false,
): React.CSSProperties {
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
 * A body row's state, and the props for its element (ARIA, `data-*`, structural style). A row
 * measured (`rowHeight: "auto"`) has a `ref` among them too: the engine reads its height.
 */
export function useRow<TRow>(row: RowInfo<TRow>): PartHookResult<RowState> {
    const { state, props, ref } = useRowPart(row);
    return { state, props: ref ? { ...props, ref } : props };
}

/** `useRow`, its `ref` apart: a measured row's registration with the engine, else `undefined`. */
export function useRowPart<TRow>(
    row: RowInfo<TRow>,
): PartHookResult<RowState> & {
    ref: React.RefCallback<HTMLElement> | undefined;
} {
    const view = useGridView<TRow>();
    const { engine } = useRootGrid();
    // the row's kind, read once by `useRows`
    const { state, ariaSelected, ariaTree } = rowPart(
        view,
        row.rowIndex,
        row.loaded,
        row,
    );
    const measured = measuredRow(view, row.loaded);
    return {
        state,
        ref: measured ? layerRef(engine, "row") : undefined,
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
 * The cells a row renders, with their columns and values: one per rendered column, but a cell
 * spanning columns (a column's `colSpan`, Epic #85) stands for the ones it covers.
 */
export function useCells<TRow = unknown>(row: RowInfo<TRow>): CellInfo<TRow>[] {
    const view = useGridView<TRow>();
    const { group, meta } = row;
    return cellsOf(view, row.rowIndex, (columnIndex, column) => ({
        rowIndex: row.rowIndex,
        columnIndex,
        column,
        row: row.row,
        loaded: row.loaded,
        value: group
            ? groupCellValue(group, column)
            : row.row === undefined
              ? undefined
              : cellValue(column, row.row, row.rowIndex),
        group,
        meta,
    }));
}

/**
 * A row's cells (a body row's or a summary row's), each made from its column: one per rendered
 * column, but a cell spanning columns (Epic #85) stands for the ones it covers (`rowColumns`).
 */
function cellsOf<TRow, Cell>(
    view: GridView<TRow, ReactNode>,
    rowIndex: number,
    cell: (columnIndex: number, column: Column<TRow>) => Cell,
): Cell[] {
    return rowColumns(view, rowIndex).flatMap((columnIndex) => {
        const column = view.columnDefs[columnIndex];
        return column ? [cell(columnIndex, column)] : [];
    });
}

/**
 * The props a body cell and a header cell share, in one record: the roving tab stop, ARIA,
 * `data-*` and their structural style. A cell that scrolls is positioned in its row (from its
 * inline start); a pinned one is in the row's flow, `sticky`: the browser's scrolling keeps it in
 * place, at the inline start inset the engine writes (it is the engine's, like a layer's
 * transform). In a `measured` row (Epic #86) every cell is in its row's one grid area, at its
 * inline start margin, as tall as the row's tallest cell (no height of its own).
 */
function cellProps<TRow>(
    view: GridView<TRow, ReactNode>,
    part: CellPart | HeaderCellPart | SummaryCellPart,
    box: {
        readonly left: number;
        readonly width: number;
        readonly height: number;
    },
    measured = false,
): PartHookResult<unknown>["props"] {
    const { state } = part;
    // a header cell's state is the one with a `group` (its sort comes with it), a summary row
    // cell's the one with a `position`
    const header = "group" in state ? state : undefined;
    const summary = "position" in state ? state.position : undefined;
    const ariaSort = "ariaSort" in part ? part.ariaSort : undefined;
    const ariaColSpan = "ariaColSpan" in part ? part.ariaColSpan : undefined;
    // a body cell's, cells selectable (Epic #88): in the range, its edges
    const ariaSelected = "ariaSelected" in part ? part.ariaSelected : undefined;
    const range = "rangeEdges" in state ? state : undefined;
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
            "selected-cell": range?.selected,
            "range-edge": range?.rangeEdges,
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

/** A measured row's grid areas (Epic #86): its cells share the first, its detail the one below. */
const CELLS_AREA = "1 / 1";
const DETAIL_AREA = "2 / 1";

/**
 * A body cell's state, and the props for its element: the roving tab stop, ARIA, `data-*`. A cell
 * spanning columns (Epic #85) is as wide as them, with `aria-colspan`.
 */
export function useCell<TRow>(cell: CellInfo<TRow>): PartHookResult<CellState> {
    const { state, props } = useCellPart(cell);
    return { state, props };
}

/** `useCell`, and how many columns the cell spans (a table cell's `colSpan`). */
export function useCellPart<TRow>(
    cell: CellInfo<TRow>,
): PartHookResult<CellState> & { columnSpan: number; measured: boolean } {
    const view = useGridView<TRow>();
    return cellPartProps(
        view,
        cellPart(view, cell),
        cell,
        undefined,
        measuredRow(view, cell.loaded),
    );
}

/**
 * A body or summary row cell's part as a hook returns it, with its span: its state, its props
 * (`cellProps`) on its box in its row, `height` tall (default: its row's own height), or in a
 * `measured` row as tall as its row's tallest cell.
 */
function cellPartProps<TRow, P extends CellPart | SummaryCellPart>(
    view: GridView<TRow, ReactNode>,
    part: P,
    cell: { readonly rowIndex: number; readonly columnIndex: number },
    height?: number,
    measured = false,
): PartHookResult<P["state"]> & { columnSpan: number; measured: boolean } {
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
 * A row's detail (M3): its state, and the props for its element (render it only while
 * `state.expanded`). It is one cell of its row spanning every column (M4: no row count or index changes),
 * in the row's flow below its cells, sticky at the view's start (the engine writes its `left`),
 * as wide as the visible area.
 */
export function useRowDetail<TRow>(
    row: RowInfo<TRow>,
): PartHookResult<RowDetailState> {
    const view = useGridView<TRow>();
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
                                    ? { alignSelf: "flex-start" }
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

/** The header rows a render shows, the top one first (none without a header). */
export function useHeaderRows<
    TRow = unknown,
>(): readonly HeaderRowInfo<TRow>[] {
    return useGridView<TRow>().headerRows;
}

/**
 * A header row: the given one, else the one rendering (inside `DataGrid.HeaderRows` or
 * `DataGrid.HeaderRow`), else the last (a grid without groups has only that one).
 */
export function useHeaderRowOf<TRow>(
    row?: HeaderRowInfo<TRow>,
): HeaderRowInfo<TRow> | undefined {
    const view = useGridView<TRow>();
    // the header row that provides it was rendered for this grid's row type
    const rendering = useContext(
        HeaderRowContext,
    ) as HeaderRowInfo<TRow> | null;
    return row ?? rendering ?? view.headerRows[view.headerRows.length - 1];
}

/**
 * The header cells a render shows in a header row: the given one, else the one rendering (inside
 * `DataGrid.HeaderRow`), else the last (a grid without groups has only that one).
 */
export function useHeaderCells<TRow = unknown>(
    row?: HeaderRowInfo<TRow>,
): readonly HeaderCellInfo<TRow>[] {
    return useHeaderRowOf(row)?.cells ?? [];
}

/**
 * What a header cell shows by default (`DataGrid.HeaderCell` without children): its group's or
 * its column's `renderHeaderCell`, else its `name`. An app that adds its own content to a header
 * cell (a resizer) writes it first: `{headerCellContent(cell)}<Resizer cell={cell} />`.
 */
export function headerCellContent<TRow>(cell: HeaderCellInfo<TRow>): ReactNode {
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

/** A header cell's state, and the props for its element. */
export function useHeaderCell<TRow>(
    cell: HeaderCellInfo<TRow>,
): PartHookResult<HeaderCellState> {
    const view = useGridView<TRow>();
    const part = headerCellPart(view, cell);
    return {
        state: part.state,
        // at its row's top: a cell spanning rows reaches down past it
        props: cellProps(view, part, headerCellBox(view, cell)),
    };
}

/**
 * A column resizer (Epic #70, W3): the state and props of a handle the app renders inside a
 * header cell (a column's, or a group's, which resizes its columns together). The props make it
 * a vertical separator whose values are widths in pixels, marked for the engine, which drags it,
 * resizes with its arrows and fits its columns to their content on a double click or Enter
 * (Epic #80). `state.width` and `aria-valuenow` are the width on screen. Its place, look and name (`aria-label`)
 * are the app's: it has no style of its own. Under a cell whose columns do not resize
 * (`state.resizable` false) it has no props: render none there.
 */
export function useColumnResizer<TRow>(
    cell: HeaderCellInfo<TRow>,
): PartHookResult<ColumnResizerState> {
    const view = useGridView<TRow>();
    const { state, tabIndex, attributes } = columnResizerPart(view, cell);
    if (!state.resizable) return { state, props: { style: {} } };
    return {
        state,
        props: {
            ...attributes,
            tabIndex,
            ...dataAttributes({
                "grid-part": "column-resizer",
                resizing: state.resizing,
            }),
            style: {},
        },
    };
}

/**
 * A row's drag handle (Epic #86): the state and props of an element the app renders in a row (a
 * cell of it; `row` is a row's or a cell's info), which drags the row once a press on it moves
 * past a click's slop, while the grid's rows move (`onRowMove` on `DataGrid.Root`), it is not
 * sorted and the row is loaded (`state.reorderable`; else a press is a plain press: render it
 * disabled, or none). The props mark it for the engine and hide it from assistive technologies:
 * the keys move a row from its cells (Ctrl/⌘+Shift+↑/↓). `data-reorderable` while a press on it
 * can drag its row, `data-dragging` while a drag on it is moving its row. Its look, cursor and `touch-action: none` are the app's: it has
 * no style of its own.
 */
export function useRowDragHandle(row: {
    readonly rowIndex: number;
    readonly loaded: boolean;
}): PartHookResult<RowDragHandleState> {
    const view = useGridView();
    const { state, attributes } = rowDragHandlePart(
        view,
        row.rowIndex,
        row.loaded,
    );
    return {
        state,
        props: {
            ...attributes,
            ...dataAttributes({
                "grid-part": "row-drag-handle",
                reorderable: state.reorderable,
                dragging: state.dragging,
            }),
            style: {},
        },
    };
}

/**
 * A row group's toggle (Epic #87): the state and props of a control the app renders in a group
 * row (or a row that expands; `row` is a row's or a cell's info), which expands and collapses it:
 * a click on it runs `row-groups.toggle` (the engine's, after the app's own `onClick`; a control of
 * its cell, never a sort or a selection). The props are its `aria-expanded` and its mark; its
 * element (a `button`), name (`aria-label`), look and place are the app's. Under a row that does
 * not expand (`state.expandable` false) it has no props: render none there.
 */
export function useGroupToggle(row: {
    readonly rowIndex: number;
    /** the row's kind as read (a row's or a cell's info carries it): not read again */
    readonly meta?: RowMeta | undefined;
}): PartHookResult<GroupToggleState> {
    const view = useGridView();
    const { state, attributes } = groupTogglePart(
        view,
        row.rowIndex,
        "meta" in row ? { meta: row.meta } : undefined,
    );
    if (!attributes) return { state, props: { style: {} } };
    return {
        state,
        props: {
            ...attributes,
            ...dataAttributes({
                "grid-part": "group-toggle",
                expanded: state.expanded,
            }),
            style: {},
        },
    };
}

/** The state of a group's label: the key of the header cell it labels. */
export interface GroupLabelState {
    readonly groupKey: string;
}

/**
 * A group's label (Epic #85, E1.3): the props of an element the app renders inside a group's
 * header cell (its name, its toggle), which stays in view while the group scrolls: sticky in the
 * cell, at the start of the columns that scroll (right of the pinned ones), within the cell's box,
 * so it never leaves its group. The engine writes its inline start inset (`left`, `right` right to
 * left), never React: give it no inset of your own. It must be narrower than its cell (an
 * `inline-block`, a flex item): only then is there room to move, and nothing between it and the
 * cell may clip (`overflow` other than `visible` or `clip`). In a pinned group it stays where it is.
 */
export function useGroupLabel<TRow>(
    cell: HeaderCellInfo<TRow>,
): PartHookResult<GroupLabelState> {
    const { engine } = useRootGrid();
    return {
        state: { groupKey: cell.key },
        props: {
            ref: layerRef(engine, "label"),
            [GROUP_LABEL_ATTRIBUTE]: cell.key,
            ...dataAttributes({ "grid-part": "group-label" }),
            style: { position: "sticky" },
        },
    };
}

/**
 * A position's summary rows (Epic #86), the first one first: `position`'s, else the ones of the
 * `DataGrid.Summary` around. None while the grid has none there.
 */
export function useSummaryRows(
    position?: SummaryPosition,
): readonly SummaryRowInfo[] {
    const view = useGridView();
    const around = useContext(SummaryContext);
    const at = position ?? around;
    const { summaryRows, rowCount, header } = view;
    const rows = useMemo(
        () => at && summaryRowsOf({ summaryRows, rowCount, header }, at),
        [summaryRows, rowCount, header, at],
    );
    if (!rows) {
        throw new Error(
            "useSummaryRows() must be given a position, or be used inside <DataGrid.Summary>",
        );
    }
    return rows;
}

/**
 * A summary row's state, and the props for its element (Epic #86): ARIA (`role="row"`, its
 * `aria-rowindex` after the header's or the body's rows), `data-summary`, and its structural
 * style in its `DataGrid.Summary` (from `rowLeft`, a summary row tall; a flex container with pinned
 * columns, as a body row).
 */
export function useSummaryRow<TRow>(
    row: SummaryRowInfo,
): PartHookResult<SummaryRowState> {
    const view = useGridView<TRow>();
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
 * The cells a summary row renders, with their columns: one per rendered column, but a cell
 * spanning columns (a column's `colSpan` asked with `type: "summary"`) stands for the ones it
 * covers. The given row, else the one rendering (inside `DataGrid.SummaryRow`).
 */
export function useSummaryCells<TRow = unknown>(
    row?: SummaryRowInfo,
): SummaryCellInfo<TRow>[] {
    const view = useGridView<TRow>();
    const rendering = useContext(SummaryRowContext);
    const at = row ?? rendering;
    if (!at) {
        throw new Error(
            "useSummaryCells() must be given a row, or be used inside <DataGrid.SummaryRow>",
        );
    }
    return cellsOf(view, at.rowIndex, (columnIndex, column) => ({
        rowIndex: at.rowIndex,
        columnIndex,
        column,
        position: at.position,
        summaryIndex: at.summaryIndex,
    }));
}

/**
 * A summary row's cell's state, and the props for its element (Epic #86): a body cell's (the
 * roving tab stop, ARIA, pinned and spanning as one), `data-summary`, a summary row tall.
 */
export function useSummaryCell<TRow>(
    cell: SummaryCellInfo<TRow>,
): PartHookResult<SummaryCellState> {
    const { state, props } = useSummaryCellPart(cell);
    return { state, props };
}

/** `useSummaryCell`, and how many columns the cell spans (a table cell's `colSpan`). */
export function useSummaryCellPart<TRow>(
    cell: SummaryCellInfo<TRow>,
): PartHookResult<SummaryCellState> & {
    columnSpan: number;
    measured: boolean;
} {
    const view = useGridView<TRow>();
    return cellPartProps(
        view,
        summaryCellPart(view, cell),
        cell,
        view.summaryRowHeight,
    );
}
