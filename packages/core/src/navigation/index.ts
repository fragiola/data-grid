// @fragiola/data-grid/navigation: cell navigation (D11; a feature since Epic #144). An opt-in entry
// point: the grid's own entry never imports it, and an app that never installs it never ships it.

export { navigation, samePosition } from "./feature";
export type { NavigationProps, NavigationTypes } from "./types";
