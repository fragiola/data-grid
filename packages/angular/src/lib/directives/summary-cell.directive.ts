import {
    computed,
    Directive,
    forwardRef,
    input,
    type Signal,
} from "@angular/core";
import {
    type SummaryCellState,
    summaryCellContent,
    summaryCellPartOf,
} from "@fragiola/data-grid";
import {
    type CellContext,
    type CellInfo,
    DATA_GRID_CELL,
    injectGrid,
    type SummaryCellInfo,
} from "../context";
import { cellBinding } from "../utils/cell-binding";
import type { DataGridNode } from "../utils/content";
import { beforeInputs, bindPart, injectHost } from "../utils/helpers";

/**
 * A summary row's cell (`role="gridcell"`, `data-summary`), positioned in its row as a body cell:
 * pinned, spanning (`aria-colspan`, a `<td>`'s `colspan`), active and in interaction alike:
 * `<div [dataGridSummaryCell]="cell">`. Its content is the app's (the column's
 * `renderSummaryCell` through `<ng-container *dataGridCellContent />`).
 */
@Directive({
    selector: "[dataGridSummaryCell]",
    exportAs: "dataGridSummaryCell",
    providers: [
        {
            provide: DATA_GRID_CELL,
            useExisting: forwardRef(() => DataGridSummaryCell),
        },
    ],
})
export class DataGridSummaryCell<TRow = unknown> implements CellContext {
    /** the cell, as `[dataGridSummaryCells]` hands it */
    readonly dataGridSummaryCell = input.required<SummaryCellInfo<TRow>>();

    private readonly grid = injectGrid("[dataGridSummaryCell]");
    private readonly host = injectHost();
    private readonly part = computed(() =>
        summaryCellPartOf(
            this.grid.view(),
            this.dataGridSummaryCell() as SummaryCellInfo,
        ),
    );

    /** the cell's state (`undefined` on the first pass of a binding on its own element, before its input is set) */
    readonly state: Signal<SummaryCellState | undefined> = computed(() =>
        beforeInputs(undefined, () => this.part().state),
    );

    /** @internal */
    readonly content: Signal<DataGridNode> = computed(() =>
        summaryCellContent(this.dataGridSummaryCell()),
    );

    /** @internal */
    readonly bodyCell: Signal<CellInfo | null> = computed(() => null);

    constructor() {
        bindPart(
            () => this.grid.engine,
            this.host,
            () => {
                const own = this.part();
                return cellBinding(
                    this.host,
                    own,
                    own.columnSpan,
                    own.measured,
                );
            },
        );
    }
}
