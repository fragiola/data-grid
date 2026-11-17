import type { FeatureTypes } from "../feature/feature";

/** A sort's direction: the values of `aria-sort`. */
export type SortDirection = "ascending" | "descending";

/** A sorted column: its key and its direction. */
export interface SortColumn {
    readonly columnKey: string;
    readonly direction: SortDirection;
}

/** What sorting keeps in the model's state. */
export interface SortingState {
    /** the sorted columns, the first one first (the grid keeps them; the app orders the rows) */
    readonly sortColumns: readonly SortColumn[];
}

/** What sorting adds to a root's props: the sort, controlled or not. */
export interface SortingProps {
    /**
     * the sorted columns, controlled, the first one first; pair it with `onSortColumnsChange`.
     * The grid keeps the sort: the app orders the rows it passes
     */
    sortColumns?: readonly SortColumn[] | undefined;
    /** the sorted columns to start with, uncontrolled */
    defaultSortColumns?: readonly SortColumn[] | undefined;
    /** the sort changed (or, controlled, asks to): a header cell was toggled, or a command ran */
    onSortColumnsChange?:
        | ((sortColumns: readonly SortColumn[]) => void)
        | undefined;
}

/** Sorting's types (Epic #27, S1–S7; a feature since Epic #141). */
export interface SortingTypes extends FeatureTypes {
    readonly state: SortingState;
    readonly options: {
        /** the sorted columns to start with (entries that are not a sortable column are dropped) */
        readonly sortColumns?: readonly SortColumn[] | undefined;
    };
    readonly commands: {
        /**
         * replaces the sorted columns, the first one first: each a sortable column, once. Returns
         * them
         */
        "sort-columns.set": {
            payload: { readonly sortColumns: readonly SortColumn[] };
            result: readonly SortColumn[];
        };
        /**
         * toggles a sortable column through ascending, descending and not sorted. Alone, it
         * becomes the only sorted column; with `multi`, the others stay and it is added last (or
         * cycles in place). Returns the sorted columns
         */
        "sort-columns.toggle": {
            payload: {
                readonly columnKey: string;
                readonly multi?: boolean | undefined;
            };
            result: readonly SortColumn[];
        };
    };
    readonly queries: {
        /** the sorted columns, the first one first */
        "sort-columns": { payload: undefined; result: readonly SortColumn[] };
        /** a column's sort, or `undefined` when it is not sorted */
        "sort-column-by": {
            payload: { readonly columnKey: string };
            result: SortColumn | undefined;
        };
    };
    readonly questions: {
        /** whether a column sorts the grid (a column, `sortable`) */
        "column-sortable": { readonly columnKey: string };
    };
    readonly props: SortingProps;
}
