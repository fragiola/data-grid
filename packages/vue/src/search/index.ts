// @fragiola/data-grid-vue/search: the search feature (Epic #153), for an app that installs
// only this package. Vue has no search code of its own: this is the core's
// (`@fragiola/data-grid/search`). An opt-in entry point: the primitives never import it, and an
// app that never installs search() never ships it.

export {
    type SearchProps,
    type SearchState,
    type SearchTypes,
    search,
} from "@fragiola/data-grid/search";
