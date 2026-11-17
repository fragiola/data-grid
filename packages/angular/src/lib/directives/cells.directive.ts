import {
    Directive,
    effect,
    inject,
    input,
    TemplateRef,
    untracked,
    ViewContainerRef,
} from "@angular/core";
import { rowCellsOf } from "@fragiola/data-grid";
import {
    type CellInfo,
    injectGrid,
    injectRowContext,
    type TypedBy,
} from "../context";
import { keyedTemplateViews } from "../utils/views";

/** The context of the `[dataGridCells]` template. */
export interface CellsContext<TRow = unknown> {
    /** the cell (`let-cell`) */
    $implicit: CellInfo<TRow>;
    cell: CellInfo<TRow>;
}

/**
 * The cells of the row it is in, for the rendered columns:
 * `<ng-template dataGridCells let-cell><div [dataGridCell]="cell">…</div></ng-template>`, inside
 * `[dataGridRow]`. A cell spanning columns (a column's `colSpan`) stands for the ones it covers.
 */
@Directive({ selector: "ng-template[dataGridCells]" })
export class DataGridCells<TRow = unknown> {
    /** what types the template's cell (optional): the columns, or the root */
    readonly dataGridCells = input<TypedBy<TRow>>(undefined);

    static ngTemplateContextGuard<TRow>(
        _directive: DataGridCells<TRow>,
        _context: unknown,
    ): _context is CellsContext<TRow> {
        return true;
    }

    constructor() {
        const grid = injectGrid("[dataGridCells]");
        const row = injectRowContext("[dataGridCells]");
        const views = keyedTemplateViews(
            inject(ViewContainerRef),
            inject<TemplateRef<CellsContext>>(TemplateRef),
            (cell: CellInfo) => ({ $implicit: cell, cell }),
        );
        effect(() => {
            const cells = rowCellsOf(grid.view(), row.rowInfo());
            untracked(() => views.sync(cells, (cell) => cell.column.key));
        });
    }
}
