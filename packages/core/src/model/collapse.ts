import { entryByKey, isColumnGroup } from "../header/header";
import { cellKeyAt } from "./order";
import type {
    CellPosition,
    Column,
    ColumnGroup,
    ColumnOrGroup,
    HeaderCellLayout,
    HeaderLayout,
} from "./types";

// Collapsible column groups (Epic #85, E1.3): the model keeps the collapsed groups' keys, and the
// layout shows a collapsible group's children by its state (`layoutColumns`). What a collapse
// hid is no column: what pointed at it (the active cell, the view's first column) falls back on
// the nearest group above it still shown. Pure: the model and the engine share it.

/** Whether a group is collapsed: a collapsible group of the entries, its key collapsed. */
export function isGroupCollapsed<TRow, TNode>(
    state: {
        readonly columnEntries: readonly ColumnOrGroup<TRow, TNode>[];
        readonly collapsedGroupKeys: readonly string[];
    },
    groupKey: string,
): boolean {
    return (
        state.collapsedGroupKeys.includes(groupKey) &&
        groupByKey(state.columnEntries, groupKey)?.collapsible === true
    );
}

/**
 * The keys that collapse a group: the ones of the entries' collapsible groups (the others are
 * kept, and collapse nothing).
 */
export function collapsingKeys<TRow, TNode>(
    entries: readonly ColumnOrGroup<TRow, TNode>[],
    keys: readonly string[],
): readonly string[] {
    return keys.filter((key) => groupByKey(entries, key)?.collapsible === true);
}

/** The group with this key among the entries (`entryByKey`), or `undefined` for a column or none. */
export function groupByKey<TRow, TNode>(
    entries: readonly ColumnOrGroup<TRow, TNode>[],
    key: string,
): ColumnGroup<TRow, TNode> | undefined {
    const entry = entryByKey(entries, key);
    return entry && isColumnGroup(entry) ? entry : undefined;
}

/**
 * The nearest group above column `columnIndex` of the `before` layout that `after` still shows
 * (`skip`, the key of a group to pass over: a header cell's own): its cell in each layout, or
 * `null` when none is.
 */
function shownGroupOf<TRow, TNode>(
    before: HeaderLayout<TRow, TNode>,
    after: HeaderLayout<TRow, TNode>,
    columnIndex: number,
    skip?: string,
): {
    readonly from: HeaderCellLayout<TRow, TNode>;
    readonly to: HeaderCellLayout<TRow, TNode>;
} | null {
    for (let rowIndex = -1; rowIndex >= -before.depth; rowIndex--) {
        const from = before.cellAt(rowIndex, columnIndex);
        if (!from?.group || from.key === skip) continue;
        const to = after.cellByKey(from.key);
        if (to) return { from, to };
    }
    return null;
}

/**
 * Where to go in a new layout (`after`) from column `columnIndex` of the `before` one when a
 * collapse hid it (`skip`, a hidden header cell's own key, passed over): the nearest column the
 * nearest group above it still shows, the start's side first, else (the group shows none of the
 * columns it had: its other state's) that group's first column. `undefined` without such a group.
 * What the active cell (the model) and the view's first column (the engine) fall back on.
 */
export function shownColumnOf<TRow, TNode>(
    before: {
        readonly header: HeaderLayout<TRow, TNode>;
        readonly columns: readonly Column<TRow, TNode>[];
    },
    after: HeaderLayout<TRow, TNode>,
    columnIndex: number,
    skip?: string,
): number | undefined {
    const group = shownGroupOf(before.header, after, columnIndex, skip);
    if (!group) return undefined;
    const { from, to } = group;
    const end = from.columnIndex + from.columnSpan;
    for (let distance = 1; distance < from.columnSpan; distance++) {
        for (const at of [columnIndex - distance, columnIndex + distance]) {
            if (at < from.columnIndex || at >= end) continue;
            const shown = after.cellByKey(before.columns[at]?.key ?? "");
            if (shown) return shown.columnIndex;
        }
    }
    return to.columnIndex;
}

/**
 * Where a cell's column is in a new layout (`after`: an order, a collapse): its column's or its
 * header cell's by key, wherever it went; one a collapse hid falls back on `shownColumnOf`.
 * `undefined` when neither is (a cell outside the columns).
 */
export function followedColumn<TRow, TNode>(
    before: {
        readonly header: HeaderLayout<TRow, TNode>;
        readonly columns: readonly Column<TRow, TNode>[];
    },
    after: HeaderLayout<TRow, TNode>,
    position: CellPosition,
): number | undefined {
    const key = cellKeyAt(before, position);
    if (key === undefined) return undefined;
    return (
        after.cellByKey(key)?.columnIndex ??
        shownColumnOf(before, after, position.columnIndex, key)
    );
}
