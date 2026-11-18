import type {
    DataGridEngine,
    DataGridFeatures,
    DataGridModel,
    GridCellInfo,
    GridHandle,
    GridRowInfo,
    GridView,
    HeaderCellLayout,
    HeaderRowView,
    SummaryPosition,
    SummaryRowView,
} from "@fragiola/data-grid";
import {
    type InjectionKey,
    inject,
    onScopeDispose,
    type ShallowRef,
    shallowRef,
    type VNodeChild,
} from "vue";

/**
 * What `useDataGrid()` returns: the grid's model and its engine (column renderers return vnodes).
 * The model's keys are the core's and the installed features' (`TFeatures`; left out, a grid of
 * any features).
 */
export interface DataGridContextValue<
    TRow = unknown,
    TFeatures extends DataGridFeatures = DataGridFeatures,
> {
    model: DataGridModel<TRow, VNodeChild, TFeatures>;
    engine: DataGridEngine<TRow, VNodeChild>;
}

/**
 * A handle on a grid from outside its `DataGrid.Root`: `current` is the grid's model and engine
 * while a `Root` holds it (`<DataGrid.Root :grid-ref="gridRef">`), `null` otherwise. Unlike a
 * template ref it tells when that changes, so composables take it (`useRowWindow(gridRef)`,
 * `useDataGrid(gridRef)`) and follow the grid from anywhere. Its model's keys are the core's and
 * the features' it is typed with (left out, a grid of any features: any ref fits).
 */
export type DataGridRef<
    TRow = unknown,
    TFeatures extends DataGridFeatures = DataGridFeatures,
> = GridHandle<DataGridContextValue<TRow, TFeatures>>;

/** A body row, as `DataGrid.Rows` hands it to its slot. */
export type RowInfo<TRow = unknown> = GridRowInfo<TRow>;

/** A body cell, as `DataGrid.Cells` hands it to its slot: its renderers return vnodes. */
export type CellInfo<TRow = unknown> = GridCellInfo<TRow, VNodeChild>;

/**
 * A header cell, as `DataGrid.HeaderCells` hands it to its slot: a group (`group`) or a column
 * (`column`), its row, its first column and its spans.
 */
export type HeaderCellInfo<TRow = unknown> = HeaderCellLayout<TRow, VNodeChild>;

/** A header row, as `DataGrid.HeaderRows` hands it to its slot: its index and its cells. */
export type HeaderRowInfo<TRow = unknown> = HeaderRowView<TRow, VNodeChild>;

/** What a `DataGrid.Root` provides: its model and engine, and the view the engine reports. */
export interface GridContext extends DataGridContextValue {
    /** the view: a part re-renders when it changes (a new window, new sizes), never per scroll */
    readonly view: Readonly<ShallowRef<GridView<unknown, VNodeChild>>>;
}

export const GridKey: InjectionKey<GridContext> = Symbol("DataGrid");

/** The row a part renders in (`DataGrid.Cells`, `DataGrid.Cell`): a getter of its latest info. */
export const RowKey: InjectionKey<(() => RowInfo) | null> =
    Symbol("DataGridRow");

/** The header row a part renders in (`DataGrid.HeaderRow`, `DataGrid.HeaderCells`). */
export const HeaderRowKey: InjectionKey<
    (() => HeaderRowInfo | undefined) | null
> = Symbol("DataGridHeaderRow");

/**
 * The summary rows' position a part renders in (`Summary`, `SummaryRows`: the summary rows
 * feature's, `/summary-rows`); a root provides none, so a grid nested in one starts outside.
 */
export const SummaryKey: InjectionKey<(() => SummaryPosition) | null> =
    Symbol("DataGridSummary");

/** The summary row a part renders in (`SummaryRow`, `SummaryCells`, from `/summary-rows`). */
export const SummaryRowKey: InjectionKey<(() => SummaryRowView) | null> =
    Symbol("DataGridSummaryRow");

/**
 * Whether the grid is a table (`DataGrid.Grid` rendered `as="table"`): the parts it holds take a
 * table's structure (`DataGrid.Empty`'s row and area).
 */
export const TableKey: InjectionKey<boolean> = Symbol("DataGridTable");

/** What a part, or `useDataGrid()` without a ref, throws outside a `Root`. */
const OUTSIDE_ROOT = "useDataGrid() must be used inside <DataGrid.Root>";

/** The `Root` around a part: its model, engine and view (a part never follows a `gridRef`). */
export function useRootGrid(): GridContext {
    const grid = inject(GridKey, null);
    if (!grid) throw new Error(OUTSIDE_ROOT);
    return grid;
}

/** The view of the `Root` around, typed by the row type the part states. */
export function useGridView<TRow = unknown>(): Readonly<
    ShallowRef<GridView<TRow, VNodeChild>>
> {
    const grid = inject(GridKey, null);
    if (!grid) {
        throw new Error("useGridView() must be used inside <DataGrid.Root>");
    }
    // the root that provides it was given the row type
    return grid.view as unknown as Readonly<
        ShallowRef<GridView<TRow, VNodeChild>>
    >;
}

/** The row a part renders in (`DataGrid.Cells`, `DataGrid.Cell`). */
export function useRowContext<TRow = unknown>(
    part: string,
): () => RowInfo<TRow> {
    const row = inject(RowKey, null);
    if (!row) {
        throw new Error(
            `<DataGrid.${part}> must be used inside <DataGrid.Row>`,
        );
    }
    return row as () => RowInfo<TRow>;
}

/** The grid a ref holds, following it as `Root`s take and release it. */
export function useGridRefCurrent<TRow>(
    gridRef: DataGridRef<TRow>,
): Readonly<ShallowRef<DataGridContextValue<TRow> | null>> {
    const current = shallowRef(gridRef.current);
    onScopeDispose(
        gridRef.subscribe(() => {
            current.value = gridRef.current;
        }),
    );
    return current;
}

/**
 * The grid a composable reads: the one a `gridRef` holds when it is given one (`null` until a
 * `Root` takes it), else the `Root` around the component's; throws `outside` without either.
 */
export function useGrid<TRow>(
    gridRef: DataGridRef<TRow> | undefined,
    outside: string,
): Readonly<ShallowRef<DataGridContextValue<TRow> | null>> {
    if (gridRef) return useGridRefCurrent(gridRef);
    const grid = inject(GridKey, null);
    if (!grid) throw new Error(outside);
    // the `Root` that provides it was given the row type the composable states
    return shallowRef(grid as unknown as DataGridContextValue<TRow>);
}

/**
 * The grid's model and engine, typed by the row type and the features the app passes
 * (`useDataGrid<Person, typeof features>()`: a feature's keys compile only when it is listed). An
 * injection cannot carry a generic: the `Root` that provides it was given them, so the
 * composable states them. Call it in `setup`.
 *
 * With a `gridRef`, it works outside the `Root` too: a ref of the grid that ref's `Root` holds,
 * or `null` until one does; typed as the ref is.
 */
export function useDataGrid<
    TRow = unknown,
    TFeatures extends DataGridFeatures = [],
>(): DataGridContextValue<TRow, TFeatures>;
export function useDataGrid<
    TRow,
    TFeatures extends DataGridFeatures = DataGridFeatures,
>(
    gridRef: DataGridRef<TRow, TFeatures>,
): Readonly<ShallowRef<DataGridContextValue<TRow, TFeatures> | null>>;
export function useDataGrid<TRow>(
    gridRef?: DataGridRef<TRow>,
):
    | DataGridContextValue<TRow>
    | Readonly<ShallowRef<DataGridContextValue<TRow> | null>> {
    if (gridRef) return useGridRefCurrent(gridRef);
    const { model, engine } = useRootGrid();
    // the `Root` that provides it was given the row type the composable states
    return { model, engine } as unknown as DataGridContextValue<TRow>;
}
