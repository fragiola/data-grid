import { isIndex } from "../utils";
import { fail } from "./result";
import { dataRowAt, rowMetaAt } from "./source";
import type {
    CellPosition,
    CommandFailure,
    DataGridState,
    EditingCell,
} from "./types";

// Cell editing (Epic #88, E4.3): the model keeps which cell is edited, the active one, and the
// rule of which cells can be: a loaded data row's body cell whose column is editable for it. The
// draft is an engine's, and the data the app's (D6): a commit is told, never written.

/** What tells whether a cell can be edited: the columns and the rows. */
type EditingState<TRow> = Pick<
    DataGridState<TRow>,
    "columns" | "source" | "rowCount" | "rowKey"
>;

/**
 * Why a cell cannot be edited, or `undefined` when it can: not a body cell (`not_found` past the
 * grid; `refused` for a header or a summary row's), its column not editable for its row, a group
 * row (`refused`), or a row not loaded yet (`not_loaded`).
 */
export function editRefusal<TRow>(
    state: EditingState<TRow>,
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
    state: EditingState<TRow>,
    position: CellPosition,
): boolean {
    return editRefusal(state, position) === undefined;
}

/** Whether a grid's columns edit at all: without one, nothing is asked. */
export function hasEditable<TRow, TNode>(
    columns: DataGridState<TRow, TNode>["columns"],
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
