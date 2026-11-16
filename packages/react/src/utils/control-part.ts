import type {
    ColumnResizerState,
    FillHandleState,
    GroupToggleState,
    RowDragHandleState,
} from "@fragiola/data-grid";
import type { PartHookResult } from "../hooks/internal";
import { dataAttributes } from "./use-render";

/**
 * A control the app renders in a part (a resizer, a row's drag handle, a fill handle, a group's
 * toggle): its state, and while it has its attributes (`undefined`: none to render), them and
 * its `data-*` (`dataOf` its state, a module function: nothing is allocated for a control with
 * none), with no style of its own.
 */
export function controlPart<S>(
    state: S,
    attributes: Record<string, unknown> | undefined,
    dataOf: (state: S) => Parameters<typeof dataAttributes>[0],
): PartHookResult<S> {
    return {
        state,
        props: attributes
            ? { ...attributes, ...dataAttributes(dataOf(state)), style: {} }
            : { style: {} },
    };
}

/** The controls' `data-*`, from their state. */
export const resizerData = (state: ColumnResizerState) => ({
    "grid-part": "column-resizer",
    resizing: state.resizing,
});
export const dragHandleData = (state: RowDragHandleState) => ({
    "grid-part": "row-drag-handle",
    reorderable: state.reorderable,
    dragging: state.dragging,
});
export const fillHandleData = (state: FillHandleState) => ({
    "grid-part": "fill-handle",
    filling: state.filling,
});
export const groupToggleData = (state: GroupToggleState) => ({
    "grid-part": "group-toggle",
    expanded: state.expanded,
});
