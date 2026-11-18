// @fragiola/data-grid-vue/row-reorder: rows moved by their drag handles and the keys (Epic #86,
// E2.3), a feature since Epic #151: the core's (`@fragiola/data-grid/row-reorder`, `rowReorder()`)
// and a drag handle's composable, `useRowDragHandle`. An opt-in entry point: the primitives never
// import it, and an app that never installs row reorder never ships it.

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
export { useRowDragHandle } from "./use-row-drag-handle";
