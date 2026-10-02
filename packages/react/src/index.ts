// @fragiola/data-grid-react: composable, unstyled React primitives over @fragiola/data-grid.

export type {
    AxisWindow,
    CellPosition,
    DataGridEngine,
    DataGridModel,
    Range,
    RowKeyGetter,
    Size,
} from "@fragiola/data-grid";
export {
    type CellInfo,
    type Column,
    type DataGridContextValue,
    type HeaderCellInfo,
    type RowInfo,
    useDataGrid,
} from "./context";
export {
    type CellState,
    type HeaderCellState,
    type RowState,
    useCell,
    useCells,
    useColumnWindow,
    useGridView,
    useHeaderCell,
    useHeaderCells,
    useRow,
    useRows,
    useRowWindow,
} from "./hooks";
export type {
    BodyProps,
    CellProps,
    CellsProps,
    GridProps,
    GridState,
    HeaderCellProps,
    HeaderCellsProps,
    HeaderProps,
    HeaderRowProps,
    RootProps,
    RootState,
    RowProps,
    RowsProps,
} from "./parts";
export * as DataGrid from "./parts";
export type {
    DivPrimitiveProps,
    PrimitiveProps,
    RenderedProps,
    RenderProp,
} from "./utils/useRender";
