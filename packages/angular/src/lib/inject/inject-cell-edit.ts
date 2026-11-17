import { computed, type Signal } from "@angular/core";
import {
    type EditCellRenderProps,
    editActions,
    editCellPropsOf,
} from "@fragiola/data-grid";
import type { CellInfo } from "../context";
import type { DataGridNode } from "../utils/content";
import { injectRootGrid, type ValueOrSignal, valueNow } from "./internal";

/**
 * An edit's editor props (Epic #88, E4.3; React's `useCellEdit`), for the cell being edited: its
 * row, column and indexes, the draft (following it as it changes), the value it started from, the
 * key that started it, `onChange`, `onCommit`, `onCancel` and `editorProps`; `null` for any other
 * cell. `*dataGridCellEdit` is its directive.
 */
export function injectCellEdit<TRow>(
    cell: ValueOrSignal<CellInfo<TRow>>,
): Signal<EditCellRenderProps<TRow, DataGridNode> | null> {
    const grid = injectRootGrid(
        "injectCellEdit() must be used inside [dataGridRoot]",
    );
    return computed(() => {
        const current = valueNow(cell) as CellInfo;
        const view = grid.view();
        const editing = view.editingCell;
        if (
            editing?.rowIndex !== current.rowIndex ||
            editing.columnIndex !== current.columnIndex
        ) {
            return null;
        }
        // the root that provides it was given the row type the caller states
        return editCellPropsOf(
            view,
            current,
            grid.draft(),
            editActions(grid.engine),
        ) as EditCellRenderProps<TRow, DataGridNode> | null;
    });
}
