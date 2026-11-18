// @fragiola/data-grid-react/row-expansion: expanded rows and their details (M1–M4), a feature
// since Epic #151: the core's (`@fragiola/data-grid/row-expansion`) re-exported, `RowDetail` and
// `useRowDetail`. An opt-in entry point: the primitives never import it, and an app that never
// installs row expansion never ships it.

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
export { RowDetail, type RowDetailProps } from "./row-detail";
export { useRowDetail } from "./use-row-detail";
