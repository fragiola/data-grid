// @fragiola/data-grid-angular/row-reorder: rows moved by their drag handles and the keys (Epic
// #86, E2.3; a feature since Epic #151), for an app that installs only this package: the core's
// (`@fragiola/data-grid/row-reorder`, `rowReorder()`), the root's row moves
// (`[dataGridRowReorder]`, `(rowMove)`), a row's drag handle (`[dataGridRowDragHandle]`) and its
// injection function. An opt-in entry point: the directives never import it, and an app that never
// installs it never ships it (a row's handle drags nothing).

export {
    type RowDragHandlePart,
    type RowDragHandleState,
    type RowReorderProps,
    type RowReorderTypes,
    type RowReorderView,
    rowDragHandlePart,
    rowDragHandlePartOf,
    rowReorder,
    rowsMove,
} from "@fragiola/data-grid/row-reorder";
export { injectRowDragHandle } from "./inject-row-drag-handle";
export { DataGridRowDragHandle } from "./row-drag-handle.directive";
export { DataGridRowReorder } from "./row-reorder.directive";
