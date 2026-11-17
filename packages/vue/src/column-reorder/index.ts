// @fragiola/data-grid-vue/column-reorder: column reordering (Epic #75; a feature since Epic #148):
// the core's (`@fragiola/data-grid/column-reorder`, `columnReorder()`). An opt-in entry point:
// the primitives never import it, and an app that never installs reordering never ships it.

export {
    type ColumnReorderProps,
    type ColumnReorderState,
    type ColumnReorderTypes,
    type ColumnReorderView,
    columnReorder,
    keptOrder,
    sameOrder,
} from "@fragiola/data-grid/column-reorder";
