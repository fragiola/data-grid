import { computed, type Signal } from "@angular/core";
import type { EditCellRenderProps } from "@fragiola/data-grid";
import { editActions, editCellPropsOf } from "@fragiola/data-grid/editing";
import {
    type CellInfo,
    type DataGridNode,
    type ValueOrSignal,
    ɵinjectGrid,
} from "@fragiola/data-grid-angular";
import { isEdited } from "./cell-edit.directive";

/**
 * An edit's editor props (Epic #88, E4.3; React's `useCellEdit`; `editing()`'s since Epic #146),
 * for the cell being edited: its row, column and indexes, the draft (following it as it
 * changes), the value it started from, the key that started it, `onChange`, `onCommit`,
 * `onCancel` and `editorProps`; `null` for any other cell, and without `editing()`.
 * `*dataGridCellEdit` is its directive.
 */
export function injectCellEdit<TRow>(
    cell: ValueOrSignal<CellInfo<TRow>>,
): Signal<EditCellRenderProps<TRow, DataGridNode> | null> {
    const grid = ɵinjectGrid("injectCellEdit()");
    return computed(() => {
        const current = (
            typeof cell === "function" ? (cell as () => CellInfo<TRow>)() : cell
        ) as CellInfo;
        const view = grid.view();
        // only the cell being edited reads the draft
        if (!isEdited(view, current)) return null;
        // the root that provides it was given the row type the caller states
        return editCellPropsOf(
            view,
            current,
            grid.draft(),
            editActions(grid.engine),
        ) as EditCellRenderProps<TRow, DataGridNode> | null;
    });
}
