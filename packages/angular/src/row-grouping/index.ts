// @fragiola/data-grid-angular/row-grouping: row groups and trees (Epic #87, E3.1; a feature since
// Epic #151), for an app that installs only this package: the core's
// (`@fragiola/data-grid/row-grouping`, `rowGrouping()`), the root's inputs
// (`[dataGridRowGrouping]`), a group's toggle (`*dataGridGroupToggle`) and its injection
// function. An opt-in entry point: the directives never import it, and an app that never installs
// grouping never ships it (group rows render as rows, but nothing expands them).

export {
    type GroupTogglePart,
    type GroupToggleState,
    groupTogglePart,
    groupTogglePartOf,
    type RowGroupingProps,
    type RowGroupingState,
    type RowGroupingTypes,
    type RowGroupingView,
    rowGrouping,
} from "@fragiola/data-grid/row-grouping";
export {
    DataGridGroupToggle,
    type GroupToggleContext,
} from "./group-toggle.directive";
export { injectGroupToggle } from "./inject-group-toggle";
export { DataGridRowGrouping } from "./row-grouping.directive";
