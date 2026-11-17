import {
    Directive,
    effect,
    inject,
    input,
    TemplateRef,
    untracked,
    ViewContainerRef,
} from "@angular/core";
import { summaryCellsOf } from "@fragiola/data-grid";
import {
    DATA_GRID_SUMMARY_ROW,
    injectGrid,
    type SummaryCellInfo,
    type TypedBy,
} from "../context";
import { keyedTemplateViews } from "../utils/views";

/** The context of the `[dataGridSummaryCells]` template. */
export interface SummaryCellsContext<TRow = unknown> {
    /** the summary row's cell (`let-cell`) */
    $implicit: SummaryCellInfo<TRow>;
    cell: SummaryCellInfo<TRow>;
}

/**
 * The cells of the summary row it is in, for the rendered columns:
 * `<ng-template dataGridSummaryCells let-cell><div [dataGridSummaryCell]="cell">…</div>
 * </ng-template>`, inside `[dataGridSummaryRow]`.
 */
@Directive({ selector: "ng-template[dataGridSummaryCells]" })
export class DataGridSummaryCells<TRow = unknown> {
    /** what types the template's cell (optional): the columns, or the root */
    readonly dataGridSummaryCells = input<TypedBy<TRow>>(undefined);

    static ngTemplateContextGuard<TRow>(
        _directive: DataGridSummaryCells<TRow>,
        _context: unknown,
    ): _context is SummaryCellsContext<TRow> {
        return true;
    }

    constructor() {
        const grid = injectGrid("[dataGridSummaryCells]");
        const row = inject(DATA_GRID_SUMMARY_ROW, { optional: true });
        if (!row) {
            throw new Error(
                "[dataGridSummaryCells] must be used inside [dataGridSummaryRow]",
            );
        }
        const views = keyedTemplateViews(
            inject(ViewContainerRef),
            inject<TemplateRef<SummaryCellsContext>>(TemplateRef),
            (cell: SummaryCellInfo) => ({ $implicit: cell, cell }),
        );
        effect(() => {
            const cells = summaryCellsOf(grid.view(), row.summaryRow());
            untracked(() => views.sync(cells, (cell) => cell.column.key));
        });
    }
}
