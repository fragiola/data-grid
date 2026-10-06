import { cellValue } from "../model/source";
import type {
    Column,
    GroupRow,
    RowKey,
    RowKeyGetter,
    RowMeta,
    RowSelectable,
    SortColumn,
    SortDirection,
} from "../model/types";
import { keySet } from "../utils";
import type { RowEntry } from "./filter";
import { sortEntries } from "./sort";
import { textOf } from "./values";

// Rows in memory grouped by columns (Epic #87, E3.2): the pipeline's stage after the filters, the
// search and the sort, before the page. The rows a column's value shares make a group row (the
// core's `GroupRow`), nested by the next column, each with its count and the app's aggregates;
// the grid is given them flattened, as it shows them: a group row, then, while it is expanded, its
// rows (`rowCount`, `getRow`, `getRowMeta`). A server makes the same shape.

/** What grouping the rows takes besides them (`useLocalRows`'s options). */
export interface LocalGrouping<TRow> {
    /** the columns to group by, the outer one first (a key no column has groups by `row[key]`) */
    readonly groupBy: readonly string[];
    /**
     * each column's aggregate over a group's rows, by column key: what the group row's cell in
     * that column shows (`GroupRow.aggregates`)
     */
    readonly aggregates?:
        | Readonly<Record<string, (rows: readonly TRow[]) => unknown>>
        | undefined;
    /**
     * a data row's key, as `DataGrid.Root`'s `rowKey`, called with its index among the rows given;
     * without one, that index is its key. A group selects its rows by them (`GroupRow.rowKeys`)
     */
    readonly rowKey?: RowKeyGetter<TRow> | undefined;
    /**
     * whether a row can be selected, called with its index among the rows given: a group's
     * `rowKeys` leave out the ones it refuses (the grid selects a group by them, as given)
     */
    readonly isRowSelectable?: RowSelectable<TRow> | undefined;
    /** the expanded groups' keys; without them, the pipeline's own (`setExpandedGroupKeys`) */
    readonly expandedGroupKeys?: readonly RowKey[] | undefined;
}

/**
 * The rows grouped and flattened as the grid shows them (E3.2): `DataGrid.Root`'s `rowCount`,
 * `getRow`, `getRowMeta` and `rowKey`. Every function reads this page's rows.
 */
export interface GroupedRows<TRow> {
    /** the rows shown: group rows, and the rows of the expanded ones */
    readonly rowCount: number;
    /** a data row; `undefined` at a group row (it has none) */
    getRow(index: number): TRow | undefined;
    /** a row's kind: its group (a group row), its depth, parent and place among its siblings */
    getRowMeta(index: number): RowMeta | undefined;
    /** a data row's key: `rowKey`'s answer, else its index among the rows given */
    rowKey(row: TRow, index: number): RowKey;
    /** every group's key, at every depth: what expanding them all sets */
    readonly groupKeys: readonly RowKey[];
}

/** A group: its row, and its groups one column further (none at the last column) or its rows. */
export interface GroupNode<TRow> {
    readonly group: GroupRow;
    readonly groups: readonly GroupNode<TRow>[] | null;
    readonly entries: readonly RowEntry<TRow>[];
}

/** A row as the grid shows it: its kind (its meta), and its data row (none for a group row). */
export interface ShownRow<TRow> {
    readonly meta: RowMeta;
    readonly entry: RowEntry<TRow> | undefined;
}

/**
 * A group's key (E3.2): the columns and values on its path from the top, the outer one first
 * (`[["country", "France"], ["city", "Paris"]]`), as text. What `expandedGroupKeys` holds: an app
 * builds the keys to start with by it.
 */
export function groupKeyOf(
    path: readonly (readonly [columnKey: string, value: unknown])[],
): string {
    return JSON.stringify(
        path.map(([columnKey, value]) => [columnKey, textOf(value)]),
    );
}

/**
 * The groups of `entries` (in their order: sorted, filtered) by the columns of `groupBy`, the
 * outer one first: at each depth, the entries sharing a value (as text: an empty value is one
 * group), ordered by the sort when it sorts that column (`sortColumns`), else ascending, empty
 * values last; each group's rows in their order. A group's aggregates are the app's functions
 * over its rows; its `rowKeys` its rows' keys, the ones `isRowSelectable` refuses left out.
 */
export function groupTree<TRow, TNode>(
    entries: readonly RowEntry<TRow>[],
    groupBy: readonly string[],
    columns: readonly Column<TRow, TNode>[],
    sortColumns: readonly SortColumn[],
    aggregates: LocalGrouping<TRow>["aggregates"],
    rowKey: RowKeyGetter<TRow> | undefined,
    isRowSelectable?: RowSelectable<TRow> | undefined,
): readonly GroupNode<TRow>[] {
    const byKey = groupBy.map(
        (key): Column<TRow, TNode> =>
            columns.find((column) => column.key === key) ?? { key, width: 0 },
    );
    const keyOf = (entry: RowEntry<TRow>): RowKey =>
        rowKey ? rowKey(entry.row, entry.index) : entry.index;
    const sums = aggregates ? Object.entries(aggregates) : [];
    const level = (
        rows: readonly RowEntry<TRow>[],
        depth: number,
        path: readonly (readonly [string, unknown])[],
    ): readonly GroupNode<TRow>[] => {
        const column = byKey[depth];
        if (!column) return [];
        // the entries sharing a value, as text, in the order their values first come
        const parts = new Map<
            string,
            { value: unknown; entries: RowEntry<TRow>[] }
        >();
        for (const entry of rows) {
            const value = cellValue(column, entry.row, entry.index);
            const text = textOf(value);
            const part = parts.get(text);
            if (part) part.entries.push(entry);
            else parts.set(text, { value, entries: [entry] });
        }
        const ordered = orderedParts(
            [...parts.values()],
            column,
            directionOf(sortColumns, column.key),
        );
        return ordered.map(({ value, entries: own }) => {
            const at = [...path, [column.key, value] as const];
            const rowsOf = sums.length > 0 ? own.map((entry) => entry.row) : [];
            const group: GroupRow = {
                key: groupKeyOf(at),
                columnKey: column.key,
                value,
                depth,
                childCount: own.length,
                aggregates: Object.fromEntries(
                    sums.map(([key, aggregate]) => [key, aggregate(rowsOf)]),
                ),
                rowKeys: (isRowSelectable
                    ? own.filter((entry) =>
                          isRowSelectable(entry.row, entry.index),
                      )
                    : own
                ).map(keyOf),
            };
            return {
                group,
                groups:
                    depth + 1 < byKey.length ? level(own, depth + 1, at) : null,
                entries: own,
            };
        });
    };
    return level(entries, 0, []);
}

/** The direction the sort orders a column in, ascending when it does not sort it. */
function directionOf(
    sortColumns: readonly SortColumn[],
    columnKey: string,
): SortDirection {
    return (
        sortColumns.find((entry) => entry.columnKey === columnKey)?.direction ??
        "ascending"
    );
}

/**
 * Groups in their column's order: by their first rows, as the sort orders rows (the column's
 * `compare`, else its values by type, empty values last).
 */
function orderedParts<TRow, TNode, P extends { entries: RowEntry<TRow>[] }>(
    parts: readonly P[],
    column: Column<TRow, TNode>,
    direction: SortDirection,
): readonly P[] {
    // each part by its first entry: the sort hands the same entries back, in order
    const partOf = new Map<RowEntry<TRow>, P>();
    for (const part of parts) {
        const first = part.entries[0];
        if (first) partOf.set(first, part);
    }
    return sortEntries(
        [...partOf.keys()],
        [{ columnKey: column.key, direction }],
        [column],
    ).flatMap((entry) => {
        const part = partOf.get(entry);
        return part ? [part] : [];
    });
}

/** Every group's key, at every depth, the outer ones first. */
export function groupKeysOf<TRow>(
    groups: readonly GroupNode<TRow>[],
): readonly RowKey[] {
    const keys: RowKey[] = [];
    const add = (nodes: readonly GroupNode<TRow>[]) => {
        for (const node of nodes) {
            keys.push(node.group.key);
            if (node.groups) add(node.groups);
        }
    };
    add(groups);
    return keys;
}

/**
 * The rows the grid shows (E3.2): each group row, then, while its key is expanded, its groups or
 * its rows, each with its kind: its depth, the index of the row it is under, its set's size and
 * its place in it (ARIA's `aria-setsize`/`aria-posinset`).
 */
export function shownRowsOf<TRow>(
    groups: readonly GroupNode<TRow>[],
    expandedGroupKeys: readonly RowKey[],
): readonly ShownRow<TRow>[] {
    const expanded = keySet(expandedGroupKeys);
    const shown: ShownRow<TRow>[] = [];
    const add = (
        nodes: readonly GroupNode<TRow>[],
        parentIndex: number | undefined,
    ) => {
        nodes.forEach((node, at) => {
            const index = shown.length;
            const { group } = node;
            shown.push({
                meta: {
                    depth: group.depth,
                    group,
                    parentIndex,
                    setSize: nodes.length,
                    posInSet: at + 1,
                },
                entry: undefined,
            });
            if (!expanded.has(group.key)) return;
            if (node.groups) {
                add(node.groups, index);
                return;
            }
            node.entries.forEach((entry, position) => {
                shown.push({
                    meta: {
                        depth: group.depth + 1,
                        parentIndex: index,
                        setSize: node.entries.length,
                        posInSet: position + 1,
                    },
                    entry,
                });
            });
        });
    };
    add(groups, undefined);
    return shown;
}

/**
 * A page of the rows shown (`start` the first one's place among them), as the grid takes them: a
 * row whose parent is on an earlier page has none (the keys find no row above it to go to).
 */
export function groupedRowsOf<TRow>(
    page: readonly ShownRow<TRow>[],
    start: number,
    groupKeys: readonly RowKey[],
    rowKey: RowKeyGetter<TRow> | undefined,
): GroupedRows<TRow> {
    const rows =
        start === 0
            ? page
            : page.map((row) => {
                  const parent = row.meta.parentIndex;
                  if (parent === undefined) return row;
                  return {
                      ...row,
                      meta: {
                          ...row.meta,
                          parentIndex:
                              parent >= start ? parent - start : undefined,
                      },
                  };
              });
    return {
        rowCount: rows.length,
        getRow: (index) => rows[index]?.entry?.row,
        getRowMeta: (index) => rows[index]?.meta,
        rowKey: (row, index) => {
            const entry = rows[index]?.entry;
            if (!entry) return index;
            return rowKey ? rowKey(row, entry.index) : entry.index;
        },
        groupKeys,
    };
}
