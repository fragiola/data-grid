// @fragiola/data-grid-react/summary-rows: rows of figures under the header and at the bottom edge
// (Epic #86), a feature since Epic #151: the core's (`@fragiola/data-grid/summary-rows`)
// re-exported, the `Summary`, `SummaryRows`, `SummaryRow`, `SummaryCells` and `SummaryCell`
// primitives and their hooks. An opt-in entry point: the primitives never import it, and an app
// that never installs summary rows never ships it.

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
export type { SummaryRowInfo } from "../context";
export type { SummaryCellInfo } from "./context";
export { Summary, type SummaryProps } from "./summary";
export { SummaryCell, type SummaryCellProps } from "./summary-cell";
export { SummaryCells, type SummaryCellsProps } from "./summary-cells";
export { SummaryRow, type SummaryRowProps } from "./summary-row";
export { SummaryRows, type SummaryRowsProps } from "./summary-rows";
export { useSummaryCell } from "./use-summary-cell";
export { useSummaryCells } from "./use-summary-cells";
export { useSummaryRow } from "./use-summary-row";
export { useSummaryRows } from "./use-summary-rows";
