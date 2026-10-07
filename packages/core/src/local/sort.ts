import { cellValue } from "../model/source";
import type { Column, SortColumn } from "../model/types";
import type { RowEntry } from "./filter";
import { compareValues, isEmptyValue } from "./values";

/**
 * The entries in the sort's order: the first sorted column first, the next ones breaking ties,
 * ties kept in their order (a stable sort). A column's `compare` decides when it has one, else
 * its values compare by type with empty values last, in either direction. A sorted key no column
 * has is skipped.
 */
export function sortEntries<TRow, TNode>(
    entries: readonly RowEntry<TRow>[],
    sortColumns: readonly SortColumn[],
    columns: readonly Column<TRow, TNode>[],
): readonly RowEntry<TRow>[] {
    const sorts = sortColumns.flatMap(({ columnKey, direction }) => {
        const column = columns.find((candidate) => candidate.key === columnKey);
        return column
            ? [{ column, sign: direction === "ascending" ? 1 : -1 }]
            : [];
    });
    if (sorts.length === 0) return entries;
    // each value read once, not once per comparison, and whether it is empty: column-major, by
    // the entry's position (a column's `compare` reads the rows instead)
    const keys = sorts.map(({ column, sign }) => {
        const values = column.compare
            ? []
            : entries.map(({ row, index }) => cellValue(column, row, index));
        return { column, sign, values, empty: values.map(isEmptyValue) };
    });
    const positions = entries.map((_, position) => position);
    // Array.prototype.sort is stable: ties keep their order
    positions.sort((a, b) => {
        for (let k = 0; k < keys.length; k++) {
            const key = keys[k];
            if (!key) continue;
            const { column, sign, values, empty } = key;
            let order: number;
            if (column.compare) {
                const aEntry = entries[a];
                const bEntry = entries[b];
                // called on its column, as before: a method may read `this`
                order =
                    aEntry && bEntry
                        ? sign * column.compare(aEntry.row, bEntry.row)
                        : 0;
            } else {
                const aEmpty = empty[a] === true;
                const bEmpty = empty[b] === true;
                // empty values last, whichever the direction
                order =
                    aEmpty || bEmpty
                        ? Number(aEmpty) - Number(bEmpty)
                        : sign * compareValues(values[a], values[b]);
            }
            if (order !== 0) return order;
        }
        return 0;
    });
    const sorted: RowEntry<TRow>[] = [];
    for (const position of positions) {
        const entry = entries[position];
        if (entry) sorted.push(entry);
    }
    return sorted;
}

/**
 * Items (a group's parts, a tree's siblings) sorted by their entries (`entryOf`, `undefined` for
 * none: left out) as `sortEntries` sorts rows: the sort hands the same entries back, in order.
 */
export function sortedByEntry<TRow, TNode, T>(
    items: readonly T[],
    entryOf: (item: T) => RowEntry<TRow> | undefined,
    sortColumns: readonly SortColumn[],
    columns: readonly Column<TRow, TNode>[],
): T[] {
    const itemOf = new Map<RowEntry<TRow>, T>();
    for (const item of items) {
        const entry = entryOf(item);
        if (entry) itemOf.set(entry, item);
    }
    return sortEntries([...itemOf.keys()], sortColumns, columns).flatMap(
        (entry) => {
            const item = itemOf.get(entry);
            return item ? [item] : [];
        },
    );
}
