import {
    type RowDragHandleState,
    rowDragHandlePart,
} from "@fragiola/data-grid";

import { controlPart, dragHandleData } from "../utils/control-part";
import type { PartHookResult } from "./internal";
import { useGridView } from "./use-grid-view";

/**
 * A row's drag handle (Epic #86): the state and props of an element the app renders in a row (a
 * cell of it; `row` is a row's or a cell's info), which drags the row once a press on it moves
 * past a click's slop, while the grid's rows move (`onRowMove` on `DataGrid.Root`), it is not
 * sorted and the row is loaded (`state.reorderable`; else a press is a plain press: render it
 * disabled, or none). The props mark it for the engine and hide it from assistive technologies:
 * the keys move a row from its cells (Ctrl/⌘+Shift+↑/↓). `data-reorderable` while a press on it
 * can drag its row, `data-dragging` while a drag on it is moving its row. Its look, cursor and `touch-action: none` are the app's: it has
 * no style of its own.
 */
export function useRowDragHandle(row: {
    readonly rowIndex: number;
    readonly loaded: boolean;
}): PartHookResult<RowDragHandleState> {
    const view = useGridView();
    const { state, attributes } = rowDragHandlePart(
        view,
        row.rowIndex,
        row.loaded,
    );
    return controlPart(state, attributes, dragHandleData);
}
