import type { SummaryRowState } from "@fragiola/data-grid";
import { summaryRowPartOf } from "@fragiola/data-grid/summary-rows";
import {
    injectGridView,
    type PartInjectResult,
    ɵpartResult as partResult,
    type ValueOrSignal,
    ɵvalueNow as valueNow,
} from "@fragiola/data-grid-angular";
import type { SummaryRowInfo } from "./types";

/** A summary row's state, and the props for its element (Epic #86; React's `useSummaryRow`). */
export function injectSummaryRow(
    row: ValueOrSignal<SummaryRowInfo>,
): PartInjectResult<SummaryRowState> {
    const view = injectGridView();
    return partResult(() => summaryRowPartOf(view(), valueNow(row)));
}
