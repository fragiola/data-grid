import { describe, expect, it } from "vitest";
import { createAxis } from "../../src/axis/axis";
import {
    createScrollMapping,
    DEFAULT_MAX_SCROLL_SIZE,
    ScrollAxisState,
    sameMapping,
} from "../../src/viewport/scaling";
import { windowFor } from "../../src/viewport/window";

const ROWS = 100_000_000;
const HEIGHT = 32;
const VIEWPORT = 600;

describe("the scroll mapping", () => {
    it("is the identity when the content fits", () => {
        const mapping = createScrollMapping(10_000, VIEWPORT);
        expect(mapping.scaled).toBe(false);
        expect(mapping.physicalSize).toBe(10_000);
        for (const x of [0, 1, 4_000, 9_400]) {
            expect(mapping.toVirtual(x)).toBe(x);
            expect(mapping.toPhysical(x)).toBe(x);
        }
        // a physical scroll is whole pixels (Epic #89); a native one is read to the sub-pixel
        expect(mapping.toPhysical(1.5)).toBe(2);
        expect(mapping.toVirtual(1.5)).toBe(1.5);
        // clamped to the scrollable range
        expect(mapping.toVirtual(20_000)).toBe(9_400);
        expect(mapping.toPhysical(-5)).toBe(0);
    });

    it("is whole pixels for a fractional size, its end reachable (Epic #89)", () => {
        // a browser takes a fraction its own way: the end is the next whole pixel, the content's
        // .3 left in view
        const mapping = createScrollMapping(10_000.3, VIEWPORT);
        expect(mapping.scaled).toBe(false);
        expect(mapping.physicalSize).toBe(10_001);
        expect(mapping.maxPhysical).toBe(9_401);
        expect(mapping.maxVirtual).toBe(9_401);
        expect(mapping.toPhysical(9_400.3)).toBe(9_400);
        expect(mapping.toPhysical(20_000)).toBe(9_401);
        // scaled, the virtual end stays the content's own, the physical one whole
        const scaled = createScrollMapping(ROWS * HEIGHT + 0.3, VIEWPORT);
        expect(scaled.maxVirtual).toBe(ROWS * HEIGHT + 0.3 - VIEWPORT);
        expect(Number.isInteger(scaled.toPhysical(123_456.7))).toBe(true);
    });

    it("caps the physical size and maps the ends exactly", () => {
        const mapping = createScrollMapping(ROWS * HEIGHT, VIEWPORT);
        expect(mapping.scaled).toBe(true);
        expect(mapping.physicalSize).toBe(DEFAULT_MAX_SCROLL_SIZE);
        expect(mapping.toVirtual(0)).toBe(0);
        expect(mapping.toVirtual(mapping.maxPhysical)).toBe(mapping.maxVirtual);
        expect(mapping.toPhysical(mapping.maxVirtual)).toBe(
            mapping.maxPhysical,
        );
        // the scrollbar's end shows the last row
        const rows = createAxis(ROWS, HEIGHT);
        const last = windowFor(
            rows,
            mapping.toVirtual(mapping.maxPhysical),
            VIEWPORT,
            0,
        );
        expect(last.visible.end).toBe(ROWS);
    });

    it("maps proportionally in between, and back stably", () => {
        const mapping = createScrollMapping(ROWS * HEIGHT, VIEWPORT);
        const half = mapping.toVirtual(mapping.maxPhysical / 2);
        expect(half / mapping.maxVirtual).toBeCloseTo(0.5, 9);
        for (const physical of [1, 1234, 5_000_000, 9_999_000]) {
            const there = mapping.toPhysical(mapping.toVirtual(physical));
            expect(there).toBeCloseTo(physical, 6);
        }
    });

    it("honours a configured cap, never below the viewport", () => {
        expect(createScrollMapping(1e9, VIEWPORT, 5_000_000).physicalSize).toBe(
            5_000_000,
        );
        expect(createScrollMapping(1e9, 1_000, 10).physicalSize).toBe(2_000);
    });
});

describe("the scroll state", () => {
    const mapping = () => createScrollMapping(ROWS * HEIGHT, VIEWPORT);

    it("moves by exactly one row at any position, and keeps it through its own scroll event", () => {
        const state = new ScrollAxisState(mapping());
        const rows = createAxis(ROWS, HEIGHT);
        for (const fraction of [0, 0.1, 0.5, 0.9, 0.999]) {
            state.scrollTo(Math.round(state.mapping.maxVirtual * fraction));
            const before = state.virtual;
            const physical = state.scrollBy(HEIGHT);
            expect(state.virtual - before).toBe(HEIGHT);
            // the scroll event the container fires lands where the engine put it
            expect(state.sync(Math.round(physical))).toBe(false);
            expect(state.virtual - before).toBe(HEIGHT);
            expect(rows.indexAt(state.virtual) - rows.indexAt(before)).toBe(1);
        }
    });

    it("maps a jump it did not make proportionally", () => {
        const state = new ScrollAxisState(mapping());
        state.scrollBy(HEIGHT * 3);
        expect(state.sync(state.mapping.maxPhysical)).toBe(true);
        expect(state.virtual).toBe(state.mapping.maxVirtual);
        // and the next exact move starts from there
        state.scrollBy(-HEIGHT);
        expect(state.virtual).toBe(state.mapping.maxVirtual - HEIGHT);
    });

    it("follows the native scroll to the sub-pixel when nothing is scaled", () => {
        const state = new ScrollAxisState(
            createScrollMapping(10_000, VIEWPORT),
        );
        state.scrollTo(100);
        expect(state.sync(100.4)).toBe(true);
        expect(state.virtual).toBe(100.4);
    });

    it("holds whole pixels unscaled, its end the content's .3 past it (Epic #89)", () => {
        const state = new ScrollAxisState(
            createScrollMapping(10_000.3, VIEWPORT),
        );
        // the end: a whole pixel, reachable, the content's end in view
        expect(state.scrollTo(20_000)).toBe(9_401);
        expect(state.virtual).toBe(9_401);
        expect(state.offsetFor(9_400.3 + 1)).toBe(9_401);
        // a move to where it is, once clamped, is no move
        expect(state.offsetFor(50_000)).toBe(state.virtual);
        expect(state.scrollTo(100.4)).toBe(100);
        expect(state.virtual).toBe(100);
        // its own scroll event changes nothing
        expect(state.sync(100)).toBe(false);
    });

    it("adds a wheel's sub-pixel deltas up into whole pixels, unscaled (Epic #89)", () => {
        const state = new ScrollAxisState(
            createScrollMapping(10_000, VIEWPORT),
        );
        const written: number[] = [];
        for (let step = 0; step < 10; step++) written.push(state.scrollBy(0.3));
        // every write whole, none lost: 3px for ten deltas of 0.3
        expect(written.every(Number.isInteger)).toBe(true);
        expect(state.virtual).toBe(3);
        expect(written.at(0)).toBe(0);
        // a scroll the engine did not make starts the fractions again
        state.scrollBy(0.4);
        expect(state.sync(50)).toBe(true);
        expect(state.scrollBy(0.4)).toBe(50);
        // and at the end, nothing is kept beyond it
        state.scrollTo(9_400);
        state.scrollBy(0.6);
        expect(state.scrollBy(-0.6)).toBe(9_399);
    });

    it("keeps its virtual offset through a new mapping", () => {
        const state = new ScrollAxisState(mapping());
        state.scrollTo(1_000_000);
        const physical = state.remap(createScrollMapping(ROWS * HEIGHT, 900));
        expect(state.virtual).toBe(1_000_000);
        expect(physical).toBe(state.mapping.toPhysical(1_000_000));
    });

    it("translates the rendered layer so the virtual offset is in view", () => {
        const state = new ScrollAxisState(mapping());
        state.scrollTo(1_600_000_000);
        const physical = state.mapping.toPhysical(state.virtual);
        // a layer laid out from the first rendered row (row 49,999,990)
        const base = 49_999_990 * HEIGHT;
        const offset = state.layerOffset(base, physical);
        // row 50,000,000 sits at its layer position plus the offset, minus the scroll
        const top = 50_000_000 * HEIGHT - base + offset - physical;
        // (to well under a pixel: the doubles are ~1e9 large)
        expect(top).toBeCloseTo(50_000_000 * HEIGHT - state.virtual, 4);
    });
});

describe("variable sizes under scaling", () => {
    it("place rows exactly: consecutive rows touch at any scroll position", () => {
        const axis = createAxis(2_000_000, (i) => 20 + (i % 13));
        const mapping = createScrollMapping(axis.totalSize, VIEWPORT);
        expect(mapping.scaled).toBe(true);
        const state = new ScrollAxisState(mapping);
        state.scrollTo(mapping.maxVirtual * 0.73);
        const { rendered } = windowFor(axis, state.virtual, VIEWPORT, 3);
        const base = axis.offsetOf(rendered.start);
        for (let i = rendered.start; i < rendered.end - 1; i++) {
            const top = axis.offsetOf(i) - base;
            expect(top + axis.sizeOf(i)).toBe(axis.offsetOf(i + 1) - base);
        }
    });
});

describe("two mappings", () => {
    it("are the same when their sizes are, and differ when any size does", () => {
        const mapping = createScrollMapping(ROWS * HEIGHT, VIEWPORT);
        expect(
            sameMapping(mapping, createScrollMapping(ROWS * HEIGHT, VIEWPORT)),
        ).toBe(true);
        expect(
            sameMapping(mapping, createScrollMapping(ROWS * HEIGHT, 500)),
        ).toBe(false);
        expect(sameMapping(mapping, createScrollMapping(1_000, VIEWPORT))).toBe(
            false,
        );
        expect(
            sameMapping(
                mapping,
                createScrollMapping(ROWS * HEIGHT, VIEWPORT, 20_000_000),
            ),
        ).toBe(false);
    });
});
