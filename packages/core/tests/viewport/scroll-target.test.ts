import { describe, expect, it } from "vitest";
import { createAxis } from "../../src/axis/axis";
import { scrollTargetFor } from "../../src/viewport/scroll-target";

const rows = createAxis(100, 20);

describe("scrolling to an item", () => {
    it("does not move for an item already in view (nearest)", () => {
        expect(scrollTargetFor(rows, 5, 0, 200)).toBe(0);
    });

    it("moves as little as possible to an item above or below (nearest)", () => {
        expect(scrollTargetFor(rows, 2, 100, 200)).toBe(40);
        expect(scrollTargetFor(rows, 20, 0, 200)).toBe(220);
    });

    it("aligns to the start, centre or end", () => {
        expect(scrollTargetFor(rows, 50, 0, 200, "start")).toBe(1_000);
        expect(scrollTargetFor(rows, 50, 0, 200, "end")).toBe(820);
        expect(scrollTargetFor(rows, 50, 0, 200, "center")).toBe(910);
    });

    it("clamps to the scrollable range and to the axis", () => {
        expect(scrollTargetFor(rows, 99, 0, 200, "start")).toBe(1_800);
        expect(scrollTargetFor(rows, 0, 500, 200, "end")).toBe(0);
        expect(scrollTargetFor(rows, 500, 0, 200)).toBe(1_800);
        expect(scrollTargetFor(createAxis(0, 20), 3, 0, 200)).toBe(0);
    });

    it("shows the start of an item taller than the viewport", () => {
        const tall = createAxis(3, (i) => (i === 1 ? 500 : 20));
        expect(scrollTargetFor(tall, 1, 0, 200)).toBe(20);
    });

    it("reaches the last of 100M rows", () => {
        const many = createAxis(100_000_000, 32);
        expect(scrollTargetFor(many, 99_999_999, 0, 600)).toBe(
            100_000_000 * 32 - 600,
        );
    });
});
