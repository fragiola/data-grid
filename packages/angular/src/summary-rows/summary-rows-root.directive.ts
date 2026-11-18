import { DestroyRef, Directive, inject, input } from "@angular/core";
import type { DataGridFeature } from "@fragiola/data-grid";
import type {
    SummaryRowsProps,
    SummaryRowsTypes,
} from "@fragiola/data-grid/summary-rows";
import { DataGridRoot } from "@fragiola/data-grid-angular";

/**
 * The root's summary rows (React's `summaryRows` and `summaryRowHeight` on `Root`, typed by
 * `summaryRows()`): on the root's element, with `summaryRows()` in its features (`<div
 * dataGridRoot [features]="features" dataGridSummaryRows [summaryRows]="{ bottom: 1 }">`). Its
 * inputs are the root's. Without `summaryRows()` installed, the core reads none of them.
 */
@Directive({
    selector: "[dataGridRoot][dataGridSummaryRows]",
    exportAs: "dataGridSummaryRowsRoot",
})
export class DataGridSummaryRowsRoot {
    /**
     * how many summary rows the grid has: at the top, under the header, and at the bottom, at the
     * view's bottom edge (default none). `*dataGridSummary` renders them
     */
    readonly summaryRows = input<
        { readonly top?: number; readonly bottom?: number } | undefined
    >(undefined);
    /** a summary row's height in pixels (default 35) */
    readonly summaryRowHeight = input<number | undefined>(undefined);

    constructor() {
        const root = inject(DataGridRoot);
        inject(DestroyRef).onDestroy(
            root.addPropsSource<readonly [DataGridFeature<SummaryRowsTypes>]>(
                (): SummaryRowsProps => ({
                    summaryRows: this.summaryRows(),
                    summaryRowHeight: this.summaryRowHeight(),
                }),
                { inputs: true },
            ),
        );
    }
}
