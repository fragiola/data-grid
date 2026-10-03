import { cellValue } from "../model/model";
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
    // each value read once, not once per comparison: rows decorated with their sort keys
    const decorated = entries.map((entry) => ({
        entry,
        keys: sorts.map(({ column }) =>
            column.compare
                ? undefined
                : cellValue(column, entry.row, entry.index),
        ),
    }));
    // Array.prototype.sort is stable: ties keep their order
    decorated.sort((a, b) => {
        for (let i = 0; i < sorts.length; i++) {
            const sort = sorts[i];
            if (!sort) continue;
            let order: number;
            if (sort.column.compare) {
                order =
                    sort.sign * sort.column.compare(a.entry.row, b.entry.row);
            } else {
                const aValue = a.keys[i];
                const bValue = b.keys[i];
                const aEmpty = isEmptyValue(aValue);
                const bEmpty = isEmptyValue(bValue);
                // empty values last, whichever the direction
                order =
                    aEmpty || bEmpty
                        ? Number(aEmpty) - Number(bEmpty)
                        : sort.sign * compareValues(aValue, bValue);
            }
            if (order !== 0) return order;
        }
        return 0;
    });
    return decorated.map(({ entry }) => entry);
}
