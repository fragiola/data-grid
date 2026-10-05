import { describe, expect, it, vi } from "vitest";
import {
    clamp,
    indexAfterMove,
    isIndex,
    keptIfSame,
    keySet,
    lowerBound,
    memo,
    sameList,
    toggledKey,
} from "../src/utils";

// The helpers the core's modules share (Epic #62).

describe("shared helpers", () => {
    it("clamps, the upper bound winning when they cross", () => {
        expect(clamp(5, 0, 10)).toBe(5);
        expect(clamp(-1, 0, 10)).toBe(0);
        expect(clamp(11, 0, 10)).toBe(10);
        expect(clamp(5, 0, -1)).toBe(-1);
    });

    it("tells an index: a whole number from 0, below the count", () => {
        expect(isIndex(0)).toBe(true);
        expect(isIndex(3, 4)).toBe(true);
        expect(isIndex(4, 4)).toBe(false);
        expect(isIndex(-1)).toBe(false);
        expect(isIndex(1.5)).toBe(false);
        expect(isIndex(Number.NaN)).toBe(false);
        expect(isIndex(Number.POSITIVE_INFINITY)).toBe(false);
    });

    it("compares lists item by item, the same array without a look", () => {
        const same = vi.fn((a: number, b: number | undefined) => a === b);
        const list = [1, 2];
        expect(sameList(list, list, same)).toBe(true);
        expect(same).not.toHaveBeenCalled();
        expect(sameList([1, 2], [1, 2], same)).toBe(true);
        expect(sameList([1, 2], [2, 1], same)).toBe(false);
        expect(sameList([1], [1, 2], same)).toBe(false);
        expect(sameList([Number.NaN], [Number.NaN], Object.is)).toBe(true);
    });

    it("finds the first item a predicate is false for", () => {
        const items = [1, 3, 3, 7];
        const from = (value: number) =>
            lowerBound(items.length, (i) => (items[i] ?? 0) < value);
        expect(from(0)).toBe(0);
        expect(from(3)).toBe(1);
        expect(from(4)).toBe(3);
        expect(from(8)).toBe(4);
        expect(lowerBound(0, () => true)).toBe(0);
    });

    it("computes again only when an argument changes", () => {
        const compute = vi.fn((a: object, b: number) => ({ a, b }));
        const cached = memo(compute);
        const key = {};
        const first = cached(key, 1);
        expect(cached(key, 1)).toBe(first);
        expect(compute).toHaveBeenCalledTimes(1);
        expect(cached({}, 1)).not.toBe(first);
        expect(cached(key, Number.NaN)).toBe(cached(key, Number.NaN));
        expect(compute).toHaveBeenCalledTimes(3);
    });

    it("keeps one set per key list", () => {
        const keys = ["a", 1];
        expect(keySet(keys)).toBe(keySet(keys));
        expect(keySet(keys).has(1)).toBe(true);
        expect(keySet(["a", 1])).not.toBe(keySet(keys));
    });

    it("toggles a key: removed when there, else added last (alone when single)", () => {
        expect(toggledKey(["a", "b"], "a")).toEqual(["b"]);
        expect(toggledKey(["a", "b"], "c")).toEqual(["a", "b", "c"]);
        expect(toggledKey(["a", "b"], "c", true)).toEqual(["c"]);
        expect(toggledKey(["a", "b"], "b", true)).toEqual(["a"]);
    });
});

describe("indexAfterMove", () => {
    it("is where an item goes once another one moved", () => {
        // 2 moved to 5: 3–5 up one
        expect(
            [0, 1, 2, 3, 4, 5, 6].map((i) => indexAfterMove(i, 2, 5)),
        ).toEqual([0, 1, 5, 2, 3, 4, 6]);
        // 5 moved to 2: 2–4 down one
        expect(
            [0, 1, 2, 3, 4, 5, 6].map((i) => indexAfterMove(i, 5, 2)),
        ).toEqual([0, 1, 3, 4, 5, 2, 6]);
        expect(indexAfterMove(3, 3, 3)).toBe(3);
    });
});

describe("keptIfSame", () => {
    it("keeps the current object while every field is the same", () => {
        const current = { a: 1, b: null };
        expect(keptIfSame(current, { a: 1, b: null })).toBe(current);
        const next = { a: 2, b: null };
        expect(keptIfSame(current, next)).toBe(next);
        expect(keptIfSame(null, next)).toBe(next);
    });
});
