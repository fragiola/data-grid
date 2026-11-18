// @fragiola/data-grid-vue: composable, unstyled Vue primitives over @fragiola/data-grid.

// The whole core, so that a Vue app installs and imports one package. A local export would
// silently shadow a core name of the same spelling: tests/exports.test.ts fails on one.
export * from "@fragiola/data-grid";
export type { BodyProps, BodySlots } from "./components/body";
export type { CellProps, CellSlots } from "./components/cell";
export type { CellsProps, CellsSlots } from "./components/cells";
export type { EmptyProps, EmptySlots } from "./components/empty";
export type { GridProps, GridSlots } from "./components/grid";
export type { HeaderProps, HeaderSlots } from "./components/header";
export type {
    HeaderCellProps,
    HeaderCellSlots,
} from "./components/header-cell";
export type {
    HeaderCellsProps,
    HeaderCellsSlots,
} from "./components/header-cells";
export type { HeaderRowProps, HeaderRowSlots } from "./components/header-row";
export type {
    HeaderRowsProps,
    HeaderRowsSlots,
} from "./components/header-rows";
export type { RootProps, RootSlots, RootState } from "./components/root";
export type { RowProps, RowSlots } from "./components/row";
export type { RowsProps, RowsSlots } from "./components/rows";
export type { PartComposableResult } from "./composables/internal";
export { useCell } from "./composables/use-cell";
export { useCells } from "./composables/use-cells";
export { useColumnWindow } from "./composables/use-column-window";
export {
    createDataGridRef,
    useDataGridRef,
} from "./composables/use-data-grid-ref";
export { useGroupLabel } from "./composables/use-group-label";
export { useHeaderCell } from "./composables/use-header-cell";
export { useHeaderCells } from "./composables/use-header-cells";
export { useHeaderRows } from "./composables/use-header-rows";
export { useRow } from "./composables/use-row";
export { useRowWindow } from "./composables/use-row-window";
export { useRows } from "./composables/use-rows";
export {
    type CellInfo,
    type DataGridContextValue,
    type DataGridRef,
    type HeaderCellInfo,
    type HeaderRowInfo,
    type RowInfo,
    useDataGrid,
    useGridView,
} from "./context";
export * as DataGrid from "./parts";
export { type TypedDataGrid, typedDataGrid } from "./typed";
export type {
    DataGridComponent,
    PrimitiveProps,
    SlotFunction,
} from "./utils/primitive";
export type {
    AsProp,
    RenderSlot,
    RenderSlotProps,
} from "./utils/render";
