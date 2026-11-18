import type { SummaryRowView } from "@fragiola/data-grid";
import type { GridSummaryCellInfo } from "@fragiola/data-grid/summary-rows";
import type { DataGridNode } from "@fragiola/data-grid-angular";

/** A summary row, as `[dataGridSummaryRows]` hands it to its template. */
export type SummaryRowInfo = SummaryRowView;

/** A summary row's cell, as `[dataGridSummaryCells]` hands it to its template. */
export type SummaryCellInfo<TRow = unknown> = GridSummaryCellInfo<
    TRow,
    DataGridNode
>;
