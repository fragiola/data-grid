// @fragiola/data-grid-react/column-resize: column resizing (Epic #70) and fitting (Epic #80), a
// feature since Epic #148: the core's (`@fragiola/data-grid/column-resize`) re-exported, and
// `useColumnResizer`, a resizer's props. An opt-in entry point: the primitives never import it,
// and an app that never installs resizing never ships it.

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
export { useColumnResizer } from "./use-column-resizer";
