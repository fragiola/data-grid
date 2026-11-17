import { isHeaderRow } from "../header/header";
import type {
    CellPosition,
    Column,
    HeaderCellLayout,
    HeaderLayout,
} from "./types";

// Following a cell across a new layout of the columns (Epics #75, #85; the core's since Epic
// #148, whatever laid them out: a column order, a collapse): what pointed at a column (the active
// cell, the view's first column) follows it by key, and one a collapse hid falls back on the
// nearest group above it still shown. Pure: the model and the engine share it.

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

/**
 * The key of a cell's column or group: a header cell's own, a body (or summary row) cell's
 * column's. What an order change keeps the active cell on.
 */
export function cellKeyAt<TRow, TNode>(
    state: {
        readonly header: HeaderLayout<TRow, TNode>;
        readonly columns: readonly Column<TRow, TNode>[];
    },
    position: { readonly rowIndex: number; readonly columnIndex: number },
): string | undefined {
    return isHeaderRow(position.rowIndex, state.header)
        ? state.header.cellAt(position.rowIndex, position.columnIndex)?.key
        : state.columns[position.columnIndex]?.key;
}
