import { type SummaryRowState, summaryRowPartOf } from "@fragiola/data-grid";
import type { SummaryRowInfo } from "../context";
import { injectGridView } from "./inject-data-grid";
import {
    type PartInjectResult,
    partResult,
    type ValueOrSignal,
    valueNow,
} from "./internal";

/** A summary row's state, and the props for its element (Epic #86; React's `useSummaryRow`). */
export function injectSummaryRow(
    row: ValueOrSignal<SummaryRowInfo>,
): PartInjectResult<SummaryRowState> {
    const view = injectGridView();
    return partResult(() => summaryRowPartOf(view(), valueNow(row)));
}
