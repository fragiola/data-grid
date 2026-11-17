import type { Axis } from "../axis/axis";
import type { ColumnWidths, HeaderCellLayout } from "../model/types";
import {
    columnTraits,
    columnWidth,
    isResizable,
    NO_WIDTHS,
    type SizedColumn,
    sameWidths,
    sharedWidths,
    widthLimits,
} from "../model/widths";
import { isWidth } from "../utils/utils";

// A resize's widths (Epic #70, W1–W5; a feature since Epic #148): the overrides a person's
// resizes give columns, over their declared sizing (`model/widths.ts`, the core's), and what a
// resizer reports of its columns. Pure: the feature's commands resize with them, its parts read
// them.

/** Whether a column of the grid is resizable. */
export function hasResizable(columns: readonly SizedColumn[]): boolean {
    return columnTraits(columns).resizable;
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
