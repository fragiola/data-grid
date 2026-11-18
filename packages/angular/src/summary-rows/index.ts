// @fragiola/data-grid-angular/summary-rows: rows of figures under the header and at the bottom
// edge (Epic #86, E2.1; a feature since Epic #151), for an app that installs only this package:
// the core's (`@fragiola/data-grid/summary-rows`, `summaryRows()`), the root's inputs
// (`[dataGridRoot][dataGridSummaryRows]`), the summary's directives (`*dataGridSummary`,
// `[dataGridSummaryRows]`, `[dataGridSummaryRow]`, `[dataGridSummaryCells]`,
// `[dataGridSummaryCell]`, all in `SUMMARY_ROWS`) and their injection functions. An opt-in entry
// point: the directives never import it, and an app that never installs it never ships it.

import { DataGridSummary } from "./summary.directive";
import { DataGridSummaryCell } from "./summary-cell.directive";
import { DataGridSummaryCells } from "./summary-cells.directive";
import { DataGridSummaryRow } from "./summary-row.directive";
import { DataGridSummaryRows } from "./summary-rows.directive";
import { DataGridSummaryRowsRoot } from "./summary-rows-root.directive";

// the core's props are `SummaryRowsFeatureProps`, as React names them (its `SummaryRowsProps` are
// a primitive's)
export {
    type GridSummaryCellInfo,
    type SummaryRowsProps as SummaryRowsFeatureProps,
    type SummaryRowsTypes,
    type SummaryState,
    summaryCellContent,
    summaryCellPart,
    summaryCellPartOf,
    summaryCellsOf,
    summaryPartOf,
    summaryRowPart,
    summaryRowPartOf,
    summaryRows,
} from "@fragiola/data-grid/summary-rows";
export { injectSummaryCell } from "./inject-summary-cell";
export { injectSummaryCells } from "./inject-summary-cells";
export { injectSummaryRow } from "./inject-summary-row";
export { injectSummaryRows } from "./inject-summary-rows";
export {
    DataGridSummary,
    type SummaryTemplateContext,
} from "./summary.directive";
export { DataGridSummaryCell } from "./summary-cell.directive";
export {
    DataGridSummaryCells,
    type SummaryCellsContext,
} from "./summary-cells.directive";
export { DataGridSummaryRow } from "./summary-row.directive";
export {
    DataGridSummaryRows,
    type SummaryRowsContext,
} from "./summary-rows.directive";
export { DataGridSummaryRowsRoot } from "./summary-rows-root.directive";
export type { SummaryCellInfo, SummaryRowInfo } from "./types";

/**
 * The summary rows' directives, for a standalone component's `imports` (with `DATA_GRID`): the
 * root's inputs and the parts that render the rows.
 */
export const SUMMARY_ROWS = [
    DataGridSummaryRowsRoot,
    DataGridSummary,
    DataGridSummaryRows,
    DataGridSummaryRow,
    DataGridSummaryCells,
    DataGridSummaryCell,
] as const;
