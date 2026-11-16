import { type EditCellRenderProps, isHeldCell } from "@fragiola/data-grid";
import { type ReactNode, useMemo } from "react";
import { type CellInfo, useRootGrid } from "../context";

import { useEngineValue } from "./internal";
import { useGridView } from "./use-grid-view";

/**
 * An edit's editor props (Epic #88, E4.3), for the cell being edited (`state.editing`): its row,
 * column and indexes, the draft (`value`, the engine's, this hook re-rendering as it changes), the
 * value it started from, the key that started it, `onChange`, `onCommit` and `onCancel`, and
 * `editorProps` (spread on an element outside the cell that is the editor's: a popover);
 * `null` for any other cell. What a column's `renderEditCell` receives: call it in an editor of
 * your own rendered in a cell's children while it is edited (subscribe only there: every cell
 * subscribing would re-render with every keystroke).
 */
export function useCellEdit<TRow>(
    cell: CellInfo<TRow>,
): EditCellRenderProps<TRow, ReactNode> | null {
    const { engine } = useRootGrid();
    const draft = useEngineValue(engine, "edit-draft", null);
    const ways = useMemo(
        () => ({
            onChange: (value: unknown) => engine.run("change-edit", { value }),
            onCommit: (...value: [] | [value: unknown]) =>
                engine.run(
                    "commit-edit",
                    value.length > 0 ? { value: value[0] } : {},
                ),
            onCancel: () => engine.run("cancel-edit", {}),
        }),
        [engine],
    );
    // the edited cell is the view's: the draft has no position of its own
    const editing = useGridView<TRow>().editingCell;
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
        ...ways,
    };
}
