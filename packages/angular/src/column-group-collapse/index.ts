// @fragiola/data-grid-angular/column-group-collapse: collapsible column groups (Epic #85, E1.3; a
// feature since Epic #148), for an app that installs only this package: the core's
// (`@fragiola/data-grid/column-group-collapse`, `columnGroupCollapse()`), and the root's collapsed
// groups inputs (`[dataGridColumnGroupCollapse]`). An opt-in entry point: the directives never
// import it, and an app that never installs it never ships it (a collapsible group stays
// expanded).

export {
    type ColumnGroupCollapseProps,
    type ColumnGroupCollapseState,
    type ColumnGroupCollapseTypes,
    columnGroupCollapse,
} from "@fragiola/data-grid/column-group-collapse";
export { DataGridColumnGroupCollapse } from "./column-group-collapse.directive";
