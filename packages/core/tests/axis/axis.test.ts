import { describe, expect, it } from "vitest";
import { createAxis } from "../../src/axis/axis";

/** A deterministic pseudo-random size in [min, max], so property runs reproduce. */
function sizes(seed: number, min = 1, max = 80) {
    return (index: number) => {
        const x = Math.sin((index + 1) * 12.9898 + seed * 78.233) * 43758.5453;
        return min + Math.floor((x - Math.floor(x)) * (max - min + 1));
    };
}

describe("a fixed-size axis", () => {
    const axis = createAxis(100_000_000, 32);

    it("answers in O(1) for 100M items", () => {
        expect(axis.fixed).toBe(true);
        expect(axis.totalSize).toBe(3_200_000_000);
        expect(axis.offsetOf(99_999_999)).toBe(3_199_999_968);
        expect(axis.offsetOf(100_000_000)).toBe(axis.totalSize);
        expect(axis.sizeOf(5)).toBe(32);
        expect(axis.indexAt(3_199_999_999)).toBe(99_999_999);
    });

    it("clamps indexes and offsets", () => {
        expect(axis.offsetOf(-5)).toBe(0);
        expect(axis.offsetOf(200_000_000)).toBe(axis.totalSize);
        expect(axis.sizeOf(-1)).toBe(0);
        expect(axis.sizeOf(100_000_000)).toBe(0);
        expect(axis.indexAt(-100)).toBe(0);
        expect(axis.indexAt(axis.totalSize + 100)).toBe(99_999_999);
    });

    it("puts a boundary offset in the item that starts there", () => {
        expect(axis.indexAt(31.999)).toBe(0);
        expect(axis.indexAt(32)).toBe(1);
    });

    it("handles no items and zero-sized items", () => {
        const empty = createAxis(0, 32);
        expect(empty.totalSize).toBe(0);
        expect(empty.indexAt(0)).toBe(-1);
        const flat = createAxis(10, 0);
        expect(flat.totalSize).toBe(0);
        expect(flat.indexAt(5)).toBe(0);
        expect(createAxis(3, -4).totalSize).toBe(0);
        expect(createAxis(Number.NaN, 10).count).toBe(0);
    });

    it("keeps its size through a new count", () => {
        const grown = axis.withCount(10);
        expect(grown.count).toBe(10);
        expect(grown.totalSize).toBe(320);
        expect(axis.resized(3)).toBe(axis);
    });
});

describe("a variable-size axis", () => {
    it("lays items end to end", () => {
        const axis = createAxis(4, (i) => [10, 20, 0, 5][i] ?? 0);
        expect(axis.fixed).toBe(false);
        expect([0, 1, 2, 3, 4].map((i) => axis.offsetOf(i))).toEqual([
            0, 10, 30, 30, 35,
        ]);
        expect(axis.totalSize).toBe(35);
        expect(axis.sizeOf(1)).toBe(20);
        expect(axis.sizeOf(2)).toBe(0);
    });

    it("finds the item covering an offset; a zero-sized item covers none", () => {
        const axis = createAxis(4, (i) => [10, 20, 0, 5][i] ?? 0);
        expect(axis.indexAt(0)).toBe(0);
        expect(axis.indexAt(9.9)).toBe(0);
        expect(axis.indexAt(10)).toBe(1);
        expect(axis.indexAt(29)).toBe(1);
        expect(axis.indexAt(30)).toBe(3);
        expect(axis.indexAt(1000)).toBe(3);
        expect(axis.indexAt(-1)).toBe(0);
    });

    it("treats negative and non-finite sizes as 0", () => {
        const axis = createAxis(
            3,
            (i) => [-5, Number.NaN, Number.POSITIVE_INFINITY][i] ?? 0,
        );
        expect(axis.totalSize).toBe(0);
    });

    it("maps every item's offset back to it, monotonically (property)", () => {
        for (const seed of [1, 2, 3, 4, 5]) {
            const size = sizes(seed);
            const axis = createAxis(5_000, size);
            let previous = -1;
            for (let i = 0; i < axis.count; i++) {
                const offset = axis.offsetOf(i);
                expect(offset).toBeGreaterThan(previous);
                previous = offset;
                expect(axis.sizeOf(i)).toBe(size(i));
                expect(axis.indexAt(offset)).toBe(i);
                expect(axis.indexAt(offset + axis.sizeOf(i) - 0.5)).toBe(i);
                // consecutive items touch: no gap, no overlap
                expect(axis.offsetOf(i) + axis.sizeOf(i)).toBe(
                    axis.offsetOf(i + 1),
                );
            }
        }
    });

    it("keeps its offsets when the count grows, and computes only the new ones", () => {
        let calls = 0;
        const size = (index: number) => {
            calls++;
            return (index % 7) + 10;
        };
        const axis = createAxis(1_000, size);
        const before = [0, 10, 500, 999, 1_000].map((i) => axis.offsetOf(i));
        calls = 0;
        const grown = axis.withCount(1_500);
        expect(calls).toBe(500);
        expect([0, 10, 500, 999, 1_000].map((i) => grown.offsetOf(i))).toEqual(
            before,
        );
        expect(grown.count).toBe(1_500);
        expect(grown.totalSize).toBe(createAxis(1_500, size).totalSize);
        // the original axis is untouched
        expect(axis.count).toBe(1_000);
        expect(axis.offsetOf(1_000)).toBe(before[4]);
        // growing again reuses the room the buffer was given
        expect(grown.withCount(2_000).offsetOf(1_500)).toBe(grown.totalSize);
    });

    it("shrinks and grows back to the same offsets", () => {
        const size = sizes(9);
        const axis = createAxis(100, size);
        const shrunk = axis.withCount(40);
        expect(shrunk.totalSize).toBe(axis.offsetOf(40));
        expect(shrunk.indexAt(axis.totalSize)).toBe(39);
        const back = shrunk.withCount(100);
        expect(back.totalSize).toBe(axis.totalSize);
        expect(axis.withCount(100)).toBe(axis);
    });

    it("never overwrites offsets another axis reads: shrink, then grow with new sizes", () => {
        const heights = new Map<number, number>();
        const size = (index: number) => heights.get(index) ?? 10;
        const a = createAxis(10, size).withCount(20);
        const b = a.withCount(12);
        for (let i = 12; i < 20; i++) heights.set(i, 100);
        const c = b.withCount(15);
        expect(c.offsetOf(15)).toBe(120 + 3 * 100);
        // `a` still reads its own offsets
        expect(a.offsetOf(15)).toBe(150);
        expect(a.offsetOf(16)).toBe(160);
        expect(a.sizeOf(15)).toBe(10);
        // and two axes grown from the same one do not share a tail
        const d = a.withCount(25);
        const e = a.withCount(30);
        expect(d.offsetOf(20)).toBe(200);
        expect(e.offsetOf(20)).toBe(200);
        expect(d.totalSize).toBe(200 + 5 * 10);
    });

    it("rounds fractional indexes down, and reads NaN as 0, like a fixed axis", () => {
        const variable = createAxis(5, () => 10);
        const fixed = createAxis(5, 10);
        expect(variable.offsetOf(2.5)).toBe(20);
        expect(fixed.offsetOf(2.5)).toBe(25);
        expect(variable.offsetOf(Number.NaN)).toBe(0);
        expect(variable.sizeOf(2.5)).toBe(10);
        expect(variable.resized(Number.NaN).totalSize).toBe(50);
    });

    it("recomputes the offsets from a resized item on, leaving the original axis valid", () => {
        const heights = [10, 10, 10, 10];
        const axis = createAxis(4, (i) => heights[i] ?? 0);
        heights[2] = 50;
        const resized = axis.resized(2);
        expect(resized.offsetOf(3)).toBe(70);
        expect(resized.totalSize).toBe(80);
        expect(axis.offsetOf(3)).toBe(30);
        expect(axis.totalSize).toBe(40);
    });
});
