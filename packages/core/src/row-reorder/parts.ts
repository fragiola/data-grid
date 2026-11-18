import { controlPart, type PartResult } from "../adapter/props";
import { ROW_DRAG_HANDLE_ATTRIBUTE } from "../engine/dom";
import type { GridView } from "../engine/types";
import type { DataGridState } from "../model/types";
import type { RowReorderView } from "./types";

// A row's drag handle (Epic #86, E2.3; row reorder's since Epic #151): the element the app renders
// in a row, marked for the engine (a press on it drags its row).

/** The state of a row's drag handle (Epic #86, E2.3): the element the app renders in its row. */
export interface RowDragHandleState {
    readonly rowIndex: number;
    /**
     * a press on it drags its row: the grid's rows move (`reorderableRows`), the grid is not
     * sorted and the row is loaded; else it does nothing (render it disabled, or none)
     */
    readonly reorderable: boolean;
    /** a drag on it is moving its row */
    readonly dragging: boolean;
}

/**
 * A row's drag handle's state and its attributes: marked with its row's index for the engine, and
 * hidden from assistive technologies (a pointer's way to move the row: the keys move it from its
 * cells, Ctrl/⌘+Shift+↑/↓).
 */
export interface RowDragHandlePart {
    readonly state: RowDragHandleState;
    readonly attributes: {
        readonly "aria-hidden": true;
        readonly [ROW_DRAG_HANDLE_ATTRIBUTE]: number;
    };
}

/**
 * Whether a grid's rows move now (E2.3): they move (`reorderableRows`), no feature keeps them in
 * an order of the app's (`rowsOrdered`: sorted, a move would not stay where it was dropped) and
 * its rows have no kinds (Epic #87: grouped, a row's place is its group's; moving rows between
 * groups is the app's).
 */
export function rowsMove(
    reorderableRows: boolean | undefined,
    rowsOrdered: boolean,
    source: DataGridState<unknown>["source"],
): boolean {
    return (
        reorderableRows === true &&
        !rowsOrdered &&
        source.getRowMeta === undefined
    );
}

/**
 * A row's drag handle's state and attributes (E2.3): it drags its row while rows move
 * (`rowsMove`) and the row is loaded.
 */
export function rowDragHandlePart<TRow, TNode>(
    given: GridView<TRow, TNode>,
    rowIndex: number,
    loaded: boolean,
): RowDragHandlePart {
    // its view's fields, row reorder's (none without it: a handle drags nothing)
    const view = given as GridView<TRow, TNode> & Partial<RowReorderView>;
    return {
        state: {
            rowIndex,
            reorderable:
                loaded &&
                rowsMove(view.reorderableRows, view.rowsOrdered, view.source),
            dragging:
                view.rowReorder != null &&
                view.rowReorder.rowIndex === rowIndex,
        },
        attributes: {
            "aria-hidden": true,
            [ROW_DRAG_HANDLE_ATTRIBUTE]: rowIndex,
        },
    };
}
const dragHandleData = (state: RowDragHandleState) => ({
    "grid-part": "row-drag-handle",
    reorderable: state.reorderable,
    dragging: state.dragging,
});

/** A row's drag handle's state and props (`useRowDragHandle`). */
export function rowDragHandlePartOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    row: { readonly rowIndex: number; readonly loaded: boolean },
): PartResult<RowDragHandleState> {
    const { state, attributes } = rowDragHandlePart(
        view,
        row.rowIndex,
        row.loaded,
    );
    return controlPart(state, attributes, dragHandleData);
}
