import { computed, Directive, inject, input } from "@angular/core";
import type { EditCellRenderProps } from "@fragiola/data-grid";
import { editActions, editCellPropsOf } from "@fragiola/data-grid/editing";
import {
    type CellInfo,
    type DataGridNode,
    ɵDATA_GRID_CELL,
    ɵinjectGrid,
    ɵstructuralView,
} from "@fragiola/data-grid-angular";

/** The context of the `*dataGridCellEdit` template. */
export interface CellEditContext<TRow = unknown> {
    /** the edit's editor props (`let edit`): the draft, `onChange`, `onCommit`, `onCancel`, … */
    $implicit: EditCellRenderProps<TRow, DataGridNode>;
    edit: EditCellRenderProps<TRow, DataGridNode>;
}

/**
 * An editor of the app's in a cell's content (Epic #88, E4.3; `editing()`'s since Epic #146),
 * rendered only while the cell is edited: `<input *dataGridCellEdit="let edit"
 * [value]="edit.value" (input)="edit.onChange(…)" />` inside a `[dataGridCell]` (or given the
 * cell: `*dataGridCellEdit="cell; let edit"`). Its context follows the draft (React's
 * `useCellEdit`).
 */
@Directive({ selector: "ng-template[dataGridCellEdit]" })
export class DataGridCellEdit<TRow = unknown> {
    /** the cell it edits; without it, the `[dataGridCell]` around */
    readonly dataGridCellEdit = input<CellInfo<TRow> | "" | undefined>(
        undefined,
    );

    static ngTemplateContextGuard<TRow>(
        _directive: DataGridCellEdit<TRow>,
        _context: unknown,
    ): _context is CellEditContext<TRow> {
        return true;
    }

    constructor() {
        const grid = ɵinjectGrid("*dataGridCellEdit");
        const around = inject(ɵDATA_GRID_CELL, { optional: true });
        const edit = computed(() => {
            const cell =
                (this.dataGridCellEdit() as CellInfo | "" | undefined) ||
                around?.bodyCell();
            if (!cell) return null;
            // only the cell being edited reads the draft (`editCellPropsOf` reads the view first)
            return editCellPropsOf(
                grid.view(),
                cell,
                isEdited(grid.view(), cell) ? grid.draft() : null,
                editActions(grid.engine),
            );
        });
        ɵstructuralView<CellEditContext>(() => {
            const props = edit();
            return props ? { $implicit: props, edit: props } : null;
        });
    }
}

/** Whether a cell is the one a view shows edited (`editingCell`, editing's). */
export function isEdited(
    view: object,
    cell: { readonly rowIndex: number; readonly columnIndex: number },
): boolean {
    const editing = (
        view as {
            readonly editingCell?: {
                readonly rowIndex: number;
                readonly columnIndex: number;
            } | null;
        }
    ).editingCell;
    return (
        editing?.rowIndex === cell.rowIndex &&
        editing.columnIndex === cell.columnIndex
    );
}
