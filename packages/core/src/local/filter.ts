import { cellValue } from "../model/source";
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
 * How a filter value matches a cell's value, without a column's own `filter`: a text is contained
 * (case and accents aside), a list holds the value (or one of the values, for a cell holding a
 * list), anything else equals it. An empty filter value matches everything. The filter value is
 * read once, not once per row.
 */
export function matcherOf(filterValue: unknown): (value: unknown) => boolean {
    if (isEmptyFilter(filterValue)) return () => true;
    if (Array.isArray(filterValue)) {
        const wanted: readonly unknown[] = filterValue;
        return (value) => {
            const values: readonly unknown[] = Array.isArray(value)
                ? value
                : [value];
            return values.some((item) => wanted.some((one) => same(item, one)));
        };
    }
    if (typeof filterValue === "string") {
        const folded = foldText(filterValue);
        return (value) => foldText(textOf(value)).includes(folded);
    }
    return (value) => same(value, filterValue);
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
        if (isEmptyFilter(filterValue)) return [];
        const { filter } = column;
        const passes: (value: unknown, row: TRow) => boolean = filter
            ? (value, row) => filter(value, filterValue, row)
            : matcherOf(filterValue);
        return [{ column, passes }];
    });
    if (active.length === 0) return entries;
    return entries.filter(({ row, index }) =>
        active.every(({ column, passes }) =>
            passes(cellValue(column, row, index), row),
        ),
    );
}

/** A row's text for the search: every column's value as text, folded, a separator between them. */
function searchText<TRow, TNode>(
    { row, index }: RowEntry<TRow>,
    columns: readonly Column<TRow, TNode>[],
): string {
    return columns
        .map((column) => foldText(textOf(cellValue(column, row, index))))
        .join("\u0000");
}

/**
 * Every entry's text for the search, worked out once (see `searchEntries`): by `entry.index`, so
 * `entries` are every row given, in order.
 */
export function searchTextsOf<TRow, TNode>(
    entries: readonly RowEntry<TRow>[],
    columns: readonly Column<TRow, TNode>[],
): readonly string[] {
    return entries.map((entry) => searchText(entry, columns));
}

/**
 * The entries where any column's value, as text, contains `text` (case and accents aside), in
 * order. A blank `text` keeps every entry. `texts`, from `searchTextsOf`, saves working the rows'
 * text out again on every search.
 */
export function searchEntries<TRow, TNode>(
    entries: readonly RowEntry<TRow>[],
    text: string,
    columns: readonly Column<TRow, TNode>[],
    texts?: readonly string[],
): readonly RowEntry<TRow>[] {
    const wanted = foldText(text.trim());
    if (wanted === "") return entries;
    return entries.filter((entry) =>
        (texts?.[entry.index] ?? searchText(entry, columns)).includes(wanted),
    );
}
