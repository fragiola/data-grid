import { clamp } from "../utils";

/** Where to put an item when scrolling to it. */
export type ScrollAlign = "nearest" | "start" | "center" | "end";

/**
 * The virtual offset that brings `[start, end)` into view (an item, or a row's cells without its
 * detail), from `offset`, with a viewport of `viewportSize` over content `totalSize` long.
 * `"nearest"` moves as little as possible (not at all when the span is already in view); the
 * others put the span at the viewport's start, centre or end. Clamped to the scrollable range.
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
    return clamp(target, 0, max);
}
