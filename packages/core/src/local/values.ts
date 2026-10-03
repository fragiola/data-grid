// How the local pipeline reads a cell's value: whether it is empty, how two values compare, and
// the text a filter or a search looks in.

/**
 * Whether a value is empty: `undefined`, `null`, `NaN`, `""`, an empty list or an invalid date
 * (sorted last, never filtered by).
 */
export function isEmptyValue(value: unknown): boolean {
    return (
        value === undefined ||
        value === null ||
        value === "" ||
        (typeof value === "number" && Number.isNaN(value)) ||
        (Array.isArray(value) && value.length === 0) ||
        (value instanceof Date && Number.isNaN(value.getTime()))
    );
}

let collator: Intl.Collator | undefined;

/** Text in the reader's order: "item 2" before "item 10", case and accents aside. */
function compareText(a: string, b: string): number {
    collator ??= new Intl.Collator(undefined, {
        numeric: true,
        sensitivity: "base",
    });
    return collator.compare(a, b);
}

/** A value's rank among types, for two values of different types (numbers first). */
function typeRank(value: unknown): number {
    if (typeof value === "number" || typeof value === "bigint") return 0;
    if (value instanceof Date) return 1;
    if (typeof value === "boolean") return 2;
    return 3;
}

/**
 * How two values compare, by type: numbers (and bigints) numerically, dates by time, `false`
 * before `true`, anything else as text in the reader's order. Values of different types compare
 * by type first. Empty values are not compared here: the sort puts them last.
 */
export function compareValues(a: unknown, b: unknown): number {
    // the common case first: two numbers
    if (typeof a === "number" && typeof b === "number") {
        return a < b ? -1 : a > b ? 1 : 0;
    }
    if (typeof a === "string" && typeof b === "string") {
        return compareText(a, b);
    }
    const rank = typeRank(a) - typeRank(b);
    if (rank !== 0) return rank;
    if (
        (typeof a === "number" || typeof a === "bigint") &&
        (typeof b === "number" || typeof b === "bigint")
    ) {
        return a < b ? -1 : a > b ? 1 : 0;
    }
    if (a instanceof Date && b instanceof Date) {
        // an invalid date (empty, as `isEmptyValue` says) compares equal, never NaN
        return a.getTime() - b.getTime() || 0;
    }
    if (typeof a === "boolean" && typeof b === "boolean") {
        return Number(a) - Number(b);
    }
    return compareText(textOf(a), textOf(b));
}

/** A value as text: a date in ISO form, a list's items joined, an empty value as "". */
export function textOf(value: unknown): string {
    if (isEmptyValue(value)) return "";
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(textOf).join(" ");
    return String(value);
}

/** Text to match: lower case, without accents ("Ação" matches "acao"). */
export function foldText(text: string): string {
    // plain ASCII has no accents to take off: the costly part skipped for most text. Lower case
    // the same way for all text, whatever the reader's locale (no Turkish dotless i)
    if (/^[\x20-\x7e]*$/.test(text)) return text.toLowerCase();
    // only combining marks go (the accents NFD splits off), never `^` or `` ` `` themselves
    return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
