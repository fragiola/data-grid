import { type SummaryRowState, summaryRowPartOf } from "@fragiola/data-grid";
import type { SummaryRowInfo } from "../context";
import type { PartHookResult } from "./internal";
import { useGridView } from "./use-grid-view";

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
