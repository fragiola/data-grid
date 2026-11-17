// @fragiola/data-grid/fill: the fill handle (Epic #88, E4.4; a feature since Epic #144) and its
// helper. An opt-in entry point: the grid's own entry never imports it, and an app that never
// installs it never ships it.

export { fillHandle } from "./feature";
export {
    type FillHandlePart,
    type FillHandleState,
    type FillView,
    fillHandlePart,
    fillHandlePartOf,
    fillTargetOf,
} from "./parts";
export { type FilledCell, repeatedFill } from "./repeat";
export type { FillHandleProps, FillHandleTypes } from "./types";
