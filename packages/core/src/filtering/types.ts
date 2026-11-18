import type { FeatureTypes } from "../feature/feature";

/**
 * The column filters, by column key: a value each (Epic #153). What a value means is the app's
 * (a server's) or `/local`'s: a text is contained (case and accents aside), a list holds the
 * cell's value, anything else equals it, and a column's `filter` overrides. An empty value
 * (`undefined`, `null`, `""`, `[]`) is no filter: the grid never keeps one.
 */
export type ColumnFilters = Readonly<Record<string, unknown>>;

/** What filtering keeps in the model's state. */
export interface FilteringState {
    /** the column filters, by column key, none empty (the grid keeps them; the app filters the rows) */
    readonly columnFilters: ColumnFilters;
}

/** What filtering adds to a root's props: the column filters, controlled or not. */
export interface FilteringProps {
    /**
     * the column filters, controlled, by column key; pair it with `onColumnFiltersChange`. The
     * grid keeps the filters: the app filters the rows it passes (`/local` does, in memory)
     */
    columnFilters?: ColumnFilters | undefined;
    /** the column filters to start with, uncontrolled */
    defaultColumnFilters?: ColumnFilters | undefined;
    /** the filters changed (or, controlled, ask to): a command ran */
    onColumnFiltersChange?:
        | ((columnFilters: ColumnFilters) => void)
        | undefined;
}

/** Filtering's types (Epic #153). */
export interface FilteringTypes extends FeatureTypes {
    readonly state: FilteringState;
    readonly options: {
        /** the column filters to start with (a key that is no column's, or an empty value, is dropped) */
        readonly columnFilters?: ColumnFilters | undefined;
    };
    readonly commands: {
        /**
         * replaces the column filters: each key a column's (a hidden one's too), an empty value
         * left out. Returns them
         */
        "column-filters.set": {
            payload: { readonly columnFilters: ColumnFilters };
            result: ColumnFilters;
        };
        /** filters a column by a value (an empty one clears its filter). Returns the filters */
        "column-filter.set": {
            payload: { readonly columnKey: string; readonly value: unknown };
            result: ColumnFilters;
        };
        /** clears one column's filter, or every filter without a key. Returns the filters */
        "column-filters.clear": {
            payload: { readonly columnKey?: string | undefined } | undefined;
            result: ColumnFilters;
        };
    };
    readonly queries: {
        /** the column filters, by column key */
        "column-filters": { payload: undefined; result: ColumnFilters };
        /** a column's filter value, or `undefined` when it is not filtered */
        "column-filter-by": {
            payload: { readonly columnKey: string };
            result: unknown;
        };
    };
    readonly questions: {
        /** whether a column has a filter */
        "column-filtered": { readonly columnKey: string };
    };
    readonly props: FilteringProps;
}
