// @fragiola/data-grid-angular: composable, unstyled Angular directives over @fragiola/data-grid.

// The whole core, so that an Angular app installs and imports one package. A local export would
// silently shadow a core name of the same spelling: tests/exports.test.ts fails on one.
export * from "@fragiola/data-grid";
export type {
    CellContext,
    CellInfo,
    CellTemplateProps,
    DataGridContextValue,
    DataGridRef,
    HeaderCellInfo,
    HeaderRowInfo,
    RowContext,
    RowInfo,
    SummaryContext,
    SummaryRowContext,
    TypedBy,
} from "./lib/context";
// Private to the package's own entry points (the fill handle's element, `/fill`; an editor's
// template, `/editing`; the row features' parts, Epic #151), as Angular's `ɵ` names are: not the
// app's API, they may change in any release.
export {
    DATA_GRID_CELL as ɵDATA_GRID_CELL,
    DATA_GRID_SUMMARY as ɵDATA_GRID_SUMMARY,
    DATA_GRID_SUMMARY_ROW as ɵDATA_GRID_SUMMARY_ROW,
    injectGrid as ɵinjectGrid,
    injectRowContext as ɵinjectRowContext,
} from "./lib/context";
export { DATA_GRID } from "./lib/data-grid";
export { DataGridBind } from "./lib/directives/bind.directive";
export { DataGridBody } from "./lib/directives/body.directive";
export { DataGridCell } from "./lib/directives/cell.directive";
export { DataGridCellContent } from "./lib/directives/cell-content.directive";
export {
    type CellsContext,
    DataGridCells,
} from "./lib/directives/cells.directive";
export { DataGridEmpty } from "./lib/directives/empty.directive";
export { DataGridGrid } from "./lib/directives/grid.directive";
export { DataGridGroupLabel } from "./lib/directives/group-label.directive";
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
    DataGridRows,
    type RowsContext,
} from "./lib/directives/rows.directive";
export { DataGridTemplate } from "./lib/directives/template.directive";
export { createDataGridRef } from "./lib/inject/create-data-grid-ref";
export { injectCell } from "./lib/inject/inject-cell";
export { injectCells } from "./lib/inject/inject-cells";
export { injectColumnWindow } from "./lib/inject/inject-column-window";
export { injectDataGrid, injectGridView } from "./lib/inject/inject-data-grid";
export { injectGroupLabel } from "./lib/inject/inject-group-label";
export { injectHeaderCell } from "./lib/inject/inject-header-cell";
export { injectHeaderCells } from "./lib/inject/inject-header-cells";
export { injectHeaderRows } from "./lib/inject/inject-header-rows";
export { injectRow } from "./lib/inject/inject-row";
export { injectRowWindow } from "./lib/inject/inject-row-window";
export { injectRows } from "./lib/inject/inject-rows";
export {
    type PartInjectResult,
    partResult as ɵpartResult,
    type ValueOrSignal,
    valueNow as ɵvalueNow,
} from "./lib/inject/internal";
export {
    cellBinding as ɵcellBinding,
    withTableSpans as ɵwithTableSpans,
} from "./lib/utils/cell-binding";
export {
    type ContextOf,
    contextOf,
    type DataGridNode,
    type TemplateContent,
    type TemplateContext,
    templateContent,
} from "./lib/utils/content";
export {
    beforeInputs as ɵbeforeInputs,
    bindPart as ɵbindPart,
    injectHost as ɵinjectHost,
} from "./lib/utils/helpers";
export { structuralView as ɵstructuralView } from "./lib/utils/structural";
export { keyedTemplateViews as ɵkeyedTemplateViews } from "./lib/utils/views";
