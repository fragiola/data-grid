import type { Axis } from "../axis/axis";

// Which items of an axis are in view, and which are rendered around them. Pure math, no DOM.

/** A run of item indexes: from `start` (included) to `end` (excluded). Empty when they are equal. */
export interface Range {
    readonly start: number;
    readonly end: number;
}

/** An axis's window: the items in view, and the items rendered (the visible ones plus overscan). */
export interface AxisWindow {
    readonly visible: Range;
    readonly rendered: Range;
}

export const EMPTY_RANGE: Range = { start: 0, end: 0 };
export const EMPTY_WINDOW: AxisWindow = {
    visible: EMPTY_RANGE,
    rendered: EMPTY_RANGE,
};

/** The items that intersect `[offset, offset + viewportSize)`: what is in view. */
export function visibleRange(
    axis: Axis,
    offset: number,
    viewportSize: number,
): Range {
    if (axis.count === 0 || viewportSize <= 0) return EMPTY_RANGE;
    const start = axis.indexAt(offset);
    const bottom = offset + viewportSize;
    const last = axis.indexAt(bottom);
    // `last` covers the bottom edge; it is in view only when it starts before that edge
    const end = Math.min(
        axis.offsetOf(last) < bottom ? last + 1 : last,
        axis.count,
    );
    return { start, end: Math.max(end, start + 1) };
}

/** `range` grown by `overscan` items on each side, clamped to the axis. */
export function withOverscan(
    axis: Axis,
    range: Range,
    overscan: number,
): Range {
    if (range.start === range.end) return range;
    const extra = Math.max(0, Math.floor(overscan));
    return {
        start: Math.max(0, range.start - extra),
        end: Math.min(axis.count, range.end + extra),
    };
}

/** Whether `inner` lies inside `outer` (an empty range lies inside anything). */
export function contains(outer: Range, inner: Range): boolean {
    return (
        inner.start === inner.end ||
        (inner.start >= outer.start && inner.end <= outer.end)
    );
}

export function sameRange(a: Range, b: Range): boolean {
    return a.start === b.start && a.end === b.end;
}

export function sameWindow(a: AxisWindow, b: AxisWindow): boolean {
    return sameRange(a.visible, b.visible) && sameRange(a.rendered, b.rendered);
}

/**
 * The window at `offset`: what is in view, and what is rendered. With a `previous` window, the
 * rendered range is kept while it still covers what is in view and stays inside the axis, so
 * scrolling inside the overscan changes nothing to render; once the view leaves it, the rendered
 * range is the view plus `overscan` items on each side.
 */
export function windowFor(
    axis: Axis,
    offset: number,
    viewportSize: number,
    overscan: number,
    previous?: AxisWindow,
): AxisWindow {
    const visible = visibleRange(axis, offset, viewportSize);
    if (visible.start === visible.end) return EMPTY_WINDOW;
    const kept = previous?.rendered;
    if (
        kept &&
        kept.end <= axis.count &&
        contains(kept, visible) &&
        // a rendered range larger than the view needs (the viewport shrank) is recomputed
        kept.end - kept.start <= visible.end - visible.start + 2 * overscan
    ) {
        return sameRange(previous.visible, visible) &&
            sameRange(previous.rendered, kept)
            ? previous
            : { visible, rendered: kept };
    }
    return { visible, rendered: withOverscan(axis, visible, overscan) };
}
