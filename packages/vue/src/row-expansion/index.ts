// @fragiola/data-grid-vue/row-expansion: expanded rows and their details (M1–M4), a feature since
// Epic #151: the core's (`@fragiola/data-grid/row-expansion`, `rowExpansion()`), the `RowDetail`
// primitive and its composable, `useRowDetail`. An opt-in entry point: the primitives never import
// it, and an app that never installs row expansion never ships it.

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
export {
    RowDetail,
    type RowDetailProps,
    type RowDetailSlots,
} from "./row-detail";
export { useRowDetail } from "./use-row-detail";
