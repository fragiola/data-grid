// @fragiola/data-grid-vue/pagination: the pagination feature (Epic #153), for an app that installs
// only this package. Vue has no pagination code of its own: this is the core's
// (`@fragiola/data-grid/pagination`). An opt-in entry point: the primitives never import it, and an
// app that never installs pagination() never ships it.

export {
    type PageInfo,
    type PaginationProps,
    type PaginationState,
    type PaginationTypes,
    pageCount,
    pagination,
} from "@fragiola/data-grid/pagination";
