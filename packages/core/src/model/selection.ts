import { keySet, toggledKey } from "../utils";
import { fail, ok } from "./result";
import {
    dataRowAt,
    groupExpanded,
    keyOf,
    type RowsState,
    rowKeyAt,
    rowMetaAt,
} from "./source";
import type {
    CommandFailure,
    CommandResult,
    DataGridState,
    GroupRow,
    RowKey,
    RowMeta,
    RowSelection,
    SelectionAnchor,
} from "./types";

// Selected rows (R1–R5): the model keeps their keys, the app's state, and nothing derived from
// them. Whether a row is selected is its key in a `Set` built once per key list: O(1) a row,
// never a scan of the rows. A range and select-all need every key on their way, so a row not
// loaded there refuses them as a whole: nothing is selected by half.
//
// A group row (Epic #87) has no key of its own to select: it selects its rows' keys
// (`GroupRow.rowKeys`, as given: the app lists the selectable ones), and shows selected while
// every one of them is. A range and select-all take a group row's keys too: the rows of a
// collapsed group are not on screen, and are selected all the same.

/** The selection modes, for validation. */
export const ROW_SELECTIONS: readonly RowSelection[] = ["single", "multiple"];

/** What tells whether a row is selected, or can be: the model's state, or a view. */
type RowSelectionState<TRow> = RowsState<TRow> &
    Pick<
        DataGridState<TRow>,
        "rowSelection" | "selectedRowKeys" | "isRowSelectable"
    >;

type Selecting<TRow> = RowSelectionState<TRow> &
    Pick<DataGridState<TRow>, "selectionAnchor" | "expandedGroupKeys">;

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

/**
 * Whether the row is selected: rows are selectable, it is loaded and its key is selected; a group
 * row (Epic #87), while every one of its rows' keys is.
 */
export function isRowSelected<TRow>(
    state: RowSelectionState<TRow>,
    rowIndex: number,
): boolean {
    if (!state.rowSelection || state.selectedRowKeys.length === 0) return false;
    const meta = rowMetaAt(state.source, rowIndex);
    return rowSelectedWith(
        state,
        rowIndex,
        meta,
        dataRowAt(state.source, rowIndex, meta),
    );
}

/**
 * `isRowSelected` for a row read already (Epic #87): its kind (`rowMetaAt`) and its data row
 * (`dataRowAt`).
 */
export function rowSelectedWith<TRow>(
    state: RowSelectionState<TRow>,
    rowIndex: number,
    meta: RowMeta | undefined,
    row: TRow | undefined,
): boolean {
    if (!state.rowSelection || state.selectedRowKeys.length === 0) return false;
    if (meta?.group) return groupSelected(meta.group, state.selectedRowKeys);
    return (
        row !== undefined &&
        keySet(state.selectedRowKeys).has(keyOf(state, row, rowIndex))
    );
}

/** Whether the row can be selected: rows are selectable, it is loaded and not refused. */
export function isRowSelectable<TRow>(
    state: RowSelectionState<TRow>,
    rowIndex: number,
): boolean {
    if (!state.rowSelection) return false;
    const meta = rowMetaAt(state.source, rowIndex);
    return rowSelectableWith(
        state,
        rowIndex,
        meta,
        dataRowAt(state.source, rowIndex, meta),
    );
}

/** `isRowSelectable` for a row read already (Epic #87), as `rowSelectedWith`. */
export function rowSelectableWith<TRow>(
    state: RowSelectionState<TRow>,
    rowIndex: number,
    meta: RowMeta | undefined,
    row: TRow | undefined,
): boolean {
    if (!state.rowSelection) return false;
    if (meta?.group) return groupSelectable(state, meta.group);
    return row !== undefined && selectable(state, row, rowIndex);
}

/**
 * Adds the keys a range or select-all takes from a row to `into` (Epic #87): a selectable data
 * row's key, a collapsed group row's rows' keys, none for a row that cannot be selected (nor an
 * expanded group row: its rows are rows of the range). False for a row not
 * loaded (its key is unknown): nothing added.
 */
function keysOfRow<TRow>(
    state: Selecting<TRow>,
    index: number,
    into: RowKey[],
): boolean {
    const meta = rowMetaAt(state.source, index);
    if (meta?.group) {
        // collapsed, its rows are not on the rows: its keys stand for them; expanded, they are
        // walked as rows (a range never takes rows outside it)
        if (meta.group.rowKeys && !groupExpanded(state, meta.group.key)) {
            into.push(...meta.group.rowKeys);
        }
        return true;
    }
    const row = dataRowAt(state.source, index, meta);
    if (row === undefined) return false;
    if (selectable(state, row, index)) into.push(keyOf(state, row, index));
    return true;
}

/** Whether a group row can be selected (Epic #87): many rows are, and it names its rows' keys. */
export function groupSelectable<TRow>(
    state: Pick<RowSelectionState<TRow>, "rowSelection">,
    group: GroupRow,
): boolean {
    return (
        state.rowSelection === "multiple" && (group.rowKeys?.length ?? 0) > 0
    );
}

/** A group's answer for the last selected keys it was asked about: a group row renders often. */
const groupAnswers = new WeakMap<
    GroupRow,
    { readonly keys: readonly RowKey[]; readonly selected: boolean }
>();

/**
 * Whether every one of a group's rows' keys is selected (none named: not selected), worked out
 * once per group and selected keys.
 */
function groupSelected(group: GroupRow, keys: readonly RowKey[]): boolean {
    const known = groupAnswers.get(group);
    if (known?.keys === keys) return known.selected;
    const held = keySet(keys);
    const rowKeys = group.rowKeys ?? [];
    const selected =
        rowKeys.length > 0 && rowKeys.every((key) => held.has(key));
    groupAnswers.set(group, { keys, selected });
    return selected;
}

/** `keys` with `added` after them, each key once. */
function withKeys<K>(keys: readonly K[], added: readonly K[]): K[] {
    return [...new Set([...keys, ...added])];
}

/** `keys` without the ones in `removed`. */
function withoutKeys<K>(keys: readonly K[], removed: readonly K[]): K[] {
    const gone = new Set(removed);
    return keys.filter((key) => !gone.has(key));
}

/**
 * A group row toggled (Epic #87): its rows' keys cleared when every one is selected, else the
 * missing ones added after the others.
 */
export function groupToggledKeys<TRow>(
    state: Selecting<TRow>,
    group: GroupRow,
): readonly RowKey[] {
    const rowKeys = group.rowKeys ?? [];
    return groupSelected(group, state.selectedRowKeys)
        ? withoutKeys(state.selectedRowKeys, rowKeys)
        : withKeys(state.selectedRowKeys, rowKeys);
}

/** The refusal of a command that needs a row not loaded: its key is unknown. */
export function notLoaded(rowIndex: number): CommandFailure {
    return fail(
        "not_loaded",
        `row ${rowIndex} is not loaded: its key is unknown`,
    );
}

/** The anchor, when its key (a group row's group key, Epic #87) is still at its index. */
export function validAnchor<TRow>(
    state: Selecting<TRow>,
): SelectionAnchor | null {
    const anchor = state.selectionAnchor;
    if (!anchor) return null;
    return rowKeyAt(state, anchor.rowIndex) === anchor.rowKey ? anchor : null;
}

/**
 * The anchor once the keys are `keys`: kept while its row's state is the one it gives a range
 * (a group row's, Epic #87: every one of its rows selected, or not); the keys changed it by other
 * means (cleared it, selected it), no range starts there.
 */
export function keptAnchor<TRow>(
    state: Pick<RowsState<TRow>, "source">,
    anchor: SelectionAnchor | null,
    keys: readonly RowKey[],
): SelectionAnchor | null {
    if (!anchor) return null;
    const group = rowMetaAt(state.source, anchor.rowIndex)?.group;
    const selected =
        group?.key === anchor.rowKey
            ? groupSelected(group, keys)
            : keySet(keys).has(anchor.rowKey);
    return selected === anchor.selected ? anchor : null;
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
 * Every selectable row from the anchor to `rowIndex` (both included) given the anchor's state,
 * a group row's rows with it (Epic #87): added when it selects, removed when not. Without an
 * anchor, `undefined`: the caller toggles.
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
        if (!keysOfRow(state, index, range)) return notLoaded(index);
    }
    const selected = keySet(state.selectedRowKeys);
    if (select) {
        const added = range.filter((key) => !selected.has(key));
        return ok(
            added.length === 0
                ? state.selectedRowKeys
                : withKeys(state.selectedRowKeys, added),
        );
    }
    return ok(withoutKeys(state.selectedRowKeys, range));
}

/**
 * The keys with every selectable row's added (a group row's rows' keys too); a row not loaded
 * refuses it all.
 */
export function allKeys<TRow>(
    state: Selecting<TRow>,
): CommandResult<readonly RowKey[]> {
    const keys = new Set(state.selectedRowKeys);
    const before = keys.size;
    const found: RowKey[] = [];
    for (let index = 0; index < state.rowCount; index++) {
        if (!keysOfRow(state, index, found)) return notLoaded(index);
        for (const key of found) keys.add(key);
        found.length = 0;
    }
    return ok(keys.size === before ? state.selectedRowKeys : [...keys]);
}
