import type { SummaryCellState } from "@fragiola/data-grid";
import { summaryCellPartOf } from "@fragiola/data-grid/summary-rows";
import {
    injectGridView,
    type PartInjectResult,
    ɵpartResult as partResult,
    type ValueOrSignal,
    ɵvalueNow as valueNow,
} from "@fragiola/data-grid-angular";
import type { SummaryCellInfo } from "./types";

/** A summary row's cell's state, and the props for its element (Epic #86; React's `useSummaryCell`). */
export function injectSummaryCell<TRow>(
    cell: ValueOrSignal<SummaryCellInfo<TRow>>,
): PartInjectResult<SummaryCellState> {
    const view = injectGridView<TRow>();
    return partResult(() => summaryCellPartOf(view(), valueNow(cell)));
}
