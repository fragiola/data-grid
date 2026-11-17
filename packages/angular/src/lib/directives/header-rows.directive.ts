import {
    Directive,
    effect,
    inject,
    input,
    TemplateRef,
    untracked,
    ViewContainerRef,
} from "@angular/core";
import { type HeaderRowInfo, injectGrid, type TypedBy } from "../context";
import { keyedTemplateViews } from "../utils/views";

/** The context of the `[dataGridHeaderRows]` template. */
export interface HeaderRowsContext<TRow = unknown> {
    /** the header row (`let-row`) */
    $implicit: HeaderRowInfo<TRow>;
    row: HeaderRowInfo<TRow>;
}

/**
 * The header rows, the top one first: one without column groups, one per level with them (the
 * columns' row last): `<ng-template dataGridHeaderRows let-row><div [dataGridHeaderRow]="row">…
 * </div></ng-template>`, inside `*dataGridHeader`.
 */
@Directive({ selector: "ng-template[dataGridHeaderRows]" })
export class DataGridHeaderRows<TRow = unknown> {
    /** what types the template's row (optional): the columns, or the root */
    readonly dataGridHeaderRows = input<TypedBy<TRow>>(undefined);

    static ngTemplateContextGuard<TRow>(
        _directive: DataGridHeaderRows<TRow>,
        _context: unknown,
    ): _context is HeaderRowsContext<TRow> {
        return true;
    }

    constructor() {
        const grid = injectGrid("[dataGridHeaderRows]");
        const views = keyedTemplateViews(
            inject(ViewContainerRef),
            inject<TemplateRef<HeaderRowsContext>>(TemplateRef),
            (row: HeaderRowInfo) => ({ $implicit: row, row }),
        );
        effect(() => {
            const rows = grid.view().headerRows;
            untracked(() => views.sync(rows, (row) => String(row.rowIndex)));
        });
    }
}
