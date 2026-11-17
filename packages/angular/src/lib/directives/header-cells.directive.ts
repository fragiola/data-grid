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
    DATA_GRID_HEADER_ROW,
    type HeaderCellInfo,
    injectGrid,
    type TypedBy,
} from "../context";
import { keyedTemplateViews } from "../utils/views";

/** The context of the `[dataGridHeaderCells]` template. */
export interface HeaderCellsContext<TRow = unknown> {
    /** the header cell (`let-cell`): a group's or a column's */
    $implicit: HeaderCellInfo<TRow>;
    cell: HeaderCellInfo<TRow>;
}

/**
 * A header row's cells: groups and columns intersecting the column window (a group cut by it
 * included), plus the one holding the active column:
 * `<ng-template dataGridHeaderCells let-cell><div [dataGridHeaderCell]="cell">…</div>
 * </ng-template>`, inside `[dataGridHeaderRow]` (else the columns' row).
 */
@Directive({ selector: "ng-template[dataGridHeaderCells]" })
export class DataGridHeaderCells<TRow = unknown> {
    /** what types the template's cell (optional): the columns, or the root */
    readonly dataGridHeaderCells = input<TypedBy<TRow>>(undefined);

    static ngTemplateContextGuard<TRow>(
        _directive: DataGridHeaderCells<TRow>,
        _context: unknown,
    ): _context is HeaderCellsContext<TRow> {
        return true;
    }

    constructor() {
        const grid = injectGrid("[dataGridHeaderCells]");
        const around = inject(DATA_GRID_HEADER_ROW, { optional: true });
        const row = computed(() => {
            const { headerRows } = grid.view();
            return around?.headerRow() ?? headerRows[headerRows.length - 1];
        });
        const views = keyedTemplateViews(
            inject(ViewContainerRef),
            inject<TemplateRef<HeaderCellsContext>>(TemplateRef),
            (cell: HeaderCellInfo) => ({ $implicit: cell, cell }),
        );
        effect(() => {
            const cells = row()?.cells ?? [];
            untracked(() => views.sync(cells, (cell) => cell.key));
        });
    }
}
