import { clamp } from "../utils";

/** How many pages `count` items make: one at least; one in all without a page size. */
export function pageCount(count: number, pageSize: number | undefined): number {
    if (pageSize === undefined || pageSize <= 0) return 1;
    return Math.max(1, Math.ceil(count / pageSize));
}

/** A page index kept inside the pages there are. */
export function clampPageIndex(
    pageIndex: number,
    count: number,
    pageSize: number | undefined,
): number {
    const last = pageCount(count, pageSize) - 1;
    return clamp(Math.floor(pageIndex), 0, last);
}

/** The items of a page (all of them without a page size). */
export function pageOf<T>(
    items: readonly T[],
    pageIndex: number,
    pageSize: number | undefined,
): readonly T[] {
    if (pageSize === undefined || pageSize <= 0) return items;
    const start = clampPageIndex(pageIndex, items.length, pageSize) * pageSize;
    return items.slice(start, start + pageSize);
}
