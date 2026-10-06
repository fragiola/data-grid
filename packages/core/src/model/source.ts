import { isIndex, keySet } from "../utils";
import type {
    Column,
    DataGridState,
    GroupRow,
    RowKey,
    RowMeta,
    RowSource,
} from "./types";

// The rows and their keys (D6): where a row comes from, its cells' values and the one rule for a
// row's key (`rowKey`, else its index). A row's kind (Epic #87, E3.1) comes with them: a group
// row, which has no data row, keyed by its group's key.

/** What rows and their keys are read from: the model's state, or a view. */
export type RowsState<TRow> = Pick<
    DataGridState<TRow>,
    "source" | "rowCount" | "rowKey"
>;

/**
 * The data row at `index` of a source, or `undefined` while it is not loaded, and at a group row
 * (Epic #87: it has none, whatever the source holds there).
 */
export function rowAt<TRow>(
    source: RowSource<TRow>,
    index: number,
): TRow | undefined {
    return dataRowAt(source, index, rowMetaAt(source, index));
}

/**
 * `rowAt` for a row whose kind the caller read already (`rowMetaAt`): a row's paths read its meta
 * once, and pass it on.
 */
export function dataRowAt<TRow>(
    source: RowSource<TRow>,
    index: number,
    meta: RowMeta | undefined,
): TRow | undefined {
    if (meta?.group || !isIndex(index, rowCountOf(source))) return undefined;
    return "rows" in source ? source.rows[index] : source.getRow(index);
}

/** Whether a row is there to show (Epic #87): a loaded data row, or a group row. */
export function rowLoaded<TRow>(
    source: RowSource<TRow>,
    index: number,
): boolean {
    const meta = rowMetaAt(source, index);
    return (
        meta?.group !== undefined ||
        dataRowAt(source, index, meta) !== undefined
    );
}

/** How many rows a source has, loaded or not. */
export function rowCountOf<TRow>(source: RowSource<TRow>): number {
    return "rows" in source ? source.rows.length : source.rowCount;
}

/**
 * What kind of row `index` is (Epic #87): `getRowMeta`'s answer, asked for the source's rows only;
 * `undefined` without one.
 */
export function rowMetaAt<TRow>(
    source: RowSource<TRow>,
    index: number,
): RowMeta | undefined {
    return source.getRowMeta && isIndex(index, rowCountOf(source))
        ? source.getRowMeta(index)
        : undefined;
}

/** The group of the group row at `index` (Epic #87), `undefined` for any other row. */
export function groupAt<TRow>(
    source: RowSource<TRow>,
    index: number,
): GroupRow | undefined {
    return rowMetaAt(source, index)?.group;
}

/** A row's depth in its tree (Epic #87): its meta's, else its group's, else 0. */
export function depthOf(meta: RowMeta | undefined): number {
    return meta?.depth ?? meta?.group?.depth ?? 0;
}

/** A group row's cell value (Epic #87): the group's value in its column, else its aggregate. */
export function groupCellValue<TRow, TNode>(
    group: GroupRow,
    column: Column<TRow, TNode>,
): unknown {
    if (column.key === group.columnKey) return group.value;
    return Object.hasOwn(group.aggregates, column.key)
        ? group.aggregates[column.key]
        : undefined;
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

/**
 * A row's key (Epic #87): a group row's group key, a loaded data row's key, `undefined` while it
 * is not loaded. What a row is told apart by on screen (its element, its measured height).
 */
export function rowKeyAt<TRow>(
    state: RowsState<TRow>,
    rowIndex: number,
): RowKey | undefined {
    const meta = rowMetaAt(state.source, rowIndex);
    return rowKeyOf(
        state,
        rowIndex,
        meta,
        dataRowAt(state.source, rowIndex, meta),
    );
}

/**
 * `rowKeyAt` for a row read already, its kind and its data row (`dataRowAt`): the one rule an
 * adapter's row keys and the engine's measured keys share.
 */
export function rowKeyOf<TRow>(
    state: Pick<RowsState<TRow>, "rowKey">,
    rowIndex: number,
    meta: RowMeta | undefined,
    row: TRow | undefined,
): RowKey | undefined {
    if (meta?.group) return meta.group.key;
    return row === undefined ? undefined : keyOf(state, row, rowIndex);
}

/**
 * The key a row expands by (Epic #87): a group row's group key, a loaded row that expands
 * (`RowMeta.expandable`) by its own key; `undefined` for a row that does not expand. `meta` and
 * `row` (its data row, `dataRowAt`), when the caller has them, save their lookups.
 */
export function groupKeyAt<TRow>(
    state: RowsState<TRow>,
    rowIndex: number,
    meta: RowMeta | undefined = rowMetaAt(state.source, rowIndex),
    row: TRow | undefined = meta?.expandable
        ? dataRowAt(state.source, rowIndex, meta)
        : undefined,
): RowKey | undefined {
    if (meta?.group) return meta.group.key;
    return meta?.expandable ? rowKeyOf(state, rowIndex, meta, row) : undefined;
}

/** Whether a row group's key (`groupKeyAt`) is expanded: among the expanded group keys. */
export function groupExpanded(
    state: Pick<DataGridState<unknown>, "expandedGroupKeys">,
    groupKey: RowKey | undefined,
): boolean {
    return (
        groupKey !== undefined &&
        state.expandedGroupKeys.length > 0 &&
        keySet(state.expandedGroupKeys).has(groupKey)
    );
}

/**
 * Whether a row heads an expanded row group (Epic #87): it expands (`groupKeyAt`) and its key is
 * among the expanded group keys.
 */
export function isGroupExpanded<TRow>(
    state: RowsState<TRow> & Pick<DataGridState<TRow>, "expandedGroupKeys">,
    rowIndex: number,
): boolean {
    return groupExpanded(state, groupKeyAt(state, rowIndex));
}
