// An edit's editor props (Epic #88, E4.3; editing's since Epic #146), whatever the framework: what
// a column's `renderEditCell` receives for the cell being edited.

import type { GridCellInfo } from "../adapter/props";
import { isHeldCell } from "../engine/parts";
import type { DataGridEngine, EditDraft, GridView } from "../engine/types";
import type { EditCellRenderProps } from "../model/types";
import type { EditingView } from "./types";

/**
 * What belongs to an edit outside its cell (Epic #88, E4.3): an element the app marks with the
 * edit's `editorProps` (a select's or a date picker's popover, portalled out of the grid), its
 * value naming that edit of that grid. A press or focus there keeps the edit open; anywhere else
 * outside the edited cell, it commits.
 */
export const EDITOR_ATTRIBUTE = "data-grid-editor";

/** What an editor calls: its draft's change, its commit and its cancel (one set per engine). */
export type EditActions = Pick<
    EditCellRenderProps<unknown>,
    "onChange" | "onCommit" | "onCancel"
>;

/** Each engine's edit actions, made once. */
const ACTIONS = new WeakMap<object, EditActions>();

/** An engine's edit actions: `change-edit`, `commit-edit` and `cancel-edit` (the same object each time). */
export function editActions<TRow, TNode>(
    engine: DataGridEngine<TRow, TNode>,
): EditActions {
    let actions = ACTIONS.get(engine);
    if (!actions) {
        actions = {
            onChange: (value: unknown) => engine.run("change-edit", { value }),
            onCommit: (...value: [] | [value: unknown]) =>
                engine.run(
                    "commit-edit",
                    value.length > 0 ? { value: value[0] } : {},
                ),
            onCancel: () => engine.run("cancel-edit", {}),
        };
        ACTIONS.set(engine, actions);
    }
    return actions;
}

/**
 * The editor props of `cell` while it is the one being edited (the view's `editingCell`, its
 * draft the engine's `edit-draft`); `null` for any other cell.
 */
export function editCellPropsOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    cell: GridCellInfo<TRow, TNode>,
    draft: EditDraft | null | undefined,
    actions: EditActions,
): EditCellRenderProps<TRow, TNode> | null {
    // the edited cell is the view's: the draft has no position of its own
    const editing = (view as GridView<TRow, TNode> & Partial<EditingView>)
        .editingCell;
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
