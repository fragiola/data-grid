// What the cells that read the grid's state share: the selection is the grid's (the app keeps the
// keys it answers), the sort too. The columns stay the same objects: only these cells re-render.

export type SortKey = "name" | "domain" | "employees" | "arr" | "country";

const SORT_KEYS: readonly SortKey[] = [
    "name",
    "domain",
    "employees",
    "arr",
    "country",
];

/** Whether a value (a select's) is one of the sortable columns. */
export function isSortKey(value: unknown): value is SortKey {
    return SORT_KEYS.some((key) => key === value);
}
