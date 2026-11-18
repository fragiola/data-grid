// @fragiola/data-grid-react/filtering: the filtering feature (Epic #153), for an app that installs
// only this package. React has no filtering code of its own: this is the core's
// (`@fragiola/data-grid/filtering`). An opt-in entry point: the primitives never import it, and an
// app that never installs filtering() never ships it.

export {
    type ColumnFilters,
    columnFiltersOf,
    type FilteringProps,
    type FilteringState,
    type FilteringTypes,
    filterableColumn,
    filtering,
    sameFilters,
    validColumnFilters,
} from "@fragiola/data-grid/filtering";
