import { computed, inject, type Signal } from "@angular/core";
import { type SummaryPosition, summaryRowsOf } from "@fragiola/data-grid";
import { DATA_GRID_SUMMARY, type SummaryRowInfo } from "../context";
import { injectGridView } from "./inject-data-grid";
import { type ValueOrSignal, valueNow } from "./internal";

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
