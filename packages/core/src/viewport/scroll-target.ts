import { clamp } from "../utils";

/** Where to put an item when scrolling to it. */
export type ScrollAlign = "nearest" | "start" | "center" | "end";

/**
 * The virtual offset that brings `[start, end)` into view (an item, or a row's cells without its
 * detail), from `offset`, with a viewport of `viewportSize` over content `totalSize` long.
 * `"nearest"` moves as little as possible (not at all when the span is already in view); the
 * others put the span at the viewport's start, centre or end. Clamped to the scrollable range.
 * A span's start is reached rounded down and its end rounded up (Epic #89): a browser scrolls by
 * whole pixels its own way (WebKit drops a fraction Chromium rounds), so a span with fractional
 * edges (measured rows) still ends up wholly in view in every engine.
 */
export function scrollTargetForSpan(
    start: number,
    end: number,
    offset: number,
    viewportSize: number,
    totalSize: number,
    align: ScrollAlign = "nearest",
): number {
    const max = Math.max(0, Math.ceil(totalSize - viewportSize));
    let target: number;
    switch (align) {
        case "start":
            target = Math.floor(start);
            break;
        case "end":
            target = Math.ceil(end - viewportSize);
            break;
        case "center":
            target = start - (viewportSize - (end - start)) / 2;
            break;
        default:
            if (start < offset) {
                target = Math.floor(start);
            } else if (end > offset + viewportSize) {
                // an item larger than the viewport shows its start
                target = Math.min(
                    Math.ceil(end - viewportSize),
                    Math.floor(start),
                );
            } else {
                target = offset;
            }
    }
    return clamp(target, 0, max);
}
