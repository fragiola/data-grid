import type { SummaryCellState } from "@fragiola/data-grid";
import type { SummaryCellInfo } from "../context";

import { type PartHookResult, useSummaryCellPart } from "./internal";

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
