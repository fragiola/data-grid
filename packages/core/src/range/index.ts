// @fragiola/data-grid/range: cell ranges (Epic #88, E4.1; a feature since Epic #144). An opt-in
// entry point: the grid's own entry never imports it, and an app that never installs it never
// ships it.

export { keptRange, sameCellRange } from "../model/range";
export { cellRange } from "./feature";
export type { CellRangeProps, CellRangeState, CellRangeTypes } from "./types";
