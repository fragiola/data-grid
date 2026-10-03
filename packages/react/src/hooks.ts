import {
    type AxisWindow,
    ariaHeaderCellSpans,
    ariaRowDetail,
    ariaRowIndex,
    cellValue,
    columnLeft,
    columnPinning,
    EMPTY_WINDOW,
    type GridView,
    headerCellBox,
    headerCellSort,
    renderedWidth,
    rowAt,
    rowCellsHeight,
    rowDetailBox,
    rowDisplay,
    rowExpanded,
    rowLeft,
    rowTop,
    rowWidth,
    type SortDirection,
    sameCell,
} from "@fragiola/data-grid";
import type * as React from "react";
import {
    type ReactNode,
    useCallback,
    useContext,
    useSyncExternalStore,
} from "react";
import {
    type CellInfo,
    type HeaderCellInfo,
    HeaderRowContext,
    type HeaderRowInfo,
    type RowInfo,
    useDataGrid,
    useGrid,
    ViewContext,
} from "./context";
import type { DataGridRef } from "./gridRef";
import { dataAttributes } from "./utils/useRender";

export { useDataGrid } from "./context";

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
    const grid = useGrid(gridRef);
    if (!grid && !gridRef) {
        throw new Error(
            "a window hook must be used inside <DataGrid.Root>, or be given a gridRef",
        );
    }
    const engine = grid?.engine;
    const subscribe = useCallback(
        (listener: () => void) =>
            engine ? engine.subscribe(event, listener) : () => {},
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
    const { model } = useDataGrid<TRow>();
    const view = useGridView<TRow>();
    return view.rows.map((rowIndex) => {
        const row = rowAt(view.source, rowIndex);
        const rowKey = model.state.rowKey;
        return {
            rowIndex,
            row,
            loaded: row !== undefined,
            key: row !== undefined && rowKey ? rowKey(row, rowIndex) : rowIndex,
        };
    });
}

/** The state of a body row: what its `className`/`style` functions and `render` receive. */
export interface RowState {
    readonly rowIndex: number;
    readonly loaded: boolean;
    /** it holds the active cell */
    readonly active: boolean;
    /** it shows its detail (`DataGrid.RowDetail`): loaded, and its key expanded */
    readonly expanded: boolean;
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
export function useRow<TRow>(row: RowInfo<TRow>): {
    state: RowState;
    props: Record<string, unknown> & { style: React.CSSProperties };
} {
    const view = useGridView<TRow>();
    const state: RowState = {
        rowIndex: row.rowIndex,
        loaded: row.loaded,
        active: view.active?.rowIndex === row.rowIndex,
        expanded: rowExpanded(view, row.rowIndex),
    };
    return {
        state,
        props: {
            role: "row",
            "aria-rowindex": ariaRowIndex(view, row.rowIndex),
            ...dataAttributes({
                "grid-part": "row",
                "row-index": row.rowIndex,
                loading: !row.loaded,
                active: state.active,
                expanded: state.expanded,
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

/**
 * A cell's structural style (a header cell's too). A cell that scrolls is positioned in its row. A
 * pinned one is in the row's flow, `sticky`: the browser's scrolling keeps it in place, at the
 * `left` inset the engine writes (it is the engine's, like a layer's transform).
 */
function cellStyle(
    pinned: boolean,
    left: number,
    width: number,
    height: number,
): React.CSSProperties {
    return pinned
        ? { position: "sticky", width, height, boxSizing: "border-box" }
        : {
              position: "absolute",
              top: 0,
              left,
              width,
              height,
              boxSizing: "border-box",
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

/** The state of a body cell. */
export interface CellState {
    readonly rowIndex: number;
    readonly columnIndex: number;
    readonly loaded: boolean;
    /** it is the active cell (the one the keyboard moves) */
    readonly active: boolean;
    /** its column is pinned at the start: sticky, it stays in view sideways */
    readonly pinned: boolean;
    /** its column is the last pinned one (for a divider or a shadow) */
    readonly pinnedEdge: boolean;
}

/** A body cell's state, and the props for its element: the roving tab stop, ARIA, `data-*`. */
export function useCell<TRow>(cell: CellInfo<TRow>): {
    state: CellState;
    props: Record<string, unknown> & { style: React.CSSProperties };
} {
    const view = useGridView<TRow>();
    const active =
        view.active?.rowIndex === cell.rowIndex &&
        view.active.columnIndex === cell.columnIndex;
    const { pinned, pinnedEdge } = columnPinning(view, cell.columnIndex);
    return {
        state: {
            rowIndex: cell.rowIndex,
            columnIndex: cell.columnIndex,
            loaded: cell.loaded,
            active,
            pinned,
            pinnedEdge,
        },
        props: {
            role: "gridcell",
            "aria-colindex": cell.columnIndex + 1,
            tabIndex: active ? 0 : -1,
            ...dataAttributes({
                "grid-part": "cell",
                "row-index": cell.rowIndex,
                "column-index": cell.columnIndex,
                loading: !cell.loaded,
                active,
                pinned: pinned ? "start" : undefined,
                "pinned-edge": pinnedEdge,
            }),
            style: cellStyle(
                pinned,
                columnLeft(view, cell.columnIndex),
                view.columnAxis.sizeOf(cell.columnIndex),
                // its row's own height: a detail below the cells is not theirs
                rowCellsHeight(view, cell.rowIndex),
            ),
        },
    };
}

/** The state of a row's detail. */
export interface RowDetailState {
    readonly rowIndex: number;
    /** its height: the detail height the grid was given for this row */
    readonly height: number;
}

/**
 * A row's detail (M3): `null` while the row is collapsed; else its state and the props for its
 * element. It is one cell of its row spanning every column (M4: no row count or index changes),
 * in the row's flow below its cells, sticky at the view's start (the engine writes its `left`),
 * as wide as the visible area.
 */
export function useRowDetail<TRow>(row: RowInfo<TRow>): {
    state: RowDetailState;
    props: Record<string, unknown> & { style: React.CSSProperties };
} | null {
    const view = useGridView<TRow>();
    const box = rowDetailBox(view, row.rowIndex);
    if (!box) return null;
    const flex = rowDisplay(view) === "flex";
    return {
        state: { rowIndex: row.rowIndex, height: box.height },
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
 * The header cells a render shows in a header row: the given one, else the one rendering (inside
 * `DataGrid.HeaderRow`), else the last (a grid without groups has only that one).
 */
export function useHeaderCells<TRow = unknown>(
    row?: HeaderRowInfo<TRow>,
): readonly HeaderCellInfo<TRow>[] {
    const view = useGridView<TRow>();
    // the header row that provides it was rendered for this grid's row type
    const rendering = useContext(
        HeaderRowContext,
    ) as HeaderRowInfo<TRow> | null;
    const current =
        row ?? rendering ?? view.headerRows[view.headerRows.length - 1];
    return current?.cells ?? [];
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
    /** its columns are pinned at the start: sticky, it stays in view sideways */
    readonly pinned: boolean;
    /** it ends at the last pinned column (for a divider or a shadow) */
    readonly pinnedEdge: boolean;
}

/** A header cell's state, and the props for its element. */
export function useHeaderCell<TRow>(cell: HeaderCellInfo<TRow>): {
    state: HeaderCellState;
    props: Record<string, unknown> & { style: React.CSSProperties };
} {
    const view = useGridView<TRow>();
    // a column spanning header rows is active on any of them
    const active =
        view.active !== null && sameCell(view.active, cell, view.header.cellAt);
    const group = cell.group !== undefined;
    const box = headerCellBox(view, cell);
    const sort = headerCellSort(view, cell);
    const { pinned, pinnedEdge } = columnPinning(
        view,
        cell.columnIndex,
        cell.columnSpan,
    );
    return {
        state: {
            rowIndex: cell.rowIndex,
            columnIndex: cell.columnIndex,
            columnSpan: cell.columnSpan,
            rowSpan: cell.rowSpan,
            group,
            active,
            sortable: sort.sortable,
            sortDirection: sort.direction,
            sortPriority: sort.priority,
            pinned,
            pinnedEdge,
        },
        props: {
            role: "columnheader",
            "aria-colindex": cell.columnIndex + 1,
            ...ariaHeaderCellSpans(cell),
            // on the first sorted column only (ARIA 1.2: one header at a time)
            ...(sort.ariaSort ? { "aria-sort": sort.ariaSort } : {}),
            tabIndex: active ? 0 : -1,
            ...dataAttributes({
                "grid-part": "header-cell",
                "row-index": cell.rowIndex,
                "column-index": cell.columnIndex,
                active,
                group,
                sortable: sort.sortable,
                sort: sort.direction,
                "sort-priority": sort.priority,
                pinned: pinned ? "start" : undefined,
                "pinned-edge": pinnedEdge,
            }),
            // at its row's top: a cell spanning rows reaches down past it
            style: cellStyle(pinned, box.left, box.width, box.height),
        },
    };
}
