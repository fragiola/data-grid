// @fragiola/data-grid/pagination: the pagination feature (Epic #153). An opt-in entry point: the
// grid's own entry never imports it, and an app that never installs it never ships it.

export { pageCount, pagination } from "./pagination";
export type {
    PageInfo,
    PaginationProps,
    PaginationState,
    PaginationTypes,
} from "./types";
