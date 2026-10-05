import type { RowKey } from "./model/types";

// Small helpers the core's modules share. Outside `local/` and `selection/`: the grid's own entry
// reaches this file, never the extras.

/** `value` kept from `min` to `max` (`max` wins when they cross). */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/** Whether a value is a size in pixels: a number, finite and not negative. */
export function isWidth(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** What a column's `colSpan` answered, as a span (E1.2): a whole number of columns, at least 1. */
export function spanValue(value: unknown): number {
    return typeof value === "number" && value >= 2 ? Math.floor(value) : 1;
}

/** Whether `value` is an index: a whole number, 0 or more, and below `count` when given. */
export function isIndex(
    value: number,
    count = Number.POSITIVE_INFINITY,
): boolean {
    return Number.isInteger(value) && value >= 0 && value < count;
}

/** Whether two lists hold the same items in the same order, compared by `same`. */
export function sameList<T>(
    a: readonly T[],
    b: readonly T[],
    same: (a: T, b: T | undefined) => boolean,
): boolean {
    return (
        a === b ||
        (a.length === b.length && a.every((item, i) => same(item, b[i])))
    );
}

/** A function of its arguments, computed again only when one of them changes (by identity). */
export function memo<A extends readonly unknown[], R>(
    compute: (...args: A) => R,
): (...args: A) => R {
    let last: { args: A; value: R } | null = null;
    return (...args: A) => {
        if (last && sameList(last.args, args, Object.is)) return last.value;
        const value = compute(...args);
        last = { args, value };
        return value;
    };
}

/** The first of `count` items `isBefore` is false for (`count` when none): a bisection. */
export function lowerBound(
    count: number,
    isBefore: (index: number) => boolean,
): number {
    let low = 0;
    let high = count;
    while (low < high) {
        const middle = (low + high) >>> 1;
        if (isBefore(middle)) low = middle + 1;
        else high = middle;
    }
    return low;
}

const sets = new WeakMap<readonly RowKey[], ReadonlySet<RowKey>>();

/** The keys as a set, built once per list (the state's lists are never mutated). */
export function keySet(keys: readonly RowKey[]): ReadonlySet<RowKey> {
    let set = sets.get(keys);
    if (!set) {
        set = new Set(keys);
        sets.set(keys, set);
    }
    return set;
}

/** `keys` with `key` removed when it is there, else added last (alone when `single`). */
export function toggledKey<K extends RowKey>(
    keys: readonly K[],
    key: K,
    single = false,
): readonly K[] {
    if (keySet(keys).has(key)) return keys.filter((entry) => entry !== key);
    return single ? [key] : [...keys, key];
}

/** Whether two lists hold the same keys, whatever their order (each list holds a key once). */
export function sameKeys(a: readonly RowKey[], b: readonly RowKey[]): boolean {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    const held = keySet(b);
    return a.every((key) => held.has(key));
}
