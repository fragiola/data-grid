// @fragiola/data-grid-vue/sorting: the sorting feature (Epic #141), for an app that installs only
// this package. Vue has no sorting code of its own: this is the core's
// (`@fragiola/data-grid/sorting`). An opt-in entry point: the primitives never import it, and an
// app that never installs sorting never ships it.

export {
    type HeaderCellSort,
    headerCellSort,
    type SortColumn,
    type SortDirection,
    type SortingProps,
    type SortingState,
    type SortingTypes,
    sameSortColumns,
    sorting,
    validSortColumns,
} from "@fragiola/data-grid/sorting";
