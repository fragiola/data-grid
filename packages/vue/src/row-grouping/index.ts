// @fragiola/data-grid-vue/row-grouping: row groups and trees (Epic #87), a feature since Epic
// #151: the core's (`@fragiola/data-grid/row-grouping`, `rowGrouping()`) and a group toggle's
// composable, `useGroupToggle`. An opt-in entry point: the primitives never import it, and an app
// that never installs row grouping never ships it.

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
export { useGroupToggle } from "./use-group-toggle";
