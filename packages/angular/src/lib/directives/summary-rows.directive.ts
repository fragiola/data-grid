import {
    computed,
    Directive,
    effect,
    inject,
    input,
    TemplateRef,
    untracked,
    ViewContainerRef,
} from "@angular/core";
import {
    type SummaryPosition,
    type SummaryRowView,
    summaryRowsOf,
} from "@fragiola/data-grid";
import { DATA_GRID_SUMMARY, injectGrid, type SummaryRowInfo } from "../context";
import { keyedTemplateViews } from "../utils/views";

/** The context of the `[dataGridSummaryRows]` template. */
export interface SummaryRowsContext {
    /** the summary row (`let-row`) */
    $implicit: SummaryRowInfo;
    row: SummaryRowInfo;
}

/**
 * A position's summary rows, the first one first: `<ng-template dataGridSummaryRows let-row>
 * <div [dataGridSummaryRow]="row">…</div></ng-template>`, inside `*dataGridSummary` (or given its
 * position: `[dataGridSummaryRows]="'bottom'"`).
 */
@Directive({ selector: "ng-template[dataGridSummaryRows]" })
export class DataGridSummaryRows {
    /** whose rows: without it, the `*dataGridSummary` around's */
    readonly dataGridSummaryRows = input<SummaryPosition | "" | undefined>(
        undefined,
    );

    static ngTemplateContextGuard(
        _directive: DataGridSummaryRows,
        _context: unknown,
    ): _context is SummaryRowsContext {
        return true;
    }

    constructor() {
        const grid = injectGrid("[dataGridSummaryRows]");
        const around = inject(DATA_GRID_SUMMARY, { optional: true });
        // the rows only change with the counts, the row count and the header: kept between views
        let last: {
            key: readonly unknown[];
            rows: readonly SummaryRowView[];
        } | null = null;
        const rows = computed(() => {
            const at = this.dataGridSummaryRows() || around?.position();
            const { summaryRows, rowCount, header } = grid.view();
            if (!at) return [];
            const key = [summaryRows, rowCount, header, at];
            if (last?.key.every((value, index) => value === key[index])) {
                return last.rows;
            }
            const next = summaryRowsOf({ summaryRows, rowCount, header }, at);
            last = { key, rows: next };
            return next;
        });
        const views = keyedTemplateViews(
            inject(ViewContainerRef),
            inject<TemplateRef<SummaryRowsContext>>(TemplateRef),
            (row: SummaryRowInfo) => ({ $implicit: row, row }),
        );
        effect(() => {
            const current = rows();
            untracked(() =>
                views.sync(current, (row) => String(row.summaryIndex)),
            );
        });
    }
}
