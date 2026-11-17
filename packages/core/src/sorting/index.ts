// @fragiola/data-grid/sorting: the sorting feature (Epic #27; a feature since Epic #141). An
// opt-in entry point: the grid's own entry never imports it, and an app that never installs it
// never ships it.

export { sameSortColumns, validSortColumns } from "./sort";
export {
    type HeaderCellSort,
    headerCellSort,
    sortColumnsOf,
    sorting,
} from "./sorting";
export type {
    SortColumn,
    SortDirection,
    SortingProps,
    SortingState,
    SortingTypes,
} from "./types";
