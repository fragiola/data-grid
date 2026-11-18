import { summaryCellsOf } from "@fragiola/data-grid/summary-rows";
import { useContext } from "react";
import { SummaryRowContext, type SummaryRowInfo } from "../context";
import { useGridView } from "../hooks/use-grid-view";
import type { SummaryCellInfo } from "./context";

/**
 * The cells a summary row renders, with their columns: one per rendered column, but a cell
 * spanning columns (a column's `colSpan` asked with `type: "summary"`) stands for the ones it
 * covers. The given row, else the one rendering (inside `DataGrid.SummaryRow`).
 */
export function useSummaryCells<TRow = unknown>(
    row?: SummaryRowInfo,
): SummaryCellInfo<TRow>[] {
    const view = useGridView<TRow>();
    const rendering = useContext(SummaryRowContext);
    const at = row ?? rendering;
    if (!at) {
        throw new Error(
            "useSummaryCells() must be given a row, or be used inside <DataGrid.SummaryRow>",
        );
    }
    return summaryCellsOf(view, at);
}
