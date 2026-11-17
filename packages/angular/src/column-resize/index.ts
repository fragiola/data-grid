// @fragiola/data-grid-angular/column-resize: column resizing (Epic #70) and fitting (Epic #80), a
// feature since Epic #148, for an app that installs only this package: the core's
// (`@fragiola/data-grid/column-resize`, `columnResize()`), the root's width inputs
// (`[dataGridColumnResize]`), a resizer's template (`*dataGridColumnResizer`) and its injection
// function. An opt-in entry point: the directives never import it, and an app that never installs
// resizing never ships it.

export {
    type ColumnResizeProps,
    type ColumnResizeState,
    type ColumnResizeTypes,
    type ColumnResizeView,
    columnResize,
    columnResizerPart,
    columnResizerPartOf,
    keptWidths,
} from "@fragiola/data-grid/column-resize";
export { DataGridColumnResize } from "./column-resize.directive";
export {
    type ColumnResizerContext,
    DataGridColumnResizer,
} from "./column-resizer.directive";
export { injectColumnResizer } from "./inject-column-resizer";
