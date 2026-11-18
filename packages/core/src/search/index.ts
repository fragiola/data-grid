// @fragiola/data-grid/search: the search feature (Epic #153). An opt-in entry point: the grid's
// own entry never imports it, and an app that never installs it never ships it.

export { search } from "./search";
export type { SearchProps, SearchState, SearchTypes } from "./types";
