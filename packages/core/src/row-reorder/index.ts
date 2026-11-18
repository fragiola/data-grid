// @fragiola/data-grid/row-reorder: rows moved by their drag handles and the keys (Epic #86, E2.3;
// a feature since Epic #151). An opt-in entry point: the grid's own entry never imports it, and an
// app that never installs it never ships it (a row's drag handle drags nothing).

export { rowReorder } from "./feature";
export {
    type RowDragHandlePart,
    type RowDragHandleState,
    rowDragHandlePart,
    rowDragHandlePartOf,
    rowsMove,
} from "./parts";
export type { RowReorderProps, RowReorderTypes, RowReorderView } from "./types";
