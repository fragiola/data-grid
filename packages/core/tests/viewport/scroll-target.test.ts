import { describe, expect, it } from "vitest";
import { scrollTargetForSpan } from "../../src/viewport/scroll-target";

// Rows of 20 px: 100 of them are 2000 px long, item `i` spans [i * 20, i * 20 + 20).
const TOTAL = 2_000;

describe("scrolling to a span", () => {
    it("does not move for a span already in view (nearest)", () => {
        expect(scrollTargetForSpan(100, 120, 0, 200, TOTAL)).toBe(0);
    });

    it("moves as little as possible to a span above or below (nearest)", () => {
        expect(scrollTargetForSpan(40, 60, 100, 200, TOTAL)).toBe(40);
        expect(scrollTargetForSpan(400, 420, 0, 200, TOTAL)).toBe(220);
    });

    it("aligns to the start, centre or end", () => {
        expect(scrollTargetForSpan(1_000, 1_020, 0, 200, TOTAL, "start")).toBe(
            1_000,
        );
        expect(scrollTargetForSpan(1_000, 1_020, 0, 200, TOTAL, "end")).toBe(
            820,
        );
        expect(scrollTargetForSpan(1_000, 1_020, 0, 200, TOTAL, "center")).toBe(
            910,
        );
    });

    it("clamps to the scrollable range", () => {
        expect(scrollTargetForSpan(1_980, 2_000, 0, 200, TOTAL, "start")).toBe(
            1_800,
        );
        expect(scrollTargetForSpan(0, 20, 500, 200, TOTAL, "end")).toBe(0);
        expect(scrollTargetForSpan(0, 20, 0, 200, 100)).toBe(0);
    });

    it("shows the start of a span taller than the viewport", () => {
        expect(scrollTargetForSpan(20, 520, 0, 200, 540)).toBe(20);
    });

    it("reaches the last of 100M rows", () => {
        const total = 100_000_000 * 32;
        expect(scrollTargetForSpan(total - 32, total, 0, 600, total)).toBe(
            total - 600,
        );
    });
});
