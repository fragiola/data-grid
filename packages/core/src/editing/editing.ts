import type { FeatureState } from "../feature/feature";
import { fail } from "../model/result";
import {
    cellKeysAt,
    dataRowAt,
    rowMetaAt,
    sameCellKeys,
} from "../model/source";
import type {
    CellPosition,
    Column,
    CommandFailure,
    DataGridState,
    EditingCell,
} from "../model/types";
import { sameCell } from "../navigation/navigation";
import { isIndex } from "../utils/utils";
import { overlaps } from "../viewport/window";
import type { EditingTypes } from "./types";

// Cell editing (Epic #88, E4.3; a feature since Epic #146): the model keeps which cell is edited,
// the active one, and the rule of which cells can be: a loaded data row's body cell whose column
// is editable for it. The draft is an engine's, and the data the app's (D6): a commit is told,
// never written.

/** The state as editing reads it: the core's and its own slice. */
export type State = FeatureState<EditingTypes>;

/** What tells whether a cell can be edited: the columns and the rows. */
type EditableState<TRow> = Pick<
    DataGridState<TRow>,
    "columns" | "source" | "rowCount" | "rowKey"
>;

/**
 * Why a cell cannot be edited, or `undefined` when it can: not a body cell (`not_found` past the
 * grid; `refused` for a header or a summary row's), its column not editable for its row, a group
 * row (`refused`), or a row not loaded yet (`not_loaded`).
 */
export function editRefusal<TRow>(
    state: EditableState<TRow>,
    { rowIndex, columnIndex }: CellPosition,
): CommandFailure | undefined {
    const column = state.columns[columnIndex];
    if (!column || !Number.isInteger(rowIndex)) {
        return fail(
            "not_found",
            `no cell at row ${rowIndex}, column ${columnIndex}`,
        );
    }
    if (!isIndex(rowIndex, state.rowCount)) {
        return fail(
            "refused",
            `row ${rowIndex} is no body row: a header or a summary row's cell is never edited`,
        );
    }
    const { editable } = column;
    if (!editable)
        return fail("refused", `column "${column.key}" is not editable`);
    const meta = rowMetaAt(state.source, rowIndex);
    if (meta?.group) {
        return fail(
            "refused",
            `row ${rowIndex} is a group row: it is never edited`,
        );
    }
    const row = dataRowAt(state.source, rowIndex, meta);
    if (row === undefined) {
        return fail("not_loaded", `row ${rowIndex} is not loaded`);
    }
    return editable === true || editable(row, rowIndex)
        ? undefined
        : fail(
              "refused",
              `column "${column.key}" is not editable for row ${rowIndex}`,
          );
}

/** Whether a cell can be edited (`is("cell-editable")`). */
export function isCellEditable<TRow>(
    state: EditableState<TRow>,
    position: CellPosition,
): boolean {
    return editRefusal(state, position) === undefined;
}

/** Whether a grid's columns edit at all: without one, nothing is asked. */
export function hasEditable<TRow, TNode>(
    columns: readonly Column<TRow, TNode>[],
): boolean {
    return columns.some((column) => column.editable);
}

/** Whether two edited cells (or none) are the same cell, started by the same key. */
export function sameEditingCell(
    a: EditingCell | null | undefined,
    b: EditingCell | null | undefined,
): boolean {
    if (!a || !b) return (a ?? null) === (b ?? null);
    return (
        a.rowIndex === b.rowIndex &&
        a.columnIndex === b.columnIndex &&
        a.startKey === b.startKey
    );
}

/**
 * The state after a command, its edit kept to its rule (E4.3): it stays on the cell it was set on,
 * by key (`withKeptEditing`), looked at only when what it depends on changed (the rows, or
 * `rows.changed` over its row, the columns, the active cell or the edit), never after an
 * unrelated command.
 */
export function withEditingRules(after: State, before: State): State {
    const editing = after.editingCell;
    if (!editing) return after;
    const shaped =
        after.source !== before.source || after.columns !== before.columns;
    const reread =
        after.rowsChanged !== before.rowsChanged &&
        overlaps(after.rowsChanged, editing.rowIndex, editing.rowIndex + 1);
    // an edit given to start with has no keys yet: it takes the ones it finds
    return shaped ||
        reread ||
        !after.editingKeys ||
        after.activePosition !== before.activePosition ||
        editing !== before.editingCell
        ? withKeptEditing(after)
        : after;
}

/**
 * The state with its edit kept to its rule (E4.3): the edited cell is the active one and stays
 * editable (its row loaded, a data row, its column editable for it); else no edit (its draft
 * dropped by the engine: nothing is told). The same object when it holds.
 */
export function withKeptEditing(state: State): State {
    const editing = state.editingCell;
    if (!editing) return state;
    const active = state.activePosition;
    // the keys at its position: another row or column there (a new order of the rows, rows
    // inserted above, new columns) ends it
    const keys =
        active !== null &&
        sameCell(active, editing) &&
        isCellEditable(state, editing)
            ? cellKeysAt(state, editing)
            : undefined;
    if (keys && (!state.editingKeys || sameCellKeys(keys, state.editingKeys))) {
        // an edit given to start with takes the keys it finds
        return state.editingKeys ? state : { ...state, editingKeys: keys };
    }
    return { ...state, editingCell: null, editingKeys: null };
}
