// @fragiola/data-grid-angular: composable, unstyled Angular directives over @fragiola/data-grid.

// The whole core, so that an Angular app installs and imports one package. A local export would
// silently shadow a core name of the same spelling: tests/exports.test.ts fails on one.
export * from "@fragiola/data-grid";
export type {
    CellInfo,
    CellTemplateProps,
    DataGridContextValue,
    DataGridRef,
    HeaderCellInfo,
    HeaderRowInfo,
    RowInfo,
    SummaryCellInfo,
    SummaryRowInfo,
    TypedBy,
} from "./lib/context";
export { DATA_GRID } from "./lib/data-grid";
export { DataGridBind } from "./lib/directives/bind.directive";
export { DataGridBody } from "./lib/directives/body.directive";
export { DataGridCell } from "./lib/directives/cell.directive";
export { DataGridCellContent } from "./lib/directives/cell-content.directive";
export {
    type CellEditContext,
    DataGridCellEdit,
} from "./lib/directives/cell-edit.directive";
export {
    type CellsContext,
    DataGridCells,
} from "./lib/directives/cells.directive";
export {
    type ColumnResizerContext,
    DataGridColumnResizer,
} from "./lib/directives/column-resizer.directive";
export { DataGridEmpty } from "./lib/directives/empty.directive";
export { DataGridGrid } from "./lib/directives/grid.directive";
export { DataGridGroupLabel } from "./lib/directives/group-label.directive";
export {
    DataGridGroupToggle,
    type GroupToggleContext,
} from "./lib/directives/group-toggle.directive";
export { DataGridHeader } from "./lib/directives/header.directive";
export { DataGridHeaderCell } from "./lib/directives/header-cell.directive";
export {
    DataGridHeaderCells,
    type HeaderCellsContext,
} from "./lib/directives/header-cells.directive";
export { DataGridHeaderRow } from "./lib/directives/header-row.directive";
export {
    DataGridHeaderRows,
    type HeaderRowsContext,
} from "./lib/directives/header-rows.directive";
export {
    DataGridRoot,
    type RootPropsSource,
    type RootPropsSourceOptions,
    type RootState,
} from "./lib/directives/root.directive";
export { DataGridRow } from "./lib/directives/row.directive";
export {
    DataGridRowDetail,
    type RowDetailContext,
} from "./lib/directives/row-detail.directive";
export { DataGridRowDragHandle } from "./lib/directives/row-drag-handle.directive";
export {
    DataGridRows,
    type RowsContext,
} from "./lib/directives/rows.directive";
export {
    DataGridSummary,
    type SummaryTemplateContext,
} from "./lib/directives/summary.directive";
export { DataGridSummaryCell } from "./lib/directives/summary-cell.directive";
export {
    DataGridSummaryCells,
    type SummaryCellsContext,
} from "./lib/directives/summary-cells.directive";
export { DataGridSummaryRow } from "./lib/directives/summary-row.directive";
export {
    DataGridSummaryRows,
    type SummaryRowsContext,
} from "./lib/directives/summary-rows.directive";
export { DataGridTemplate } from "./lib/directives/template.directive";
export { createDataGridRef } from "./lib/inject/create-data-grid-ref";
export { injectCell } from "./lib/inject/inject-cell";
export { injectCellEdit } from "./lib/inject/inject-cell-edit";
export { injectCells } from "./lib/inject/inject-cells";
export { injectColumnResizer } from "./lib/inject/inject-column-resizer";
export { injectColumnWindow } from "./lib/inject/inject-column-window";
export { injectDataGrid, injectGridView } from "./lib/inject/inject-data-grid";
export { injectGroupLabel } from "./lib/inject/inject-group-label";
export { injectGroupToggle } from "./lib/inject/inject-group-toggle";
export { injectHeaderCell } from "./lib/inject/inject-header-cell";
export { injectHeaderCells } from "./lib/inject/inject-header-cells";
export { injectHeaderRows } from "./lib/inject/inject-header-rows";
export { injectRow } from "./lib/inject/inject-row";
export { injectRowDetail } from "./lib/inject/inject-row-detail";
export { injectRowDragHandle } from "./lib/inject/inject-row-drag-handle";
export { injectRowWindow } from "./lib/inject/inject-row-window";
export { injectRows } from "./lib/inject/inject-rows";
export { injectSummaryCell } from "./lib/inject/inject-summary-cell";
export { injectSummaryCells } from "./lib/inject/inject-summary-cells";
export { injectSummaryRow } from "./lib/inject/inject-summary-row";
export { injectSummaryRows } from "./lib/inject/inject-summary-rows";
export type {
    PartInjectResult,
    ValueOrSignal,
} from "./lib/inject/internal";
export {
    type ContextOf,
    contextOf,
    type DataGridNode,
    type TemplateContent,
    type TemplateContext,
    templateContent,
} from "./lib/utils/content";
// Private to the package's own entry points (the fill handle's element, `/fill`), as Angular's
// `ɵ` names are: not the app's API, they may change in any release.
export { bindPart as ɵbindPart } from "./lib/utils/helpers";
export { structuralView as ɵstructuralView } from "./lib/utils/structural";
