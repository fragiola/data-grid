// The column filters' shared rules (Epic #153): what an empty filter is, the filters without the
// empty ones, whether two are the same. Read by the filtering feature and the local pipeline,
// never by the grid's own entry.

/** Whether a filter value filters nothing: `undefined`, `null`, `NaN`, `""`, an empty list or an invalid date. */
export function isEmptyFilter(filterValue: unknown): boolean {
    return (
        filterValue === undefined ||
        filterValue === null ||
        filterValue === "" ||
        (typeof filterValue === "number" && Number.isNaN(filterValue)) ||
        (Array.isArray(filterValue) && filterValue.length === 0) ||
        (filterValue instanceof Date && Number.isNaN(filterValue.getTime()))
    );
}

/** The filters without the empty ones (they filter nothing): the same object when none is. */
export function withoutEmptyFilters(
    filters: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
    const entries = Object.entries(filters);
    const kept = entries.filter(([, value]) => !isEmptyFilter(value));
    return kept.length === entries.length ? filters : Object.fromEntries(kept);
}

/** Whether two filters are the same: the same keys, each with the same value (by identity). */
export function sameFilters(
    a: Readonly<Record<string, unknown>>,
    b: Readonly<Record<string, unknown>>,
): boolean {
    if (a === b) return true;
    const keys = Object.keys(a);
    return (
        keys.length === Object.keys(b).length &&
        keys.every((key) => Object.hasOwn(b, key) && Object.is(a[key], b[key]))
    );
}
