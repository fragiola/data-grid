import type { Axis } from "../axis/axis";

/** Where to put an item when scrolling to it. */
export type ScrollAlign = "nearest" | "start" | "center" | "end";

/**
 * The virtual offset that brings item `index` into view, from `offset`, with a viewport of
 * `viewportSize`. `"nearest"` moves as little as possible (not at all when the item is already
 * in view); the others put the item at the viewport's start, centre or end. Clamped to the
 * scrollable range.
 */
export function scrollTargetFor(
    axis: Axis,
    index: number,
    offset: number,
    viewportSize: number,
    align: ScrollAlign = "nearest",
): number {
    if (axis.count === 0) return 0;
    const item = Math.min(Math.max(Math.floor(index), 0), axis.count - 1);
    const start = axis.offsetOf(item);
    return scrollTargetForSpan(
        start,
        start + axis.sizeOf(item),
        offset,
        viewportSize,
        axis.totalSize,
        align,
    );
}

/**
 * The virtual offset that brings `[start, end)` into view, from `offset`, with a viewport of
 * `viewportSize` over content `totalSize` long: {@link scrollTargetFor} for any span (a row's
 * cells, without its detail).
 */
export function scrollTargetForSpan(
    start: number,
    end: number,
    offset: number,
    viewportSize: number,
    totalSize: number,
    align: ScrollAlign = "nearest",
): number {
    const max = Math.max(0, totalSize - viewportSize);
    let target: number;
    switch (align) {
        case "start":
            target = start;
            break;
        case "end":
            target = end - viewportSize;
            break;
        case "center":
            target = start - (viewportSize - (end - start)) / 2;
            break;
        default:
            if (start < offset) {
                target = start;
            } else if (end > offset + viewportSize) {
                // an item larger than the viewport shows its start
                target = Math.min(end - viewportSize, start);
            } else {
                target = offset;
            }
    }
    return Math.min(Math.max(target, 0), max);
}
