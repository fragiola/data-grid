// @fragiola/data-grid-angular/spans: column spans in the body (Epic #85, E1.2; a feature since
// Epic #151), for an app that installs only this package: the core's
// (`@fragiola/data-grid/spans`, `cellSpans()`). No input of its own: a column's `colSpan` spans
// once it is installed. An opt-in entry point: the directives never import it.

export { type CellSpansTypes, cellSpans } from "@fragiola/data-grid/spans";
