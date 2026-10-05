// @fragiola/data-grid/local: rows in memory, filtered, searched, sorted and paged (Epic #47). An
// opt-in entry point: the grid itself never orders or filters rows, and an app that never imports
// this never ships it.

export type { LocalFilters } from "./filter";
export { moveRow, moveShownRow } from "./move";
export { pageCount } from "./page";
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
