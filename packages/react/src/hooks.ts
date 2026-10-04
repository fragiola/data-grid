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
    EMPTY_WINDOW,
    type GridView,
    type HeaderCellPart,
    type HeaderCellState,
    headerCellBox,
    headerCellPart,
    type RowDetailState,
    type RowState,
    renderedWidth,
    rowAt,
    rowDetailPart,
    rowDisplay,
    rowLeft,
    rowPart,
    rowTop,
    rowWidth,
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
    type HeaderCellInfo,
    HeaderRowContext,
    type HeaderRowInfo,
    type RowInfo,
    useGrid,
    useRootGrid,
    ViewContext,
} from "./context";
import { type DataGridRef, noSubscription } from "./gridRef";
import { dataAttributes } from "./utils/useRender";

export type {
    CellState,
    ColumnResizerState,
    HeaderCellState,
    RowDetailState,
    RowState,
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

/** The rows a render shows, with their data and keys. */
export function useRows<TRow = unknown>(): RowInfo<TRow>[] {
    // outside a `Root`, the grid's own error first
    useRootGrid();
    const view = useGridView<TRow>();
    const { rowKey } = view;
    return view.rows.map((rowIndex) => {
        const row = rowAt(view.source, rowIndex);
        return {
            rowIndex,
            row,
            loaded: row !== undefined,
            key: row !== undefined && rowKey ? rowKey(row, rowIndex) : rowIndex,
        };
    });
}

/**
 * A row's structural style (a header row's too, at `top`): in its layer, from `rowLeft`, as wide
 * as its rendered cells (an expanded row, as what holds its detail); with pinned columns, a flex
 * container their sticky cells stack in.
 */
export function rowStyle<TRow>(
    view: GridView<TRow, ReactNode>,
    top: number,
    height: number,
    width: number = renderedWidth(view),
): React.CSSProperties {
    const display = rowDisplay(view);
    return {
        position: "absolute",
        ...(display ? { display } : {}),
        top,
        left: rowLeft(view),
        width,
        height,
        boxSizing: "border-box",
    };
}

/** A body row's state, and the props for its element (ARIA, `data-*`, structural style). */
export function useRow<TRow>(row: RowInfo<TRow>): PartHookResult<RowState> {
    const view = useGridView<TRow>();
    const { state, ariaSelected } = rowPart(view, row.rowIndex, row.loaded);
    return {
        state,
        props: {
            role: "row",
            "aria-rowindex": ariaRowIndex(view, row.rowIndex),
            ...(ariaSelected === undefined
                ? {}
                : { "aria-selected": ariaSelected }),
            ...dataAttributes({
                "grid-part": "row",
                "row-index": row.rowIndex,
                loading: !row.loaded,
                active: state.active,
                expanded: state.expanded,
                selected: state.selected,
            }),
            // an expanded row's box holds its detail, below its cells
            style: rowStyle(
                view,
                rowTop(view, row.rowIndex),
                view.rowAxis.sizeOf(row.rowIndex),
                rowWidth(view, row.rowIndex),
            ),
        },
    };
}

/** The cells a row renders, with their columns and values. */
export function useCells<TRow = unknown>(row: RowInfo<TRow>): CellInfo<TRow>[] {
    const view = useGridView<TRow>();
    return view.columns.flatMap((columnIndex) => {
        const column = view.columnDefs[columnIndex];
        if (!column) return [];
        return [
            {
                rowIndex: row.rowIndex,
                columnIndex,
                column,
                row: row.row,
                loaded: row.loaded,
                value:
                    row.row === undefined
                        ? undefined
                        : cellValue(column, row.row, row.rowIndex),
            },
        ];
    });
}

/**
 * The props a body cell and a header cell share, in one record: the roving tab stop, ARIA,
 * `data-*` and their structural style. A cell that scrolls is positioned in its row; a pinned one
 * is in the row's flow, `sticky`: the browser's scrolling keeps it in place, at the `left` inset
 * the engine writes (it is the engine's, like a layer's transform).
 */
function cellProps(
    part: CellPart | HeaderCellPart,
    box: {
        readonly left: number;
        readonly width: number;
        readonly height: number;
    },
): PartHookResult<unknown>["props"] {
    const { state } = part;
    // a header cell's state is the one with a `group` (its sort comes with it)
    const header = "group" in state ? state : undefined;
    const ariaSort = "ariaSort" in part ? part.ariaSort : undefined;
    const { pinned } = state;
    const { width, height } = box;
    return {
        role: header ? "columnheader" : "gridcell",
        "aria-colindex": state.columnIndex + 1,
        ...(header ? ariaHeaderCellSpans(header) : undefined),
        ...(ariaSort ? { "aria-sort": ariaSort } : undefined),
        tabIndex: part.tabIndex,
        ...dataAttributes({
            "grid-part": header ? "header-cell" : "cell",
            "row-index": state.rowIndex,
            "column-index": state.columnIndex,
            loading: "loaded" in state && !state.loaded,
            active: state.active,
            group: header?.group,
            sortable: header?.sortable,
            sort: header?.sortDirection,
            "sort-priority": header?.sortPriority,
            pinned: pinned ? "start" : undefined,
            "pinned-edge": state.pinnedEdge,
            interacting: state.interacting,
            resizable: header?.resizable,
            resizing: header?.resizing,
        }),
        style: pinned
            ? { position: "sticky", width, height, boxSizing: "border-box" }
            : {
                  position: "absolute",
                  top: 0,
                  left: box.left,
                  width,
                  height,
                  boxSizing: "border-box",
              },
    };
}

/** A body cell's state, and the props for its element: the roving tab stop, ARIA, `data-*`. */
export function useCell<TRow>(cell: CellInfo<TRow>): PartHookResult<CellState> {
    const view = useGridView<TRow>();
    const part = cellPart(view, cell);
    return {
        state: part.state,
        props: cellProps(part, cellBox(view, cell.rowIndex, cell.columnIndex)),
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
    return {
        state,
        props: {
            role: "gridcell",
            ...ariaRowDetail(view),
            ...dataAttributes({
                "grid-part": "row-detail",
                "row-index": row.rowIndex,
            }),
            style: {
                position: "sticky",
                display: "block",
                marginTop: box.top,
                // in a row of pinned cells (flex), from the row's start, never shrunk
                ...(flex ? { marginLeft: box.start, flexShrink: 0 } : {}),
                width: box.width,
                height: box.height,
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
        props: cellProps(part, headerCellBox(view, cell)),
    };
}

/**
 * A column resizer (Epic #70, W3): the state and props of a handle the app renders inside a
 * header cell (a column's, or a group's, which resizes its columns together). The props make it
 * a vertical separator whose values are widths in pixels, marked for the engine, which drags it,
 * resizes with its arrows and resets on a double click. Its place, look and name (`aria-label`)
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
