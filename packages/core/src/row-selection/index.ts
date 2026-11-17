// @fragiola/data-grid/row-selection: row selection (Epic #57, R1–R9; a feature since Epic #144)
// and its helpers over key lists. An opt-in entry point: the grid's own entry never imports it,
// and an app that never installs it never ships it.

export { rowSelection } from "./feature";
export {
    type SelectAllState,
    type SelectionStatus,
    selectAllState,
    selectAllToggled,
    selectionStatus,
    toggledRowKeys,
    withoutRowKeys,
    withRowKeys,
} from "./status";
export type {
    RowSelectionCommands,
    RowSelectionOptions,
    RowSelectionProps,
    RowSelectionState,
    RowSelectionTypes,
} from "./types";
