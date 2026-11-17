// @fragiola/data-grid-angular/editing: cell editing (Epic #88, E4.3; a feature since Epic #146),
// for an app that installs only this package: the core's (`@fragiola/data-grid/editing`,
// `editing()`, it requires `navigation()`), the root's edit inputs and outputs
// (`[dataGridEditing]`), an editor's template (`*dataGridCellEdit`) and its injection function.
// An opt-in entry point: the directives never import it, and an app that never installs editing
// never ships it (`*dataGridCellContent` renders a column's `renderEditCell` only with it).

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
export {
    type CellEditContext,
    DataGridCellEdit,
} from "./cell-edit.directive";
export { DataGridEditing } from "./editing.directive";
export { injectCellEdit } from "./inject-cell-edit";
