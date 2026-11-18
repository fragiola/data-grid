import { computed, inject, type Signal } from "@angular/core";
import { type SummaryPosition, summaryRowsOf } from "@fragiola/data-grid";
import {
    ɵDATA_GRID_SUMMARY as DATA_GRID_SUMMARY,
    injectGridView,
    type ValueOrSignal,
    ɵvalueNow as valueNow,
} from "@fragiola/data-grid-angular";
import type { SummaryRowInfo } from "./types";

/**
 * A position's summary rows (Epic #86; React's `useSummaryRows`), the first one first:
 * `position`'s, else the ones of the `*dataGridSummary` around. None while the grid has none there.
 */
export function injectSummaryRows(
    position?: ValueOrSignal<SummaryPosition | undefined>,
): Signal<readonly SummaryRowInfo[]> {
    const view = injectGridView();
    const around = inject(DATA_GRID_SUMMARY, { optional: true });
    if (position === undefined && !around) {
        throw new Error(
            "injectSummaryRows() must be given a position, or be used inside *dataGridSummary",
        );
    }
    return computed(() => {
        const at =
            (position === undefined ? undefined : valueNow(position)) ??
            around?.position();
        const { summaryRows, rowCount, header } = view();
        return at ? summaryRowsOf({ summaryRows, rowCount, header }, at) : [];
    });
}
