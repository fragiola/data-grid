import type {
    Column as CoreColumn,
    ColumnGroup as CoreColumnGroup,
    DataGridEngine,
    DataGridModel,
    GridView,
    HeaderCellLayout,
    HeaderRowView,
} from "@fragiola/data-grid";
import { createContext, type ReactNode, useContext } from "react";
import { type DataGridRef, useGridRefCurrent } from "./gridRef";

/** A column of a React grid: its renderers return React nodes. One generic, the row type (D10). */
export type Column<TRow> = CoreColumn<TRow, ReactNode>;

/** Columns grouped under a header cell of their own: groups nest to any depth (Epic #13). */
export type ColumnGroup<TRow> = CoreColumnGroup<TRow, ReactNode>;

/** An entry of `columns`: a column, or a group of them. */
export type ColumnOrGroup<TRow> = Column<TRow> | ColumnGroup<TRow>;

/** What `useDataGrid()` returns: the grid's model and its engine. */
export interface DataGridContextValue<TRow = unknown> {
    model: DataGridModel<TRow, ReactNode>;
    engine: DataGridEngine<TRow, ReactNode>;
}

/** A body row, as `DataGrid.Rows` hands it to its children. */
export interface RowInfo<TRow = unknown> {
    readonly rowIndex: number;
    /** `undefined` while the row is not loaded */
    readonly row: TRow | undefined;
    readonly loaded: boolean;
    /** the row's key: `rowKey(row, index)`, or its index */
    readonly key: string | number;
}

/** A body cell, as `DataGrid.Cells` hands it to its children. */
export interface CellInfo<TRow = unknown> {
    readonly rowIndex: number;
    readonly columnIndex: number;
    readonly column: Column<TRow>;
    /** `undefined` while the row is not loaded */
    readonly row: TRow | undefined;
    readonly loaded: boolean;
    /** `column.getValue(row)`, or `row[column.key]`; `undefined` while the row is not loaded */
    readonly value: unknown;
}

/**
 * A header cell, as `DataGrid.HeaderCells` hands it to its children: a group (`group`) or a
 * column (`column`), its row, its first column and its spans.
 */
export type HeaderCellInfo<TRow = unknown> = HeaderCellLayout<TRow, ReactNode>;

/** A header row, as `DataGrid.HeaderRows` hands it to its children: its index and its cells. */
export type HeaderRowInfo<TRow = unknown> = HeaderRowView<TRow, ReactNode>;

export const DataGridContext = createContext<DataGridContextValue | null>(null);

export const RowContext = createContext<RowInfo | null>(null);

/** The header row a part renders in (`DataGrid.HeaderRow`, `DataGrid.HeaderCells`). */
export const HeaderRowContext = createContext<HeaderRowInfo | null>(null);

/**
 * The view the engine reports, read once by the root and handed down: a part re-renders when it
 * changes, even under a parent that did not.
 */
export const ViewContext = createContext<GridView<unknown, ReactNode> | null>(
    null,
);

/**
 * The grid a hook reads: the one a `gridRef` holds when it is given one (`null` until a `Root`
 * takes it), else the `Root` around the component's (`null` outside one).
 */
export function useGrid<TRow>(
    gridRef: DataGridRef<TRow> | undefined,
): DataGridContextValue<TRow> | null {
    const fromRoot = useContext(DataGridContext);
    const fromRef = useGridRefCurrent(gridRef);
    if (gridRef) return fromRef;
    // the `Root` that provides it was given the row type the hook states
    return fromRoot as unknown as DataGridContextValue<TRow> | null;
}

/**
 * The grid's model and engine, typed by the row type the app passes. A context cannot carry a
 * generic: the `Root` that provides it was given that row type, so the hook states it.
 *
 * With a `gridRef`, it works outside the `Root` too: the grid that ref's `Root` holds, or `null`
 * until one does.
 */
export function useDataGrid<TRow = unknown>(): DataGridContextValue<TRow>;
export function useDataGrid<TRow>(
    gridRef: DataGridRef<TRow>,
): DataGridContextValue<TRow> | null;
export function useDataGrid<TRow>(
    gridRef?: DataGridRef<TRow>,
): DataGridContextValue<TRow> | null {
    const grid = useGrid(gridRef);
    if (!grid && !gridRef) {
        throw new Error("useDataGrid() must be used inside <DataGrid.Root>");
    }
    return grid;
}

/** The row a part renders in (`DataGrid.Cells`, `DataGrid.Cell`). */
export function useRowContext<TRow = unknown>(part: string): RowInfo<TRow> {
    const value = useContext(RowContext);
    if (!value) {
        throw new Error(
            `<DataGrid.${part}> must be used inside <DataGrid.Row>`,
        );
    }
    return value as RowInfo<TRow>;
}
