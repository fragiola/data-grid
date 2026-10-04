import { loadedRowKey } from "./expansion";
import { rowAt } from "./source";
import type {
    CommandError,
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

/** Whether a value is a selection mode. */
export function isRowSelectionMode(value: unknown): value is RowSelection {
    return value === "single" || value === "multiple";
}

/** What tells whether a row is selected, or can be: the model's state, or a view. */
export type RowSelectionState<TRow> = Pick<
    DataGridState<TRow>,
    | "source"
    | "rowCount"
    | "rowKey"
    | "rowSelection"
    | "selectedRowKeys"
    | "isRowSelectable"
>;

type Selecting<TRow> = RowSelectionState<TRow> &
    Pick<DataGridState<TRow>, "selectionAnchor">;

type Outcome =
    | { readonly ok: true; readonly keys: readonly RowKey[] }
    | { readonly ok: false; readonly error: CommandError };

const sets = new WeakMap<readonly RowKey[], ReadonlySet<RowKey>>();

/** The keys as a set, built once per list (the state's lists are never mutated). */
export function keySet(keys: readonly RowKey[]): ReadonlySet<RowKey> {
    let set = sets.get(keys);
    if (!set) {
        set = new Set(keys);
        sets.set(keys, set);
    }
    return set;
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
    if (!Number.isInteger(rowIndex) || rowIndex < 0) return false;
    if (rowIndex >= state.rowCount) return false;
    const row = rowAt(state.source, rowIndex);
    return row !== undefined && selectable(state, row, rowIndex);
}

/** The refusal of a command that needs a row not loaded: its key is unknown. */
export function notLoaded(rowIndex: number): {
    readonly ok: false;
    readonly error: CommandError;
} {
    return {
        ok: false,
        error: {
            code: "not_loaded",
            message: `row ${rowIndex} is not loaded: its key is unknown`,
        },
    };
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
    const keys = state.selectedRowKeys;
    if (keySet(keys).has(key)) return keys.filter((entry) => entry !== key);
    return state.rowSelection === "single" ? [key] : [...keys, key];
}

/**
 * Every selectable row from the anchor to `rowIndex` (both included) given the anchor's state:
 * added when it selects, removed when not. Without an anchor, `undefined`: the caller toggles.
 */
export function extendedKeys<TRow>(
    state: Selecting<TRow>,
    rowIndex: number,
): Outcome | undefined {
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
        range.push(state.rowKey ? state.rowKey(row, index) : index);
    }
    const selected = keySet(state.selectedRowKeys);
    if (select) {
        const added = range.filter((key) => !selected.has(key));
        return {
            ok: true,
            keys:
                added.length === 0
                    ? state.selectedRowKeys
                    : [...new Set([...state.selectedRowKeys, ...added])],
        };
    }
    const removed = new Set(range);
    return {
        ok: true,
        keys: state.selectedRowKeys.filter((key) => !removed.has(key)),
    };
}

/** The keys with every selectable row's added; a row not loaded refuses it all. */
export function allKeys<TRow>(state: Selecting<TRow>): Outcome {
    const keys = new Set(state.selectedRowKeys);
    const before = keys.size;
    for (let index = 0; index < state.rowCount; index++) {
        const row = rowAt(state.source, index);
        if (row === undefined) return notLoaded(index);
        if (!selectable(state, row, index)) continue;
        keys.add(state.rowKey ? state.rowKey(row, index) : index);
    }
    return {
        ok: true,
        keys: keys.size === before ? state.selectedRowKeys : [...keys],
    };
}
