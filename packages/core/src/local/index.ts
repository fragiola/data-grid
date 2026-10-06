// @fragiola/data-grid/local: rows in memory, filtered, searched, sorted, grouped (Epic #87) and
// paged (Epic #47). An opt-in entry point: the grid itself never orders, filters or groups rows,
// and an app that never imports this never ships it.

export { indexAfterMove } from "../utils";
export type { LocalFilters } from "./filter";
export {
    type GroupedRows,
    groupKeyOf,
    type LocalGrouping,
} from "./group";
export { moveRow, moveShownRow, shownRowMove } from "./move";
export { pageCount } from "./page";
export {
    createLocalRows,
    filterRows,
    groupRows,
    type LocalRows,
    type LocalRowsOptions,
    type LocalRowsState,
    type LocalRowsView,
    pageRows,
    searchRows,
    sortRows,
} from "./rows";
