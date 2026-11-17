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
export type { RowDetailProps, RowDetailSlots } from "./components/row-detail";
export type { RowsProps, RowsSlots } from "./components/rows";
export type { SummaryProps, SummarySlots } from "./components/summary";
export type {
    SummaryCellProps,
    SummaryCellSlots,
} from "./components/summary-cell";
export type {
    SummaryCellsProps,
    SummaryCellsSlots,
} from "./components/summary-cells";
export type {
    SummaryRowProps,
    SummaryRowSlots,
} from "./components/summary-row";
export type {
    SummaryRowsProps,
    SummaryRowsSlots,
} from "./components/summary-rows";
export type { PartComposableResult } from "./composables/internal";
export { useCell } from "./composables/use-cell";
export { useCellEdit } from "./composables/use-cell-edit";
export { useCells } from "./composables/use-cells";
export { useColumnResizer } from "./composables/use-column-resizer";
export { useColumnWindow } from "./composables/use-column-window";
export {
    createDataGridRef,
    useDataGridRef,
} from "./composables/use-data-grid-ref";
export { useGroupLabel } from "./composables/use-group-label";
export { useGroupToggle } from "./composables/use-group-toggle";
export { useHeaderCell } from "./composables/use-header-cell";
export { useHeaderCells } from "./composables/use-header-cells";
export { useHeaderRows } from "./composables/use-header-rows";
export { useRow } from "./composables/use-row";
export { useRowDetail } from "./composables/use-row-detail";
export { useRowDragHandle } from "./composables/use-row-drag-handle";
export { useRowWindow } from "./composables/use-row-window";
export { useRows } from "./composables/use-rows";
export { useSummaryCell } from "./composables/use-summary-cell";
export { useSummaryCells } from "./composables/use-summary-cells";
export { useSummaryRow } from "./composables/use-summary-row";
export { useSummaryRows } from "./composables/use-summary-rows";
export {
    type CellInfo,
    type DataGridContextValue,
    type DataGridRef,
    type HeaderCellInfo,
    type HeaderRowInfo,
    type RowInfo,
    type SummaryCellInfo,
    type SummaryRowInfo,
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
