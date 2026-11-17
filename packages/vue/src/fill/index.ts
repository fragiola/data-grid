// @fragiola/data-grid-vue/fill: the fill handle feature (Epic #88, a feature since Epic #144):
// the core's (`@fragiola/data-grid/fill`, `fillHandle()`, it requires `cellRange()`) and the
// handle's composable, `useFillHandle`. An opt-in entry point: the primitives never import it,
// and an app that never installs the fill handle never ships it.

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
export { useFillHandle } from "./use-fill-handle";
