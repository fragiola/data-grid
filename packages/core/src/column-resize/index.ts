// @fragiola/data-grid/column-resize: column resizing (Epic #70) and fitting (Epic #80), a feature
// since Epic #148. An opt-in entry point: the grid's own entry never imports it, and an app that
// never installs it never ships it (a column is its declared width).

export { columnResize } from "./feature";
export { columnResizerPart, columnResizerPartOf } from "./parts";
export type {
    ColumnResizeProps,
    ColumnResizeState,
    ColumnResizeTypes,
    ColumnResizeView,
} from "./types";
export { keptWidths } from "./widths";
