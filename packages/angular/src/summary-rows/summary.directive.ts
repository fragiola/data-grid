import {
    computed,
    Directive,
    forwardRef,
    input,
    type Signal,
} from "@angular/core";
import type { SummaryPosition } from "@fragiola/data-grid";
import {
    type SummaryState,
    summaryPartOf,
} from "@fragiola/data-grid/summary-rows";
import {
    ɵbindPart as bindPart,
    ɵDATA_GRID_SUMMARY as DATA_GRID_SUMMARY,
    ɵinjectGrid as injectGrid,
    type SummaryContext,
    ɵstructuralView as structuralView,
} from "@fragiola/data-grid-angular";

/** The context of the `*dataGridSummary` template. */
export interface SummaryTemplateContext {
    /** the summary's state (`let state`) */
    $implicit: SummaryState;
    state: SummaryState;
}

/**
 * A position's summary rows (`role="rowgroup"`, `data-summary`), sticky: the top ones under the
 * header, the bottom ones at the visible body's bottom edge: `<div *dataGridSummary="'top'">`, or
 * a `<tbody>`/`<tfoot>`. Nothing renders while the grid has none there (`summaryRows` on the root).
 * Its place in the flow is the grid's: the top one after the header, the bottom one last. Its rows:
 * `<ng-template dataGridSummaryRows let-row>`.
 */
@Directive({
    selector: "ng-template[dataGridSummary]",
    providers: [
        {
            provide: DATA_GRID_SUMMARY,
            useExisting: forwardRef(() => DataGridSummary),
        },
    ],
})
export class DataGridSummary implements SummaryContext {
    /** under the header (`"top"`), or at the view's bottom edge (`"bottom"`) */
    readonly dataGridSummary = input.required<SummaryPosition>();

    /** @internal */
    readonly position: Signal<SummaryPosition> = this.dataGridSummary;

    static ngTemplateContextGuard(
        _directive: DataGridSummary,
        _context: unknown,
    ): _context is SummaryTemplateContext {
        return true;
    }

    constructor() {
        const grid = injectGrid("*dataGridSummary");
        const part = computed(() =>
            grid.view().summaryRows[this.position()] > 0
                ? summaryPartOf(grid.view(), this.position())
                : null,
        );
        const element = structuralView<SummaryTemplateContext>(() => {
            const own = part();
            return own ? { $implicit: own.state, state: own.state } : null;
        });
        bindPart(
            () => grid.engine,
            element,
            () => {
                const own = part();
                return own ? { props: own.props } : null;
            },
        );
    }
}
