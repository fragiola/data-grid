import { keySet, toggledKey } from "../utils";
import { fail } from "./result";
import {
    keyOf,
    loadedRow,
    loadedRowKey,
    type RowsState,
    rowAt,
} from "./source";
import type {
    CommandFailure,
    CommandResult,
    DataGridState,
    RowKey,
    RowSelection,
    SelectionAnchor,
} from "./types";

// Selected rows (R1–R5): the model keeps their keys, the app's state, and nothing derived from
// them. Whether a row is selected is its key in a `Set` built once per key list: O(1) a row,
// never a scan of the rows. A range and select-all need every key on their way, so a row not
// loaded there refuses them as a whole: nothing is selected by half.

/** The selection modes, for validation. */
export const ROW_SELECTIONS: readonly RowSelection[] = ["single", "multiple"];

/** What tells whether a row is selected, or can be: the model's state, or a view. */
type RowSelectionState<TRow> = RowsState<TRow> &
    Pick<
        DataGridState<TRow>,
        "rowSelection" | "selectedRowKeys" | "isRowSelectable"
    >;

type Selecting<TRow> = RowSelectionState<TRow> &
    Pick<DataGridState<TRow>, "selectionAnchor">;

/** Whether two anchors are the same key, at the same index, giving the same state. */
export function sameAnchor(
    a: SelectionAnchor | null,
    b: SelectionAnchor | null,
): boolean {
    return (
        a?.rowKey === b?.rowKey &&
        a?.rowIndex === b?.rowIndex &&
        a?.selected === b?.selected
    );
}

/** The keys a mode keeps: in single mode, the last one only. */
export function keptRowKeys(
    keys: readonly RowKey[],
    mode: RowSelection | undefined,
): readonly RowKey[] {
    return mode === "single" && keys.length > 1 ? keys.slice(-1) : keys;
}

/** Whether a loaded row can be selected, the rows being selectable. */
function selectable<TRow>(
    state: RowSelectionState<TRow>,
    row: TRow,
    rowIndex: number,
): boolean {
    return state.isRowSelectable?.(row, rowIndex) ?? true;
}

/** Whether the row is selected: rows are selectable, it is loaded and its key is selected. */
export function isRowSelected<TRow>(
    state: RowSelectionState<TRow>,
    rowIndex: number,
): boolean {
    if (!state.rowSelection || state.selectedRowKeys.length === 0) return false;
    const key = loadedRowKey(state, rowIndex);
    return key !== undefined && keySet(state.selectedRowKeys).has(key);
}

/** Whether the row can be selected: rows are selectable, it is loaded and not refused. */
export function isRowSelectable<TRow>(
    state: RowSelectionState<TRow>,
    rowIndex: number,
): boolean {
    if (!state.rowSelection) return false;
    const row = loadedRow(state, rowIndex);
    return row !== undefined && selectable(state, row, rowIndex);
}

/** The refusal of a command that needs a row not loaded: its key is unknown. */
export function notLoaded(rowIndex: number): CommandFailure {
    return fail(
        "not_loaded",
        `row ${rowIndex} is not loaded: its key is unknown`,
    );
}

/** The anchor, when its key is still at its index. */
export function validAnchor<TRow>(
    state: Selecting<TRow>,
): SelectionAnchor | null {
    const anchor = state.selectionAnchor;
    if (!anchor) return null;
    return loadedRowKey(state, anchor.rowIndex) === anchor.rowKey
        ? anchor
        : null;
}

/**
 * The anchor once the keys are `keys`: kept while its row's state is the one it gives a range;
 * the keys changed it by other means (cleared it, selected it), no range starts there.
 */
export function keptAnchor(
    anchor: SelectionAnchor | null,
    keys: readonly RowKey[],
): SelectionAnchor | null {
    if (!anchor) return null;
    return keySet(keys).has(anchor.rowKey) === anchor.selected ? anchor : null;
}

/** One row toggled, by its key (single mode: alone). */
export function toggledKeys<TRow>(
    state: Selecting<TRow>,
    key: RowKey,
): readonly RowKey[] {
    return toggledKey(
        state.selectedRowKeys,
        key,
        state.rowSelection === "single",
    );
}

/**
 * Every selectable row from the anchor to `rowIndex` (both included) given the anchor's state:
 * added when it selects, removed when not. Without an anchor, `undefined`: the caller toggles.
 */
export function extendedKeys<TRow>(
    state: Selecting<TRow>,
    rowIndex: number,
): CommandResult<readonly RowKey[]> | undefined {
    const anchor = validAnchor(state);
    if (!anchor) return undefined;
    const select = anchor.selected;
    const start = Math.min(anchor.rowIndex, rowIndex);
    const end = Math.max(anchor.rowIndex, rowIndex);
    const range: RowKey[] = [];
    for (let index = start; index <= end; index++) {
        const row = rowAt(state.source, index);
        if (row === undefined) return notLoaded(index);
        if (!selectable(state, row, index)) continue;
        range.push(keyOf(state, row, index));
    }
    const selected = keySet(state.selectedRowKeys);
    if (select) {
        const added = range.filter((key) => !selected.has(key));
        return {
            ok: true,
            value:
                added.length === 0
                    ? state.selectedRowKeys
                    : [...new Set([...state.selectedRowKeys, ...added])],
        };
    }
    const removed = new Set(range);
    return {
        ok: true,
        value: state.selectedRowKeys.filter((key) => !removed.has(key)),
    };
}

/** The keys with every selectable row's added; a row not loaded refuses it all. */
export function allKeys<TRow>(
    state: Selecting<TRow>,
): CommandResult<readonly RowKey[]> {
    const keys = new Set(state.selectedRowKeys);
    const before = keys.size;
    for (let index = 0; index < state.rowCount; index++) {
        const row = rowAt(state.source, index);
        if (row === undefined) return notLoaded(index);
        if (!selectable(state, row, index)) continue;
        keys.add(keyOf(state, row, index));
    }
    return {
        ok: true,
        value: keys.size === before ? state.selectedRowKeys : [...keys],
    };
}
