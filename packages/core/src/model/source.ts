import { isIndex } from "../utils";
import type { Column, DataGridState, RowKey, RowSource } from "./types";

// The rows and their keys (D6): where a row comes from, its cells' values and the one rule for a
// row's key (`rowKey`, else its index).

/** What rows and their keys are read from: the model's state, or a view. */
export type RowsState<TRow> = Pick<
    DataGridState<TRow>,
    "source" | "rowCount" | "rowKey"
>;

/** The row at `index` of a source, or `undefined` while it is not loaded. */
export function rowAt<TRow>(
    source: RowSource<TRow>,
    index: number,
): TRow | undefined {
    if (!isIndex(index)) return undefined;
    if ("rows" in source) return source.rows[index];
    return index < source.rowCount ? source.getRow(index) : undefined;
}

/** The cell's value: the column's getter, or the row's property named by the key. */
export function cellValue<TRow, TNode>(
    column: Column<TRow, TNode>,
    row: TRow,
    rowIndex: number,
): unknown {
    if (column.getValue) return column.getValue(row, rowIndex);
    if (typeof row === "object" && row !== null) {
        const value: unknown = Reflect.get(row, column.key);
        return value;
    }
    return undefined;
}

/** A loaded row's key: `rowKey`'s answer, or its index without one. */
export function keyOf<TRow>(
    state: Pick<RowsState<TRow>, "rowKey">,
    row: TRow,
    rowIndex: number,
): RowKey {
    return state.rowKey ? state.rowKey(row, rowIndex) : rowIndex;
}

/** The row at `rowIndex` when it is one of the grid's rows and loaded. */
export function loadedRow<TRow>(
    state: Pick<RowsState<TRow>, "source" | "rowCount">,
    rowIndex: number,
): TRow | undefined {
    return isIndex(rowIndex, state.rowCount)
        ? rowAt(state.source, rowIndex)
        : undefined;
}

/** The key of a loaded row; `undefined` while it is not loaded (its key is unknown). */
export function loadedRowKey<TRow>(
    state: RowsState<TRow>,
    rowIndex: number,
): RowKey | undefined {
    const row = loadedRow(state, rowIndex);
    return row === undefined ? undefined : keyOf(state, row, rowIndex);
}
