// @fragiola/data-grid-react/range: ranges of cells (Epic #88, E4.1; a feature since Epic #144; it
// requires `navigation()`). React has no range code of its own: this is the core's
// (`@fragiola/data-grid/range`). An opt-in entry point: the primitives never import it, and an app
// that never installs it never ships it.

export {
    type CellRangeProps,
    type CellRangeState,
    type CellRangeTypes,
    cellRange,
    keptRange,
    sameCellRange,
} from "@fragiola/data-grid/range";
