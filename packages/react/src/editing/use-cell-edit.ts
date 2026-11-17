import type { EditCellRenderProps } from "@fragiola/data-grid";
import { editActions, editCellPropsOf } from "@fragiola/data-grid/editing";
import type { ReactNode } from "react";
import { type CellInfo, useRootGrid } from "../context";
import { useEngineValue } from "../hooks/internal";
import { useGridView } from "../hooks/use-grid-view";

/**
 * An edit's editor props (Epic #88, E4.3; `editing()`'s since Epic #146), for the cell being
 * edited (`state.editing`): its row, column and indexes, the draft (`value`, the engine's, this
 * hook re-rendering as it changes), the value it started from, the key that started it,
 * `onChange`, `onCommit` and `onCancel`, and `editorProps` (spread on an element outside the cell
 * that is the editor's: a popover); `null` for any other cell, and without `editing()`. What a
 * column's `renderEditCell` receives: call it in an editor of your own rendered in a cell's
 * children while it is edited (subscribe only there: every cell subscribing would re-render with
 * every keystroke).
 */
export function useCellEdit<TRow>(
    cell: CellInfo<TRow>,
): EditCellRenderProps<TRow, ReactNode> | null {
    const { engine } = useRootGrid();
    const draft = useEngineValue(engine, "edit-draft", null);
    return editCellPropsOf(
        useGridView<TRow>(),
        cell,
        draft,
        editActions(engine),
    );
}
