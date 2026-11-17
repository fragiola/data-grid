// @fragiola/data-grid-angular/column-pinning: pinned columns (Epic #85, E1.1; a feature since Epic
// #148), for an app that installs only this package: the core's
// (`@fragiola/data-grid/column-pinning`, `columnPinning()`; it has no root input). An opt-in entry
// point: the directives never import it, and an app that never installs pinning never ships it
// (every column scrolls).

export {
    columnPinning,
    type PinnedColumnKeys,
    type PinningTypes,
} from "@fragiola/data-grid/column-pinning";
