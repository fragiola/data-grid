import { computed, inject, type Signal } from "@angular/core";
import { summaryCellsOf } from "@fragiola/data-grid";
import {
    DATA_GRID_SUMMARY_ROW,
    type SummaryCellInfo,
    type SummaryRowInfo,
} from "../context";
import { injectGridView } from "./inject-data-grid";
import { type ValueOrSignal, valueNow } from "./internal";

/**
 * The cells a summary row renders (React's `useSummaryCells`): the given row, else the one around
 * (`[dataGridSummaryRow]`).
 */
export function injectSummaryCells<TRow = unknown>(
    row?: ValueOrSignal<SummaryRowInfo | undefined>,
): Signal<SummaryCellInfo<TRow>[]> {
    const view = injectGridView<TRow>();
    const around = inject(DATA_GRID_SUMMARY_ROW, { optional: true });
    if (row === undefined && !around) {
        throw new Error(
            "injectSummaryCells() must be given a row, or be used inside [dataGridSummaryRow]",
        );
    }
    return computed(() => {
        const at =
            (row === undefined ? undefined : valueNow(row)) ??
            around?.summaryRow();
        return at ? summaryCellsOf(view(), at) : [];
    });
}
