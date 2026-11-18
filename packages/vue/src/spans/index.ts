// @fragiola/data-grid-vue/spans: column spans in the body (Epic #85, E1.2), a feature since Epic
// #151: the core's (`@fragiola/data-grid/spans`, `cellSpans()`) re-exported. An opt-in entry
// point: the primitives never import it, and an app that never installs it never ships it.

export { type CellSpansTypes, cellSpans } from "@fragiola/data-grid/spans";
