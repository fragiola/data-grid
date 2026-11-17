// @fragiola/data-grid-react/fill: the fill handle (Epic #88, E4.4; a feature since Epic #144), the
// core's (`@fragiola/data-grid/fill`) re-exported, and `useFillHandle`, the handle's element. An
// opt-in entry point: the primitives never import it, and an app that never installs the fill
// handle never ships it.

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
