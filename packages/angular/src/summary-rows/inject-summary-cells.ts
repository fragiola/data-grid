import { computed, inject, type Signal } from "@angular/core";
import { summaryCellsOf } from "@fragiola/data-grid/summary-rows";
import {
    ɵDATA_GRID_SUMMARY_ROW as DATA_GRID_SUMMARY_ROW,
    injectGridView,
    type ValueOrSignal,
    ɵvalueNow as valueNow,
} from "@fragiola/data-grid-angular";
import type { SummaryCellInfo, SummaryRowInfo } from "./types";

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
