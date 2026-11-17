import {
    computed,
    Directive,
    forwardRef,
    input,
    type Signal,
} from "@angular/core";
import {
    LAYER_KEYS,
    type SummaryRowState,
    summaryRowPartOf,
} from "@fragiola/data-grid";
import {
    DATA_GRID_SUMMARY_ROW,
    injectGrid,
    type SummaryRowContext,
    type SummaryRowInfo,
} from "../context";
import { beforeInputs, bindPart, injectHost } from "../utils/helpers";

/**
 * A summary row (`role="row"`, `data-summary`), one of the layers the engine moves with the
 * columns, as a header row: `<div [dataGridSummaryRow]="row">`, or a `<tr>`. `data-active` while
 * it holds the active cell. Its cells: `<ng-template dataGridSummaryCells let-cell>`.
 */
@Directive({
    selector: "[dataGridSummaryRow]",
    exportAs: "dataGridSummaryRow",
    providers: [
        {
            provide: DATA_GRID_SUMMARY_ROW,
            useExisting: forwardRef(() => DataGridSummaryRow),
        },
    ],
})
export class DataGridSummaryRow implements SummaryRowContext {
    /** the summary row, as `[dataGridSummaryRows]` hands it */
    readonly dataGridSummaryRow = input.required<SummaryRowInfo>();

    /** @internal */
    readonly summaryRow: Signal<SummaryRowInfo> = this.dataGridSummaryRow;

    private readonly grid = injectGrid("[dataGridSummaryRow]");
    private readonly part = computed(() =>
        summaryRowPartOf(this.grid.view(), this.dataGridSummaryRow()),
    );

    /** the summary row's state (`undefined` on the first pass of a binding on its own element, before its input is set) */
    readonly state: Signal<SummaryRowState | undefined> = computed(() =>
        beforeInputs(undefined, () => this.part().state),
    );

    constructor() {
        bindPart(
            () => this.grid.engine,
            injectHost(),
            () => ({
                props: this.part().props,
                layer: "header",
                drop: LAYER_KEYS,
            }),
        );
    }
}
