import { cellValue } from "../model/model";
import type { Column } from "../model/types";
import { foldText, isEmptyValue, textOf } from "./values";

/** The filters by column key: a value each; an empty one (`undefined`, `null`, `""`, `[]`) is no filter. */
export type LocalFilters = Readonly<Record<string, unknown>>;

/** A row and its index in the rows given to the pipeline (`getValue`'s `rowIndex`). */
export interface RowEntry<TRow> {
    readonly row: TRow;
    readonly index: number;
}

/** The rows as entries: each with its index. */
export function entriesOf<TRow>(rows: readonly TRow[]): RowEntry<TRow>[] {
    return rows.map((row, index) => ({ row, index }));
}

/** Whether a filter value filters nothing: empty, or an empty list. */
export function isEmptyFilter(filterValue: unknown): boolean {
    return (
        isEmptyValue(filterValue) ||
        (Array.isArray(filterValue) && filterValue.length === 0)
    );
}

/** Whether two values are the same: dates by time, anything else by identity. */
function same(a: unknown, b: unknown): boolean {
    if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime();
    }
    return Object.is(a, b);
}

/**
 * Whether a cell's value passes a filter value, without a column's own `filter`: a text is
 * contained (case and accents aside), a list holds the value (or one of the values, for a cell
 * holding a list), anything else equals it. An empty filter value passes everything.
 */
export function matchesFilter(value: unknown, filterValue: unknown): boolean {
    if (isEmptyFilter(filterValue)) return true;
    if (Array.isArray(filterValue)) {
        const values: readonly unknown[] = Array.isArray(value)
            ? value
            : [value];
        return values.some((item) =>
            filterValue.some((wanted: unknown) => same(item, wanted)),
        );
    }
    if (typeof filterValue === "string") {
        return foldText(textOf(value)).includes(foldText(filterValue));
    }
    return same(value, filterValue);
}

/**
 * The entries that pass every column's filter (AND), in order. A filter on a key no column has,
 * or an empty one, filters nothing. `columns` are the grid's columns (the leaves).
 */
export function filterEntries<TRow, TNode>(
    entries: readonly RowEntry<TRow>[],
    filters: LocalFilters,
    columns: readonly Column<TRow, TNode>[],
): readonly RowEntry<TRow>[] {
    const active = columns.flatMap((column) => {
        // only the filters' own keys: a column keyed "constructor" finds no inherited function
        const filterValue = Object.hasOwn(filters, column.key)
            ? filters[column.key]
            : undefined;
        return isEmptyFilter(filterValue) ? [] : [{ column, filterValue }];
    });
    if (active.length === 0) return entries;
    return entries.filter(({ row, index }) =>
        active.every(({ column, filterValue }) => {
            const value = cellValue(column, row, index);
            return column.filter
                ? column.filter(value, filterValue, row)
                : matchesFilter(value, filterValue);
        }),
    );
}

/**
 * The entries where any column's value, as text, contains `text` (case and accents aside), in
 * order. A blank `text` keeps every entry.
 */
export function searchEntries<TRow, TNode>(
    entries: readonly RowEntry<TRow>[],
    text: string,
    columns: readonly Column<TRow, TNode>[],
): readonly RowEntry<TRow>[] {
    const wanted = foldText(text.trim());
    if (wanted === "") return entries;
    return entries.filter(({ row, index }) =>
        columns.some((column) =>
            foldText(textOf(cellValue(column, row, index))).includes(wanted),
        ),
    );
}
