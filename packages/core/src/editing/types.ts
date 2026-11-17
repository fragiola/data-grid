import type { CellEdit } from "../engine/types";
import type { FeatureTypes } from "../feature/feature";
import type {
    CellKeys,
    CellPosition,
    EditingCell,
    NoPayload,
} from "../model/types";

/** What cell editing keeps in the model's state (Epic #88, E4.3). */
export interface EditingState {
    /**
     * the cell being edited, the active one; `null` for none. The draft is an engine's
     * (`edit-draft`)
     */
    readonly editingCell: EditingCell | null;
    /** the keys the edit started on (`null` without one): its row and column, kept by them */
    readonly editingKeys: CellKeys | null;
}

/** What an engine's view carries of the edit (`view as GridView & EditingView`). */
export interface EditingView {
    /** the cell being edited: its part is `editing`, its editor rendered */
    readonly editingCell: EditingCell | null;
}

/**
 * An edit committed (Epic #88, E4.3), as `onCellEdit` tells it: the cell, its column's key, the
 * value, and the row (loaded: a cell is edited only then), which the app writes it into.
 */
export interface CellEditEvent<TRow> extends CellEdit {
    readonly row: TRow;
}

/** What cell editing adds to a root's props: the edited cell (controlled or not), a commit told. */
export interface EditingProps<TRow> {
    /**
     * the cell being edited (Epic #88): the active one, of a column `editable` for its row;
     * controlled (`null` for none), paired with `onEditingCellChange`
     */
    editingCell?: EditingCell | null | undefined;
    /** the cell being edited to start with, uncontrolled */
    defaultEditingCell?: EditingCell | null | undefined;
    /**
     * an edit started or ended (or, controlled, asks to): Enter, F2, typing or a double click
     * on an editable cell; a commit (Enter, Tab, a click outside) or a cancel (Escape)
     */
    onEditingCellChange?:
        | ((editingCell: EditingCell | null) => void)
        | undefined;
    /**
     * an edit was committed with a new value (Epic #88): the cell, its column's key, the value
     * and the row. Write it into your rows: the grid writes no data
     */
    onCellEdit?: ((edit: CellEditEvent<TRow>) => void) | undefined;
}

/**
 * Cell editing's types (Epic #88, E4.3; a feature since Epic #146): the edited cell's state, its
 * commands and keys, a root's props. The draft is an engine's (`edit-draft`); what an editor
 * looks like is the app's (a column's `renderEditCell`).
 */
export interface EditingTypes extends FeatureTypes {
    readonly state: EditingState;
    readonly options: {
        /** the cell being edited to start with: the active one, an editable cell (default none) */
        readonly editingCell?: EditingCell | null | undefined;
    };
    readonly commands: {
        /**
         * edits a cell: the active one, a loaded data row's cell whose column is editable for it
         * (`refused` otherwise, `not_loaded` for a row not loaded yet; a header, a summary row's
         * or a group row's cell never is), with the printable key that started it. A position
         * inside a cell's span edits that cell. Returns the edited cell
         */
        "editing-cell.set": {
            payload: EditingCell;
            result: EditingCell;
        };
        /** ends the edit, if any (its draft is an engine's: `commit-edit` tells it first) */
        "editing-cell.clear": {
            payload: NoPayload;
            result: undefined;
        };
    };
    readonly queries: {
        /** the cell being edited, or `null` */
        "editing-cell": { payload: undefined; result: EditingCell | null };
    };
    readonly questions: {
        /**
         * whether a cell can be edited: a loaded data row's body cell whose column is editable for
         * it (the active one or not)
         */
        "cell-editable": CellPosition;
    };
    readonly props: EditingProps<this["row"]>;
}
