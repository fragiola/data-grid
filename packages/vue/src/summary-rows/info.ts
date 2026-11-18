import type { SummaryRowView } from "@fragiola/data-grid";
import type { GridSummaryCellInfo } from "@fragiola/data-grid/summary-rows";
import type { VNodeChild } from "vue";

/**
 * A summary row (Epic #86), as `SummaryRows` hands it to its slot: its row index, its position
 * and its index among its position's rows.
 */
export type SummaryRowInfo = SummaryRowView;

/** A summary row's cell, as `SummaryCells` hands it to its slot. */
export type SummaryCellInfo<TRow = unknown> = GridSummaryCellInfo<
    TRow,
    VNodeChild
>;
