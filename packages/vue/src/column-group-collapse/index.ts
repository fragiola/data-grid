// @fragiola/data-grid-vue/column-group-collapse: collapsible column groups (Epic #85, E1.3; a
// feature since Epic #148): the core's (`@fragiola/data-grid/column-group-collapse`,
// `columnGroupCollapse()`). An opt-in entry point: the primitives never import it, and an app
// that never installs it never ships it (a collapsible group stays expanded).

export {
    type ColumnGroupCollapseProps,
    type ColumnGroupCollapseState,
    type ColumnGroupCollapseTypes,
    columnGroupCollapse,
} from "@fragiola/data-grid/column-group-collapse";
