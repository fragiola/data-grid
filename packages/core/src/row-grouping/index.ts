// @fragiola/data-grid/row-grouping: row groups and trees (Epic #87, E3.1; a feature since Epic
// #151). An opt-in entry point: the grid's own entry never imports it, and an app that never
// installs it never ships it (group rows render as rows, but nothing expands them).

export { rowGrouping } from "./feature";
export {
    type GroupTogglePart,
    type GroupToggleState,
    groupTogglePart,
    groupTogglePartOf,
} from "./parts";
export type {
    RowGroupingProps,
    RowGroupingState,
    RowGroupingTypes,
    RowGroupingView,
} from "./types";
