import { clamp } from "../utils/utils";
import type { Column, ColumnWidths } from "./types";

// Column widths (Epic #70, W1–W5; Epic #80, A1–A5): a resizable column's width is its override
// (a resize's: `columnResize()`, Epic #148), else the engine's for it (an automatic width, a flex
// share), else its `width`, always within its limits; a column that is not resizable is the
// engine's width or its `width`. Pure: the engine lays out its flex columns with them, the column
// axis reads them; `autoSize` and `flex` are how a column's width is declared, the core's.

/** What sizes a column: its key, its width, and whether and within what it resizes or flexes. */
export type SizedColumn = Pick<
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
interface ColumnTraits {
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

/** A measured content width as a column's width (A3, A5): rounded up, within its limits. */
export function fittedWidth(column: SizedColumn, measured: number): number {
    return withinLimits(column, Math.ceil(measured));
}

/**
 * The columns of a span: a column's or a group's header cell (`header.cellByKey`), a column's
 * with the ones its header span covers (E1.2).
 */
export function columnsOf<TColumn>(
    state: { readonly columns: readonly TColumn[] },
    span: { readonly columnIndex: number; readonly columnSpan: number },
): readonly TColumn[] {
    return state.columns.slice(
        span.columnIndex,
        span.columnIndex + span.columnSpan,
    );
}
