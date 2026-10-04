import { describe, expect, it } from "vitest";
import { clampPageIndex } from "../../src/local/page";

describe("clampPageIndex", () => {
    it("keeps an index inside the pages there are", () => {
        expect(clampPageIndex(1, 5, 2)).toBe(1);
        expect(clampPageIndex(2, 5, 2)).toBe(2);
        expect(clampPageIndex(3, 5, 2)).toBe(2);
        expect(clampPageIndex(-1, 5, 2)).toBe(0);
    });

    it("rounds a fractional index down", () => {
        expect(clampPageIndex(1.7, 5, 2)).toBe(1);
        expect(clampPageIndex(-0.5, 5, 2)).toBe(0);
    });

    it("is the first page without items or without a page size", () => {
        expect(clampPageIndex(4, 0, 2)).toBe(0);
        expect(clampPageIndex(4, 5, undefined)).toBe(0);
        expect(clampPageIndex(4, 5, 0)).toBe(0);
    });

    it("keeps an infinite index on the last page", () => {
        expect(clampPageIndex(Number.POSITIVE_INFINITY, 5, 2)).toBe(2);
        expect(clampPageIndex(Number.NEGATIVE_INFINITY, 5, 2)).toBe(0);
    });

    it("passes a NaN through (the pipeline never gives it one)", () => {
        expect(clampPageIndex(Number.NaN, 5, 2)).toBeNaN();
    });
});
