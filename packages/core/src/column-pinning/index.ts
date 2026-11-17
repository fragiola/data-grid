// @fragiola/data-grid/column-pinning: pinned columns (Epic #85, E1.1; a feature since Epic #148).
// An opt-in entry point: the grid's own entry never imports it, and an app that never installs it
// never ships it (its columns' `pinned` is ignored: every column scrolls).

export { columnPinning } from "./feature";
export type { PinnedColumnKeys, PinningTypes } from "./types";
