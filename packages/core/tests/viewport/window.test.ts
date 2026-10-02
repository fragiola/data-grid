import { describe, expect, it } from "vitest";
import { createAxis } from "../../src/axis/axis";
import {
    contains,
    EMPTY_WINDOW,
    sameWindow,
    visibleRange,
    windowFor,
    withOverscan,
} from "../../src/viewport/window";

const rows = createAxis(1_000, 20);

describe("the visible range", () => {
    it("covers the items intersecting the viewport, at the start, middle and end", () => {
        expect(visibleRange(rows, 0, 100)).toEqual({ start: 0, end: 5 });
        expect(visibleRange(rows, 10, 100)).toEqual({ start: 0, end: 6 });
        expect(visibleRange(rows, 10_000, 100)).toEqual({
            start: 500,
            end: 505,
        });
        expect(visibleRange(rows, 19_900, 100)).toEqual({
            start: 995,
            end: 1_000,
        });
    });

    it("stops at the content when the viewport is larger", () => {
        const few = createAxis(3, 20);
        expect(visibleRange(few, 0, 1_000)).toEqual({ start: 0, end: 3 });
    });

    it("is empty without items or without a viewport", () => {
        expect(visibleRange(createAxis(0, 20), 0, 100)).toEqual({
            start: 0,
            end: 0,
        });
        expect(visibleRange(rows, 0, 0)).toEqual({ start: 0, end: 0 });
    });

    it("works on variable sizes", () => {
        const axis = createAxis(5, (i) => [50, 10, 10, 10, 50][i] ?? 0);
        expect(visibleRange(axis, 45, 30)).toEqual({ start: 0, end: 4 });
        expect(visibleRange(axis, 60, 10)).toEqual({ start: 2, end: 3 });
    });
});

describe("the rendered range", () => {
    it("adds overscan on each side, never out of bounds", () => {
        expect(withOverscan(rows, { start: 10, end: 15 }, 3)).toEqual({
            start: 7,
            end: 18,
        });
        expect(withOverscan(rows, { start: 1, end: 5 }, 3)).toEqual({
            start: 0,
            end: 8,
        });
        expect(withOverscan(rows, { start: 995, end: 1_000 }, 3)).toEqual({
            start: 992,
            end: 1_000,
        });
        expect(withOverscan(rows, { start: 0, end: 0 }, 3)).toEqual({
            start: 0,
            end: 0,
        });
    });

    it("tells whether a range lies inside another", () => {
        expect(contains({ start: 0, end: 10 }, { start: 2, end: 5 })).toBe(
            true,
        );
        expect(contains({ start: 0, end: 10 }, { start: 8, end: 11 })).toBe(
            false,
        );
        expect(contains({ start: 5, end: 6 }, { start: 0, end: 0 })).toBe(true);
    });
});

describe("the window", () => {
    it("is the visible range and the rendered range around it", () => {
        expect(windowFor(rows, 2_000, 100, 3)).toEqual({
            visible: { start: 100, end: 105 },
            rendered: { start: 97, end: 108 },
        });
        expect(windowFor(createAxis(0, 20), 0, 100, 3)).toBe(EMPTY_WINDOW);
    });

    it("keeps the rendered range while the view stays inside it", () => {
        const first = windowFor(rows, 2_000, 100, 3);
        // two rows down: still inside [97, 108)
        const scrolled = windowFor(rows, 2_040, 100, 3, first);
        expect(scrolled.visible).toEqual({ start: 102, end: 107 });
        expect(scrolled.rendered).toBe(first.rendered);
        // nothing changed: the very same window object
        expect(windowFor(rows, 2_000, 100, 3, first)).toBe(first);
        // out of it: recomputed around the view
        const moved = windowFor(rows, 2_080, 100, 3, scrolled);
        expect(moved.rendered).toEqual({ start: 101, end: 112 });
    });

    it("recomputes a rendered range the shrunk viewport no longer needs", () => {
        const tall = windowFor(rows, 0, 400, 3);
        const short = windowFor(rows, 0, 100, 3, tall);
        expect(short.rendered).toEqual({ start: 0, end: 8 });
    });

    it("compares windows by their ranges", () => {
        const a = windowFor(rows, 0, 100, 3);
        expect(sameWindow(a, windowFor(rows, 0, 100, 3))).toBe(true);
        expect(sameWindow(a, windowFor(rows, 20, 100, 3))).toBe(false);
    });
});
