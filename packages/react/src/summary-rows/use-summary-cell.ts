import type { SummaryCellState } from "@fragiola/data-grid";
import { summaryCellPartOf } from "@fragiola/data-grid/summary-rows";
import type { PartHookResult } from "../hooks/internal";
import { useGridView } from "../hooks/use-grid-view";
import type { SummaryCellInfo } from "./context";

/**
 * A summary row's cell's state, and the props for its element (Epic #86): a body cell's (the
 * roving tab stop, ARIA, pinned and spanning as one), `data-summary`, a summary row tall.
 */
export function useSummaryCell<TRow>(
    cell: SummaryCellInfo<TRow>,
): PartHookResult<SummaryCellState> {
    const { state, props } = useSummaryCellPart(cell);
    return { state, props };
}

/** `useSummaryCell`, and how many columns the cell spans (a table cell's `colSpan`). */
export function useSummaryCellPart<TRow>(
    cell: SummaryCellInfo<TRow>,
): PartHookResult<SummaryCellState> & {
    columnSpan: number;
    measured: boolean;
} {
    return summaryCellPartOf(useGridView<TRow>(), cell);
}
