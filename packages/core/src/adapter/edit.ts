// An edit's editor props (Epic #88, E4.3), whatever the framework: what a column's
// `renderEditCell` receives for the cell being edited.

import { isHeldCell } from "../engine/parts";
import type { DataGridEngine, EditDraft, GridView } from "../engine/types";
import type { EditCellRenderProps } from "../model/types";
import type { GridCellInfo } from "./props";

/** What an editor calls: its draft's change, its commit and its cancel (one set per engine). */
export type EditActions = Pick<
    EditCellRenderProps<unknown>,
    "onChange" | "onCommit" | "onCancel"
>;

/** An engine's edit actions: `change-edit`, `commit-edit` and `cancel-edit`. */
export function editActions<TRow, TNode>(
    engine: DataGridEngine<TRow, TNode>,
): EditActions {
    return {
        onChange: (value: unknown) => engine.run("change-edit", { value }),
        onCommit: (...value: [] | [value: unknown]) =>
            engine.run(
                "commit-edit",
                value.length > 0 ? { value: value[0] } : {},
            ),
        onCancel: () => engine.run("cancel-edit", {}),
    };
}

/**
 * The editor props of `cell` while it is the one being edited (the view's `editingCell`, its
 * draft the engine's `edit-draft`); `null` for any other cell.
 */
export function editCellPropsOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    cell: GridCellInfo<TRow, TNode>,
    draft: EditDraft | null,
    actions: EditActions,
): EditCellRenderProps<TRow, TNode> | null {
    // the edited cell is the view's: the draft has no position of its own
    const editing = view.editingCell;
    const { row, rowIndex, column, columnIndex } = cell;
    if (!draft || row === undefined || !editing || !isHeldCell(editing, cell)) {
        return null;
    }
    return {
        row,
        rowIndex,
        column,
        columnIndex,
        value: draft.value,
        initialValue: draft.initialValue,
        startKey: editing.startKey,
        editorProps: draft.editorProps,
        ...actions,
    };
}
