// @fragiola/data-grid-vue/editing: cell editing (Epic #88, E4.3; a feature since Epic #146): the
// core's (`@fragiola/data-grid/editing`, `editing()`, it requires `navigation()`) and an editor's
// composable, `useCellEdit`. An opt-in entry point: the primitives never import it, and an app
// that never installs editing never ships it (`DataGrid.Cell` renders a column's
// `renderEditCell` only with it installed).

export {
    type CellEditEvent,
    EDITOR_ATTRIBUTE,
    type EditActions,
    type EditingProps,
    type EditingState,
    type EditingTypes,
    type EditingView,
    editActions,
    editCellPropsOf,
    editing,
    sameEditingCell,
} from "@fragiola/data-grid/editing";
export { useCellEdit } from "./use-cell-edit";
