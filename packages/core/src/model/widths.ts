import type { Axis } from "../axis/axis";
import { clamp, isWidth } from "../utils";
import type { Column, ColumnWidths, HeaderCellLayout } from "./types";

// Column widths (Epic #70, W1–W5): a resizable column's width is its resized one, else its
// `width`, always within its limits; a column that is not resizable is its `width`, as before.
// Pure: the model resizes with them, the column axis and the parts read them.

/** What sizes a column: its key, its width, and whether and within what it resizes. */
type SizedColumn = Pick<
    Column<unknown>,
    "key" | "width" | "resizable" | "minWidth" | "maxWidth"
>;

/** A resizable column's narrowest width when it gives none: a floor against one that vanishes. */
export const DEFAULT_MIN_WIDTH = 40;

/** Whether a person can resize a column. */
export function isResizable(column: SizedColumn): boolean {
    return column.resizable === true;
}

const resizableLists = new WeakMap<readonly SizedColumn[], boolean>();

/** Whether a column of the grid is resizable: found once per list (the state's are never mutated). */
export function hasResizable(columns: readonly SizedColumn[]): boolean {
    let has = resizableLists.get(columns);
    if (has === undefined) {
        has = columns.some(isResizable);
        resizableLists.set(columns, has);
    }
    return has;
}

/** A resizable column's limits: `max` is infinite without one, and `min` never passes it. */
export function widthLimits(column: SizedColumn): {
    readonly min: number;
    readonly max: number;
} {
    const max = column.maxWidth ?? Number.POSITIVE_INFINITY;
    return { min: column.minWidth ?? Math.min(DEFAULT_MIN_WIDTH, max), max };
}

/** A column's width on screen: resizable, its resized width or its own, within its limits. */
export function columnWidth(
    column: SizedColumn,
    columnWidths: ColumnWidths,
): number {
    if (!isResizable(column)) return column.width;
    const { min, max } = widthLimits(column);
    // own keys only: a column called "constructor" is no inherited function
    const resized = Object.hasOwn(columnWidths, column.key)
        ? columnWidths[column.key]
        : undefined;
    return clamp(resized ?? column.width, min, max);
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

/**
 * The widths after resizing `columns` (a column, or a group's) to `width` together (W5): the
 * resizable ones share the change in proportion to their widths, each within its limits; what one
 * could not take goes to the ones that still can, until none is left or every one is at a limit.
 * The widths are then rounded to whole pixels in order, each passing its rounding on to the next.
 * Only a column whose width changes gets one, and none when it is back to its own; nothing
 * changing, the same record.
 */
export function resizedWidths(
    columns: readonly SizedColumn[],
    columnWidths: ColumnWidths,
    width: number,
): ColumnWidths {
    let remaining = width;
    for (const column of columns) {
        remaining -= columnWidth(column, columnWidths);
    }
    const shares = columns.filter(isResizable).map((column) => {
        const current = columnWidth(column, columnWidths);
        return {
            key: column.key,
            current,
            // its own width: resized back to it, it needs no width of the record's
            own: columnWidth(column, {}),
            next: current,
            ...widthLimits(column),
        };
    });
    /** the columns that can still take a share */
    let open = shares;
    while (Math.abs(remaining) > EPSILON && open.length > 0) {
        let weight = 0;
        for (const share of open) weight += share.current;
        const pool = remaining;
        const count = open.length;
        // the ones a limit stopped are done
        open = open.filter((share) => {
            // all of them 0 wide: an equal share
            const wanted =
                share.next +
                (weight > 0 ? (pool * share.current) / weight : pool / count);
            const next = clamp(wanted, share.min, share.max);
            remaining -= next - share.next;
            share.next = next;
            return next === wanted;
        });
        // every one took its whole share: nothing is left
        if (open.length === count) break;
    }
    const changed = new Set<string>();
    const entries: [string, number][] = [];
    let carry = 0;
    for (const share of shares) {
        const exact = share.next + carry;
        const rounded = clamp(Math.round(exact), share.min, share.max);
        carry = exact - rounded;
        if (rounded === share.current) continue;
        changed.add(share.key);
        if (rounded !== share.own) entries.push([share.key, rounded]);
    }
    if (changed.size === 0) return columnWidths;
    return Object.fromEntries([
        ...Object.entries(columnWidths).filter(([key]) => !changed.has(key)),
        ...entries,
    ]);
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

/** Whether a column of a span (a header cell's) is resizable. */
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
