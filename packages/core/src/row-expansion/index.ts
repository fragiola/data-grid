// @fragiola/data-grid/row-expansion: expanded rows and their details (M1–M4; a feature since Epic
// #151). An opt-in entry point: the grid's own entry never imports it, and an app that never
// installs it never ships it (no row expands, no detail renders).

export { rowExpansion } from "./feature";
export {
    ariaRowDetail,
    type RowDetailPart,
    type RowDetailState,
    rowDetailPart,
    rowDetailPartOf,
} from "./parts";
export type {
    RowExpansionCommands,
    RowExpansionOptions,
    RowExpansionProps,
    RowExpansionQueries,
    RowExpansionState,
    RowExpansionTypes,
} from "./types";
