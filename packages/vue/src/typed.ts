import type { DataGridFeatures } from "@fragiola/data-grid";
import type { BodyProps, BodySlots } from "./components/body";
import type { CellProps, CellSlots } from "./components/cell";
import type { CellsProps, CellsSlots } from "./components/cells";
import type { EmptyProps, EmptySlots } from "./components/empty";
import type { GridProps, GridSlots } from "./components/grid";
import type { HeaderProps, HeaderSlots } from "./components/header";
import type {
    HeaderCellProps,
    HeaderCellSlots,
} from "./components/header-cell";
import type {
    HeaderCellsProps,
    HeaderCellsSlots,
} from "./components/header-cells";
import type { HeaderRowProps, HeaderRowSlots } from "./components/header-row";
import type {
    HeaderRowsProps,
    HeaderRowsSlots,
} from "./components/header-rows";
import type { RootProps, RootSlots } from "./components/root";
import type { RowProps, RowSlots } from "./components/row";
import type { RowsProps, RowsSlots } from "./components/rows";
import * as parts from "./parts";
import type { DataGridComponent } from "./utils/primitive";

/**
 * The `DataGrid` primitives typed by the row type (rows, columns and cells in props and slots)
 * and by the features `Root` installs (their props on `Root`; none by default).
 */
export interface TypedDataGrid<TRow, TFeatures extends DataGridFeatures = []> {
    Root: DataGridComponent<RootProps<TRow, TFeatures>, RootSlots>;
    Grid: DataGridComponent<GridProps, GridSlots>;
    Header: DataGridComponent<HeaderProps, HeaderSlots>;
    HeaderRows: DataGridComponent<HeaderRowsProps, HeaderRowsSlots<TRow>>;
    HeaderRow: DataGridComponent<HeaderRowProps<TRow>, HeaderRowSlots>;
    HeaderCells: DataGridComponent<HeaderCellsProps, HeaderCellsSlots<TRow>>;
    HeaderCell: DataGridComponent<HeaderCellProps<TRow>, HeaderCellSlots>;
    Empty: DataGridComponent<EmptyProps, EmptySlots>;
    Body: DataGridComponent<BodyProps, BodySlots>;
    Rows: DataGridComponent<RowsProps, RowsSlots<TRow>>;
    Row: DataGridComponent<RowProps<TRow>, RowSlots>;
    Cells: DataGridComponent<CellsProps, CellsSlots<TRow>>;
    Cell: DataGridComponent<CellProps<TRow>, CellSlots<TRow>>;
}

/**
 * The `DataGrid` primitives typed by your row type, and by the features `Root` installs: what
 * React writes as type arguments (`<DataGrid.Root<Person>>`, inferred), which a Vue template
 * cannot pass. The same components, typed:
 *
 * ```ts
 * const DataGrid = typedDataGrid<Person>();
 * // <DataGrid.Rows v-slot="{ row }">: row.row is a Person
 *
 * const features = [sorting()] as const;
 * const SortedGrid = typedDataGrid<Person, typeof features>();
 * // <SortedGrid.Root :features="features" :sort-columns="sort">: sorting's props, typed
 * ```
 */
export function typedDataGrid<
    TRow,
    TFeatures extends DataGridFeatures = [],
>(): TypedDataGrid<TRow, TFeatures> {
    // the same components: their types erase the row type and the features, which this restores
    return parts as unknown as TypedDataGrid<TRow, TFeatures>;
}
