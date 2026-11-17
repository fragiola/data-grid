// @fragiola/data-grid-angular/fill: the fill handle feature (Epic #88, E4.4; a feature since Epic
// #144), for an app that installs only this package: the core's (`@fragiola/data-grid/fill`), the
// root's fill output (`[dataGridFill]`), the handle's element (`*dataGridFillHandle`) and its
// injection function. An opt-in entry point: the directives never import it, and an app that
// never installs the fill handle never ships it.

export {
    type FilledCell,
    type FillHandlePart,
    type FillHandleProps,
    type FillHandleState,
    type FillHandleTypes,
    type FillView,
    fillHandle,
    fillHandlePart,
    fillHandlePartOf,
    fillTargetOf,
    repeatedFill,
} from "@fragiola/data-grid/fill";
export { DataGridFill } from "./fill.directive";
export {
    DataGridFillHandle,
    type FillHandleContext,
} from "./fill-handle.directive";
export { injectFillHandle } from "./inject-fill-handle";
