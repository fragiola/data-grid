import type { EditCellRenderProps } from "@fragiola/data-grid";
import { editActions, editCellPropsOf } from "@fragiola/data-grid/editing";
import {
    type ComputedRef,
    computed,
    type MaybeRefOrGetter,
    toValue,
    type VNodeChild,
} from "vue";
import { useEngineValue } from "../composables/internal";
import { type CellInfo, useGridView, useRootGrid } from "../context";

/**
 * An edit's editor props (Epic #88, E4.3; `editing()`'s since Epic #146), for the cell being
 * edited (`state.editing`): its row, column and indexes, the draft (`value`, the engine's,
 * following it as it changes), the value it started from, the key that started it, `onChange`,
 * `onCommit` and `onCancel`, and `editorProps` (bound on an element outside the cell that is the
 * editor's: a popover); `null` for any other cell, and without `editing()`. What a column's
 * `renderEditCell` receives: use it in an editor of your own rendered in a cell's slot while it
 * is edited (only there: every cell following the draft would re-render with every keystroke).
 */
export function useCellEdit<TRow>(
    cell: MaybeRefOrGetter<CellInfo<TRow>>,
): ComputedRef<EditCellRenderProps<TRow, VNodeChild> | null> {
    const { engine } = useRootGrid();
    const view = useGridView<TRow>();
    const draft = useEngineValue(() => engine, "edit-draft", null);
    const actions = editActions(engine);
    return computed(() =>
        editCellPropsOf(view.value, toValue(cell), draft.value, actions),
    );
}
