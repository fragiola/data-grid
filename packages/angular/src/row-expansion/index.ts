// @fragiola/data-grid-angular/row-expansion: expanded rows and their details (M1–M4; a feature
// since Epic #151), for an app that installs only this package: the core's
// (`@fragiola/data-grid/row-expansion`, `rowExpansion()`), the root's inputs
// (`[dataGridRowExpansion]`), a row's detail (`*dataGridRowDetail`) and its injection function.
// An opt-in entry point: the directives never import it, and an app that never installs
// expansion never ships it (no row expands, no detail renders).

export {
    ariaRowDetail,
    type RowDetailPart,
    type RowDetailState,
    type RowExpansionCommands,
    type RowExpansionOptions,
    type RowExpansionProps,
    type RowExpansionQueries,
    type RowExpansionState,
    type RowExpansionTypes,
    rowDetailPart,
    rowDetailPartOf,
    rowExpansion,
} from "@fragiola/data-grid/row-expansion";
export { injectRowDetail } from "./inject-row-detail";
export {
    DataGridRowDetail,
    type RowDetailContext,
} from "./row-detail.directive";
export { DataGridRowExpansion } from "./row-expansion.directive";
