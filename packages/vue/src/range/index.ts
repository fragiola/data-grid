// @fragiola/data-grid-vue/range: cell ranges (Epic #88, a feature since Epic #144), for an app
// that installs only this package. Vue has no range code of its own: this is the core's
// (`@fragiola/data-grid/range`, `cellRange()`, it requires `navigation()`): `Root` takes
// `cellSelection` and `selectedRange` / `defaultSelectedRange` / `onSelectedRangeChange`. An
// opt-in entry point: the primitives never import it.

export {
    type CellRangeProps,
    type CellRangeState,
    type CellRangeTypes,
    cellRange,
    keptRange,
    sameCellRange,
} from "@fragiola/data-grid/range";
