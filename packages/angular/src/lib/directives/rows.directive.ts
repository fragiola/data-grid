import {
    Directive,
    effect,
    inject,
    input,
    TemplateRef,
    untracked,
    ViewContainerRef,
} from "@angular/core";
import { rowElementKey, rowsOf } from "@fragiola/data-grid";
import { injectGrid, type RowInfo, type TypedBy } from "../context";
import { keyedTemplateViews } from "../utils/views";

/** The context of the `[dataGridRows]` template. */
export interface RowsContext<TRow = unknown> {
    /** the row (`let-row`) */
    $implicit: RowInfo<TRow>;
    row: RowInfo<TRow>;
}

/**
 * The rendered rows (the row window, plus the active row), in order:
 * `<ng-template dataGridRows let-row><div [dataGridRow]="row">…</div></ng-template>`, inside
 * `[dataGridBody]`. `[dataGridRows]="columns"` (or the root, `#grid="dataGridRoot"`) types the
 * row by the row type. A row keeps its view while its key stays (the app's keys, else its index).
 */
@Directive({ selector: "ng-template[dataGridRows]" })
export class DataGridRows<TRow = unknown> {
    /** what types the template's row (optional): the columns, or the root */
    readonly dataGridRows = input<TypedBy<TRow>>(undefined);

    static ngTemplateContextGuard<TRow>(
        _directive: DataGridRows<TRow>,
        _context: unknown,
    ): _context is RowsContext<TRow> {
        return true;
    }

    constructor() {
        const grid = injectGrid("[dataGridRows]");
        const views = keyedTemplateViews(
            inject(ViewContainerRef),
            inject<TemplateRef<RowsContext>>(TemplateRef),
            (row: RowInfo) => ({ $implicit: row, row }),
        );
        effect(() => {
            const view = grid.view();
            untracked(() =>
                views.sync(rowsOf(view), (row) => rowElementKey(view, row)),
            );
        });
    }
}
