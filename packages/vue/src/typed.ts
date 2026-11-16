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
import type { RowDetailProps, RowDetailSlots } from "./components/row-detail";
import type { RowsProps, RowsSlots } from "./components/rows";
import type { SummaryProps, SummarySlots } from "./components/summary";
import type {
    SummaryCellProps,
    SummaryCellSlots,
} from "./components/summary-cell";
import type {
    SummaryCellsProps,
    SummaryCellsSlots,
} from "./components/summary-cells";
import type {
    SummaryRowProps,
    SummaryRowSlots,
} from "./components/summary-row";
import type {
    SummaryRowsProps,
    SummaryRowsSlots,
} from "./components/summary-rows";
import * as parts from "./parts";
import type { DataGridComponent } from "./utils/primitive";

/** The `DataGrid` primitives typed by the row type: rows, columns and cells in props and slots. */
export interface TypedDataGrid<TRow> {
    Root: DataGridComponent<RootProps<TRow>, RootSlots>;
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
    RowDetail: DataGridComponent<RowDetailProps, RowDetailSlots>;
    Summary: DataGridComponent<SummaryProps, SummarySlots>;
    SummaryRows: DataGridComponent<SummaryRowsProps, SummaryRowsSlots>;
    SummaryRow: DataGridComponent<SummaryRowProps, SummaryRowSlots>;
    SummaryCells: DataGridComponent<SummaryCellsProps, SummaryCellsSlots<TRow>>;
    SummaryCell: DataGridComponent<SummaryCellProps<TRow>, SummaryCellSlots>;
}

/**
 * The `DataGrid` primitives typed by your row type: what React writes as a type argument
 * (`<DataGrid.Root<Person>>`, inferred), which a Vue template cannot pass. The same components,
 * typed:
 *
 * ```ts
 * const DataGrid = typedDataGrid<Person>();
 * // <DataGrid.Rows v-slot="{ row }">: row.row is a Person
 * ```
 */
export function typedDataGrid<TRow>(): TypedDataGrid<TRow> {
    // the same components: their types erase the row type, which this restores
    return parts as unknown as TypedDataGrid<TRow>;
}
