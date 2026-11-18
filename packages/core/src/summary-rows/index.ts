// @fragiola/data-grid/summary-rows: rows of figures under the header and at the bottom edge (Epic
// #86, E2.1; a feature since Epic #151). An opt-in entry point: the grid's own entry never imports
// it, and an app that never installs it never ships it (a grid has no summary rows).

export { summaryRows } from "./feature";
export {
    type GridSummaryCellInfo,
    type SummaryState,
    summaryCellContent,
    summaryCellPart,
    summaryCellPartOf,
    summaryCellsOf,
    summaryPartOf,
    summaryRowPart,
    summaryRowPartOf,
} from "./parts";
export type { SummaryRowsProps, SummaryRowsTypes } from "./types";
