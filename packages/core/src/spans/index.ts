// @fragiola/data-grid/spans: column spans in the body (Epic #85, E1.2; a feature since Epic
// #151). An opt-in entry point: the grid's own entry never imports it, and an app that never
// installs it never ships it (a column's `colSpan` is not asked: every body cell is one column).

export { cellSpans } from "./feature";
export type { CellSpansTypes } from "./types";
