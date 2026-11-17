// @fragiola/data-grid/column-group-collapse: collapsible column groups (Epic #85, E1.3; a feature
// since Epic #148). An opt-in entry point: the grid's own entry never imports it, and an app that
// never installs it never ships it (a collapsible group stays expanded).

export { columnGroupCollapse } from "./feature";
export type {
    ColumnGroupCollapseProps,
    ColumnGroupCollapseState,
    ColumnGroupCollapseTypes,
} from "./types";
