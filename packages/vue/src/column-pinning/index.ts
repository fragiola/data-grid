// @fragiola/data-grid-vue/column-pinning: pinned columns (Epic #85, E1.1; a feature since Epic
// #148): the core's (`@fragiola/data-grid/column-pinning`, `columnPinning()`). An opt-in entry
// point: the primitives never import it, and an app that never installs pinning never ships it
// (every column scrolls).

export {
    columnPinning,
    type PinnedColumnKeys,
    type PinningTypes,
} from "@fragiola/data-grid/column-pinning";
