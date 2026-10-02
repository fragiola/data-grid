import {
    type AxisWindow,
    ariaRowIndex,
    cellValue,
    columnLeft,
    type GridView,
    renderedWidth,
    rowAt,
    rowTop,
} from "@fragiola/data-grid";
import type * as React from "react";
import { type ReactNode, useContext, useEffect, useState } from "react";
import {
    type CellInfo,
    type HeaderCellInfo,
    type RowInfo,
    useDataGrid,
    ViewContext,
} from "./context";
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

function useWindow(event: "row-window" | "column-window"): AxisWindow {
    const { engine } = useDataGrid();
    const [value, setValue] = useState(() => engine.get(event));
    useEffect(() => {
        setValue(engine.get(event));
        return engine.subscribe(event, setValue);
    }, [engine, event]);
    return value;
}

/** The rows in view and rendered; re-renders when either range changes (e.g. to show them). */
export function useRowWindow(): AxisWindow {
    return useWindow("row-window");
}

/** The columns in view and rendered; re-renders when either range changes. */
export function useColumnWindow(): AxisWindow {
    return useWindow("column-window");
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
            }),
            style: {
                position: "absolute",
                top: rowTop(view, row.rowIndex),
                left: 0,
                width: renderedWidth(view),
                height: view.rowAxis.sizeOf(row.rowIndex),
                boxSizing: "border-box",
            },
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

/** The state of a body cell. */
export interface CellState {
    readonly rowIndex: number;
    readonly columnIndex: number;
    readonly loaded: boolean;
    /** it is the active cell (the one the keyboard moves) */
    readonly active: boolean;
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
    return {
        state: {
            rowIndex: cell.rowIndex,
            columnIndex: cell.columnIndex,
            loaded: cell.loaded,
            active,
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
            }),
            style: {
                position: "absolute",
                top: 0,
                left: columnLeft(view, cell.columnIndex),
                width: view.columnAxis.sizeOf(cell.columnIndex),
                height: view.rowAxis.sizeOf(cell.rowIndex),
                boxSizing: "border-box",
            },
        },
    };
}

/** The header cells a render shows. */
export function useHeaderCells<TRow = unknown>(): HeaderCellInfo<TRow>[] {
    const view = useGridView<TRow>();
    return view.columns.flatMap((columnIndex) => {
        const column = view.columnDefs[columnIndex];
        return column ? [{ columnIndex, column }] : [];
    });
}

/** The state of a header cell. */
export interface HeaderCellState {
    readonly columnIndex: number;
    /** it is the active cell */
    readonly active: boolean;
}

/** A header cell's state, and the props for its element. */
export function useHeaderCell<TRow>(cell: HeaderCellInfo<TRow>): {
    state: HeaderCellState;
    props: Record<string, unknown> & { style: React.CSSProperties };
} {
    const view = useGridView<TRow>();
    const active =
        view.active?.rowIndex === -1 &&
        view.active.columnIndex === cell.columnIndex;
    return {
        state: { columnIndex: cell.columnIndex, active },
        props: {
            role: "columnheader",
            "aria-colindex": cell.columnIndex + 1,
            tabIndex: active ? 0 : -1,
            ...dataAttributes({
                "grid-part": "header-cell",
                "row-index": -1,
                "column-index": cell.columnIndex,
                active,
            }),
            style: {
                position: "absolute",
                top: 0,
                left: columnLeft(view, cell.columnIndex),
                width: view.columnAxis.sizeOf(cell.columnIndex),
                height: view.headerHeight,
                boxSizing: "border-box",
            },
        },
    };
}
