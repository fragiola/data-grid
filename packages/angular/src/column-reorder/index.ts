// @fragiola/data-grid-angular/column-reorder: column reordering (Epic #75; a feature since Epic
// #148), for an app that installs only this package: the core's
// (`@fragiola/data-grid/column-reorder`, `columnReorder()`), and the root's order inputs
// (`[dataGridColumnReorder]`). An opt-in entry point: the directives never import it, and an app
// that never installs reordering never ships it.

export {
    type ColumnReorderProps,
    type ColumnReorderState,
    type ColumnReorderTypes,
    type ColumnReorderView,
    columnReorder,
    keptOrder,
    sameOrder,
} from "@fragiola/data-grid/column-reorder";
export { DataGridColumnReorder } from "./column-reorder.directive";
