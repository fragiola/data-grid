import type {
    CellEdit,
    Column as CoreColumn,
    ColumnGroup as CoreColumnGroup,
    DataGridEngine,
    DataGridModel,
    GridView,
    GroupRow,
    HeaderCellLayout,
    HeaderRowView,
    RowMeta,
    SummaryPosition,
    SummaryRowView,
} from "@fragiola/data-grid";
import { createContext, type ReactNode, useContext } from "react";
import { type DataGridRef, useGridRefCurrent } from "./gridRef";

/** A column of a React grid: its renderers return React nodes. One generic, the row type (D10). */
export type Column<TRow> = CoreColumn<TRow, ReactNode>;

/** Columns grouped under a header cell of their own: groups nest to any depth (Epic #13). */
export type ColumnGroup<TRow> = CoreColumnGroup<TRow, ReactNode>;

/** An entry of `columns`: a column, or a group of them. */
export type ColumnOrGroup<TRow> = Column<TRow> | ColumnGroup<TRow>;

/**
 * An edit committed (Epic #88, E4.3), as `onCellEdit` tells it: the cell, its column's key, the
 * value, and the row (loaded: a cell is edited only then), which the app writes it into.
 */
export interface CellEditEvent<TRow> extends CellEdit {
    readonly row: TRow;
}

/** What `useDataGrid()` returns: the grid's model and its engine. */
export interface DataGridContextValue<TRow = unknown> {
    model: DataGridModel<TRow, ReactNode>;
    engine: DataGridEngine<TRow, ReactNode>;
}

/** A body row, as `DataGrid.Rows` hands it to its children. */
export interface RowInfo<TRow = unknown> {
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

/** A body cell, as `DataGrid.Cells` hands it to its children. */
export interface CellInfo<TRow = unknown> {
    readonly rowIndex: number;
    readonly columnIndex: number;
    readonly column: Column<TRow>;
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

/**
 * A header cell, as `DataGrid.HeaderCells` hands it to its children: a group (`group`) or a
 * column (`column`), its row, its first column and its spans.
 */
export type HeaderCellInfo<TRow = unknown> = HeaderCellLayout<TRow, ReactNode>;

/** A header row, as `DataGrid.HeaderRows` hands it to its children: its index and its cells. */
export type HeaderRowInfo<TRow = unknown> = HeaderRowView<TRow, ReactNode>;

/**
 * A summary row (Epic #86), as `DataGrid.SummaryRows` hands it to its children: its row index, its
 * position and its index among its position's rows.
 */
export type SummaryRowInfo = SummaryRowView;

/** A summary row's cell, as `DataGrid.SummaryCells` hands it to its children. */
export interface SummaryCellInfo<TRow = unknown> {
    readonly rowIndex: number;
    readonly columnIndex: number;
    readonly column: Column<TRow>;
    readonly position: SummaryPosition;
    readonly summaryIndex: number;
}

export const DataGridContext = createContext<DataGridContextValue | null>(null);

export const RowContext = createContext<RowInfo | null>(null);

/** The header row a part renders in (`DataGrid.HeaderRow`, `DataGrid.HeaderCells`). */
export const HeaderRowContext = createContext<HeaderRowInfo | null>(null);

/** The summary rows' position a part renders in (`DataGrid.Summary`, `DataGrid.SummaryRows`). */
export const SummaryContext = createContext<SummaryPosition | null>(null);

/** The summary row a part renders in (`DataGrid.SummaryRow`, `DataGrid.SummaryCells`). */
export const SummaryRowContext = createContext<SummaryRowInfo | null>(null);

/**
 * Whether the grid is a table (`DataGrid.Grid` rendered as a `<table>` element): the parts it
 * holds take a table's structure (`DataGrid.Empty`'s row and area).
 */
export const TableContext = createContext(false);

/**
 * The view the engine reports, read once by the root and handed down: a part re-renders when it
 * changes, even under a parent that did not.
 */
export const ViewContext = createContext<GridView<unknown, ReactNode> | null>(
    null,
);

/** What a part, or `useDataGrid()` without a ref, throws outside a `Root`. */
const OUTSIDE_ROOT = "useDataGrid() must be used inside <DataGrid.Root>";

/**
 * The grid a hook reads: the one a `gridRef` holds when it is given one (`null` until a `Root`
 * takes it), else the `Root` around the component's; throws `outside` without either.
 */
export function useGrid<TRow>(
    gridRef: DataGridRef<TRow> | undefined,
    outside: string,
): DataGridContextValue<TRow> | null {
    const fromRoot = useContext(DataGridContext);
    const fromRef = useGridRefCurrent(gridRef);
    if (gridRef) return fromRef;
    if (!fromRoot) throw new Error(outside);
    // the `Root` that provides it was given the row type the hook states
    return fromRoot as unknown as DataGridContextValue<TRow>;
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
    gridRef: DataGridRef<TRow> | undefined,
): DataGridContextValue<TRow> | null;
export function useDataGrid<TRow>(
    gridRef?: DataGridRef<TRow>,
): DataGridContextValue<TRow> | null {
    return useGrid(gridRef, OUTSIDE_ROOT);
}

/** The `Root` around a part: its model and engine (a part never follows a `gridRef`). */
export function useRootGrid<TRow = unknown>(): DataGridContextValue<TRow> {
    const grid = useContext(DataGridContext);
    if (!grid) throw new Error(OUTSIDE_ROOT);
    // the `Root` that provides it was given the row type the part states
    return grid as unknown as DataGridContextValue<TRow>;
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
