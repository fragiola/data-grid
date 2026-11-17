import { computed, Directive, inject, input } from "@angular/core";
import {
    type EditCellRenderProps,
    editActions,
    editCellPropsOf,
} from "@fragiola/data-grid";
import { type CellInfo, DATA_GRID_CELL, injectGrid } from "../context";
import type { DataGridNode } from "../utils/content";
import { structuralView } from "../utils/structural";

/** The context of the `*dataGridCellEdit` template. */
export interface CellEditContext<TRow = unknown> {
    /** the edit's editor props (`let edit`): the draft, `onChange`, `onCommit`, `onCancel`, … */
    $implicit: EditCellRenderProps<TRow, DataGridNode>;
    edit: EditCellRenderProps<TRow, DataGridNode>;
}

/**
 * An editor of the app's in a cell's content (Epic #88, E4.3), rendered only while the cell is
 * edited: `<input *dataGridCellEdit="let edit" [value]="edit.value"
 * (input)="edit.onChange(…)" />` inside a `[dataGridCell]` (or given the cell:
 * `*dataGridCellEdit="cell; let edit"`). Its context follows the draft (React's `useCellEdit`).
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
        const grid = injectGrid("*dataGridCellEdit");
        const around = inject(DATA_GRID_CELL, { optional: true });
        const edit = computed(() => {
            const cell =
                (this.dataGridCellEdit() as CellInfo | "" | undefined) ||
                around?.bodyCell();
            if (!cell) return null;
            const view = grid.view();
            // only the cell being edited reads the draft
            if (
                view.editingCell?.rowIndex !== cell.rowIndex ||
                view.editingCell.columnIndex !== cell.columnIndex
            ) {
                return null;
            }
            return editCellPropsOf(
                view,
                cell,
                grid.draft(),
                editActions(grid.engine),
            );
        });
        structuralView<CellEditContext>(() => {
            const props = edit();
            return props ? { $implicit: props, edit: props } : null;
        });
    }
}
