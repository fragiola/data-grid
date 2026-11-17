// @fragiola/data-grid/editing: cell editing (Epic #88, E4.3; a feature since Epic #146). An opt-in
// entry point: the grid's own entry never imports it, and an app that never installs it never
// ships it.

export {
    EDITOR_ATTRIBUTE,
    type EditActions,
    editActions,
    editCellPropsOf,
} from "./edit";
export { sameEditingCell } from "./editing";
export { editing } from "./feature";
export type {
    CellEditEvent,
    EditingProps,
    EditingState,
    EditingTypes,
    EditingView,
} from "./types";
