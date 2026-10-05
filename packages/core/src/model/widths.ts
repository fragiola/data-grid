import type { Axis } from "../axis/axis";
import { clamp, isWidth } from "../utils";
import type { Column, ColumnWidths, HeaderCellLayout } from "./types";

// Column widths (Epic #70, W1–W5; Epic #80, A1–A5): a resizable column's width is its resized
// one, else the engine's for it (an automatic width, a flex share), else its `width`, always
// within its limits; a column that is not resizable is the engine's width or its `width`. Pure:
// the model resizes with them, the engine lays out its flex columns with them, the column axis
// and the parts read them.

/** What sizes a column: its key, its width, and whether and within what it resizes or flexes. */
type SizedColumn = Pick<
    Column<unknown>,
    | "key"
    | "width"
    | "resizable"
    | "minWidth"
    | "maxWidth"
    | "flex"
    | "autoSize"
>;

/** No widths: a grid whose engine sizes no column itself (one record, not one per read). */
export const NO_WIDTHS: ColumnWidths = Object.freeze({});

/** A resizable column's narrowest width when it gives none: a floor against one that vanishes. */
export const DEFAULT_MIN_WIDTH = 40;

/** Whether a person can resize a column. */
export function isResizable(column: SizedColumn): boolean {
    return column.resizable === true;
}

/** Whether a column shares the view's leftover width (A1): a `flex` above 0. */
export function isFlex(column: SizedColumn): boolean {
    return column.flex !== undefined && column.flex > 0;
}

/** What a grid's columns ask of the widths: worked out once per list (`columnTraits`). */
export interface ColumnTraits {
    /** a column is resizable */
    readonly resizable: boolean;
    /** a column flexes: the view's width lays the columns out */
    readonly flex: boolean;
    /** the `autoSize` columns' keys, in order */
    readonly autoSizeKeys: readonly string[];
}

const traits = new WeakMap<readonly SizedColumn[], ColumnTraits>();

/** What a grid's columns ask of the widths, found once per list (the state's are never mutated). */
export function columnTraits(columns: readonly SizedColumn[]): ColumnTraits {
    let found = traits.get(columns);
    if (!found) {
        found = {
            resizable: columns.some(isResizable),
            flex: columns.some(isFlex),
            autoSizeKeys: columns
                .filter((column) => column.autoSize === true)
                .map((column) => column.key),
        };
        traits.set(columns, found);
    }
    return found;
}

/** Whether a column of the grid is resizable. */
export function hasResizable(columns: readonly SizedColumn[]): boolean {
    return columnTraits(columns).resizable;
}

/** Whether the engine sizes a column of the grid itself (A1, A5): one flexes or fits itself. */
export function hasEngineSized(columns: readonly SizedColumn[]): boolean {
    const { flex, autoSizeKeys } = columnTraits(columns);
    return flex || autoSizeKeys.length > 0;
}

/**
 * A resizable column's limits, which a resize, a flex share and a fit keep to: `max` is infinite
 * without one, and `min` never passes it.
 */
export function widthLimits(column: SizedColumn): {
    readonly min: number;
    readonly max: number;
} {
    const max = column.maxWidth ?? Number.POSITIVE_INFINITY;
    return { min: column.minWidth ?? Math.min(DEFAULT_MIN_WIDTH, max), max };
}

/** A record's width for a key, own keys only: a column called "constructor" is no inherited function. */
function widthIn(widths: ColumnWidths, key: string): number | undefined {
    return Object.hasOwn(widths, key) ? widths[key] : undefined;
}

/** A column's resized width (its override), when it resizes and has one; within its limits. */
function resizedWidth(
    column: SizedColumn,
    columnWidths: ColumnWidths,
): number | undefined {
    const resized = isResizable(column)
        ? widthIn(columnWidths, column.key)
        : undefined;
    return resized === undefined ? undefined : withinLimits(column, resized);
}

/** No limits: a column that is not resizable has none (W2). */
const NO_LIMITS = { min: 0, max: Number.POSITIVE_INFINITY } as const;

/** A column's limits: a resizable one's (`widthLimits`); none for the others. */
function limitsOf(column: SizedColumn): {
    readonly min: number;
    readonly max: number;
} {
    return isResizable(column) ? widthLimits(column) : NO_LIMITS;
}

/** A width kept within a column's limits: a resizable one's, as is for the others. */
export function withinLimits(column: SizedColumn, width: number): number {
    const { min, max } = limitsOf(column);
    return clamp(width, min, max);
}

/**
 * A column's width on screen: resizable, its resized width, else the engine's for it
 * (`autoWidths`: an automatic width, a flex share), else its own, within its limits; not
 * resizable, the engine's or its own.
 */
export function columnWidth(
    column: SizedColumn,
    columnWidths: ColumnWidths,
    autoWidths: ColumnWidths = NO_WIDTHS,
): number {
    const auto = widthIn(autoWidths, column.key);
    if (!isResizable(column)) return auto ?? column.width;
    return withinLimits(
        column,
        widthIn(columnWidths, column.key) ?? auto ?? column.width,
    );
}

const checked = new WeakMap<object, ColumnWidths>();

/**
 * The widths kept of a record given again and again (a drag's `autoWidths`, once a frame): its
 * entries that are widths, worked out once per record.
 */
export function keptWidthsOf(columnWidths: unknown): ColumnWidths {
    if (typeof columnWidths !== "object" || columnWidths === null) {
        return NO_WIDTHS;
    }
    let kept = checked.get(columnWidths);
    if (!kept) {
        kept = keptWidths(columnWidths);
        checked.set(columnWidths, kept);
    }
    return kept;
}

/** The widths kept of a record: its entries that are widths, in a copy of the model's own. */
export function keptWidths(columnWidths: unknown): ColumnWidths {
    if (typeof columnWidths !== "object" || columnWidths === null) return {};
    return Object.fromEntries(
        Object.entries(columnWidths).filter(([, width]) => isWidth(width)),
    );
}

/** Whether two records hold the same widths. */
export function sameWidths(a: ColumnWidths, b: ColumnWidths): boolean {
    if (a === b) return true;
    const keys = Object.keys(a);
    return (
        keys.length === Object.keys(b).length &&
        keys.every((key) => Object.hasOwn(b, key) && a[key] === b[key])
    );
}

/** Below this, what is left of a change to share is nothing (floating point). */
const EPSILON = 1e-6;

/** A column's part of a width shared among columns (`sharedWidths`). */
export interface WidthShare {
    /** what its part is in proportion to */
    readonly weight: number;
    /** the width its part is added to */
    readonly start: number;
    readonly min: number;
    readonly max: number;
}

/**
 * Shares `amount` among columns, added to their `start`, in proportion to their weights, each
 * within its limits, as a flexbox resolves its items: the parts are worked out, and when limits
 * stopped some, only the ones stopped on the side the stops add up to (below their minimum, or
 * past their maximum) keep their limit; the others share again what is left, until no limit
 * stops one or every one is at a limit. The widths are then rounded to whole pixels in order,
 * each passing its rounding on to the next. Returns them, in order. A group's resize (W5) and the
 * flex columns (A1) share this way.
 */
export function sharedWidths(
    shares: readonly WidthShare[],
    amount: number,
): number[] {
    const widths = shares.map((share) => share.start);
    const wanted = [...widths];
    /** the columns kept at a limit */
    const frozen = shares.map(() => false);
    for (;;) {
        let free = amount;
        let weight = 0;
        let count = 0;
        shares.forEach((share, index) => {
            if (frozen[index]) {
                free -= (widths[index] ?? share.start) - share.start;
            } else {
                weight += share.weight;
                count += 1;
            }
        });
        if (count === 0) break;
        let stopped = 0;
        shares.forEach((share, index) => {
            if (frozen[index]) return;
            // all of them weightless: an equal part
            const part =
                weight > 0 ? (free * share.weight) / weight : free / count;
            const want = share.start + part;
            const width = clamp(want, share.min, share.max);
            wanted[index] = want;
            widths[index] = width;
            stopped += width - want;
        });
        if (Math.abs(stopped) <= EPSILON) break;
        shares.forEach((_, index) => {
            const width = widths[index] ?? 0;
            const want = wanted[index] ?? 0;
            if (!frozen[index] && (stopped > 0 ? width > want : width < want)) {
                frozen[index] = true;
            }
        });
    }
    let carry = 0;
    return shares.map((share, index) => {
        const exact = (widths[index] ?? share.start) + carry;
        const rounded = clamp(Math.round(exact), share.min, share.max);
        carry = exact - rounded;
        return rounded;
    });
}

/**
 * The width a column has without an override: the engine's for it (`autoWidths`: an automatic
 * width, a flex share, as it is without that override), else its own, within its limits. A
 * resize or a fit back to it writes none.
 */
export function unresizedWidth(
    column: SizedColumn,
    autoWidths: ColumnWidths,
): number {
    return columnWidth(column, NO_WIDTHS, autoWidths);
}

/**
 * The widths after resizing `columns` (a column, or a group's) to `width` together (W5): the
 * resizable ones share the change in proportion to their widths, each within its limits
 * (`sharedWidths`). The widths start from the ones on screen: a column without an override is the
 * engine's width for it (`autoWidths`) or its own. Only a column whose width changes gets one, and
 * none when it is back to the width it has without one; nothing changing, the same record.
 *
 * A group's column that flexes and does not resize is counted at its share as it was, but the
 * share moves once the others' widths change (the view's width is shared again): such a group
 * ends off `width`, its handle away from the pointer, and when that column alone takes what the
 * view leaves, the group stays as wide as it was (its share takes what the others give up).
 * Known, documented: make such a column resizable, or keep it out of a resizable group.
 */
export function resizedWidths(
    columns: readonly SizedColumn[],
    columnWidths: ColumnWidths,
    width: number,
    autoWidths: ColumnWidths = NO_WIDTHS,
): ColumnWidths {
    let remaining = width;
    for (const column of columns) {
        remaining -= columnWidth(column, columnWidths, autoWidths);
    }
    const resizable = columns.filter(isResizable).map((column) => {
        const current = columnWidth(column, columnWidths, autoWidths);
        return {
            key: column.key,
            current,
            // resized back to the width it has without one, it needs none of the record's
            own: unresizedWidth(column, autoWidths),
            weight: current,
            start: current,
            ...widthLimits(column),
        };
    });
    const widths = sharedWidths(resizable, remaining);
    const changed = new Set<string>();
    const entries: [string, number][] = [];
    resizable.forEach((share, index) => {
        const rounded = widths[index];
        if (rounded === undefined || rounded === share.current) return;
        changed.add(share.key);
        if (rounded !== share.own) entries.push([share.key, rounded]);
    });
    if (changed.size === 0) return columnWidths;
    return Object.fromEntries([
        ...Object.entries(columnWidths).filter(([key]) => !changed.has(key)),
        ...entries,
    ]);
}

/**
 * The widths the engine gives the columns without an override (A1, A5): an `autoSize` column's
 * automatic width (`automatic`, measured), and the flex columns' shares of what the others leave
 * of `viewWidth` (pinned ones included), in proportion to their `flex`, each from its base (its
 * automatic width, else its own) to its maximum (`sharedWidths`): nothing left, its base. A
 * column with neither has none.
 */
export function autoWidthsOf(
    columns: readonly SizedColumn[],
    columnWidths: ColumnWidths,
    automatic: ColumnWidths,
    viewWidth: number,
): ColumnWidths {
    const entries: [string, number][] = [];
    const flexing: { key: string; share: WidthShare }[] = [];
    let left = viewWidth;
    for (const column of columns) {
        const resized = resizedWidth(column, columnWidths);
        const measured =
            column.autoSize === true
                ? widthIn(automatic, column.key)
                : undefined;
        const auto =
            measured === undefined ? undefined : withinLimits(column, measured);
        if (resized === undefined && isFlex(column)) {
            const base = auto ?? columnWidth(column, NO_WIDTHS);
            const { min, max } = limitsOf(column);
            flexing.push({
                key: column.key,
                share: {
                    weight: column.flex ?? 0,
                    start: 0,
                    min: Math.max(base, min),
                    max,
                },
            });
            continue;
        }
        if (resized === undefined && auto !== undefined) {
            entries.push([column.key, auto]);
        }
        left -= resized ?? auto ?? columnWidth(column, NO_WIDTHS);
    }
    const shares = sharedWidths(
        flexing.map(({ share }) => share),
        left,
    );
    flexing.forEach(({ key }, index) => {
        const share = shares[index];
        if (share !== undefined) entries.push([key, share]);
    });
    return entries.length === 0 ? NO_WIDTHS : Object.fromEntries(entries);
}

/** The widths without the overrides of `keys`. */
export function withoutWidths(
    columnWidths: ColumnWidths,
    keys: readonly string[],
): ColumnWidths {
    const next = Object.fromEntries(
        Object.entries(columnWidths).filter(([key]) => !keys.includes(key)),
    );
    return sameWidths(next, columnWidths) ? columnWidths : next;
}

/** A run of columns: a header cell's (a column's, or a group's). */
export type ColumnSpan = Pick<
    HeaderCellLayout<unknown>,
    "columnIndex" | "columnSpan"
>;

/**
 * Whether a column of a span (a header cell's: a group's columns, or a column's and the ones its
 * header span covers) is resizable.
 */
export function spanResizable(
    columns: readonly SizedColumn[],
    { columnIndex, columnSpan }: ColumnSpan,
): boolean {
    if (!hasResizable(columns)) return false;
    for (let index = columnIndex; index < columnIndex + columnSpan; index++) {
        const column = columns[index];
        if (column && isResizable(column)) return true;
    }
    return false;
}

/** What a resize handle reports of its columns: their width, and the limits it moves within. */
export interface SpanWidths {
    /** their width on screen */
    readonly width: number;
    /** the narrowest they get: each resizable one at its minimum, the others as they are */
    readonly minWidth: number;
    /** the widest they get, or `undefined` when a resizable one has no maximum */
    readonly maxWidth: number | undefined;
}

/** The width and limits of a span's columns, their widths on screen read from `axis`. */
export function spanWidths(
    columns: readonly SizedColumn[],
    axis: Axis,
    { columnIndex, columnSpan }: ColumnSpan,
): SpanWidths {
    let width = 0;
    let min = 0;
    let max = 0;
    for (let index = columnIndex; index < columnIndex + columnSpan; index++) {
        const column = columns[index];
        const current = axis.sizeOf(index);
        width += current;
        if (column && isResizable(column)) {
            const limits = widthLimits(column);
            min += limits.min;
            max += limits.max;
        } else {
            min += current;
            max += current;
        }
    }
    return {
        width,
        minWidth: min,
        maxWidth: Number.isFinite(max) ? max : undefined,
    };
}

/**
 * The widest a resizer goes (its `aria-valuemax`, where End takes it): its columns' maximum, or
 * without one the wider of their width and the view's (a separator's value has a maximum).
 */
export function resizeMaximum(span: SpanWidths, viewportWidth: number): number {
    return span.maxWidth ?? Math.max(span.width, viewportWidth);
}
