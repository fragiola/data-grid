// @fragiola/data-grid/local: rows in memory, filtered, searched, sorted and paged (Epic #47). An
// opt-in entry point: the grid itself never orders or filters rows, and an app that never imports
// this never ships it.

export {
    isEmptyFilter,
    type LocalFilters,
    matchesFilter,
} from "./filter";
export { clampPageIndex, pageCount } from "./page";
export {
    createLocalRows,
    filterRows,
    type LocalRows,
    type LocalRowsOptions,
    type LocalRowsState,
    type LocalRowsView,
    pageRows,
    searchRows,
    sortRows,
} from "./rows";
export { compareValues, isEmptyValue } from "./values";
