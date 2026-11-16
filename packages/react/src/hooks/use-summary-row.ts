import {
    ariaRowIndex,
    type SummaryRowState,
    summaryRowPart,
} from "@fragiola/data-grid";
import type { SummaryRowInfo } from "../context";
import { rowStyle } from "../utils/row-style";
import { dataAttributes } from "../utils/use-render";
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
    const view = useGridView<TRow>();
    const { state } = summaryRowPart(view, row);
    return {
        state,
        props: {
            role: "row",
            "aria-rowindex": ariaRowIndex(view, row.rowIndex),
            ...dataAttributes({
                "grid-part": "summary-row",
                summary: row.position,
                "row-index": row.rowIndex,
                active: state.active,
            }),
            style: rowStyle(
                view,
                row.summaryIndex * view.summaryRowHeight,
                view.summaryRowHeight,
            ),
        },
    };
}
