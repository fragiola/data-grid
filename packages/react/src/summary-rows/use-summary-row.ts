import type { SummaryRowState } from "@fragiola/data-grid";
import { summaryRowPartOf } from "@fragiola/data-grid/summary-rows";
import type { SummaryRowInfo } from "../context";
import type { PartHookResult } from "../hooks/internal";
import { useGridView } from "../hooks/use-grid-view";

/**
 * A summary row's state, and the props for its element (Epic #86): ARIA (`role="row"`, its
 * `aria-rowindex` after the header's or the body's rows), `data-summary`, and its structural
 * style in its `DataGrid.Summary` (from `rowLeft`, a summary row tall; a flex container with pinned
 * columns, as a body row).
 */
export function useSummaryRow<TRow>(
    row: SummaryRowInfo,
): PartHookResult<SummaryRowState> {
    return summaryRowPartOf(useGridView<TRow>(), row);
}
