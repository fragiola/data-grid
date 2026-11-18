import type { SummaryCellState } from "@fragiola/data-grid";
import { summaryCellPartOf } from "@fragiola/data-grid";
import type { SummaryCellInfo } from "../context";
import { injectGridView } from "./inject-data-grid";
import {
    type PartInjectResult,
    partResult,
    type ValueOrSignal,
    valueNow,
} from "./internal";

/** A summary row's cell's state, and the props for its element (Epic #86; React's `useSummaryCell`). */
export function injectSummaryCell<TRow>(
    cell: ValueOrSignal<SummaryCellInfo<TRow>>,
): PartInjectResult<SummaryCellState> {
    const view = injectGridView<TRow>();
    return partResult(() => summaryCellPartOf(view(), valueNow(cell)));
}
