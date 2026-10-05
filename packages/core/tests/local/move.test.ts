import { describe, expect, it } from "vitest";
import { moveRow, moveShownRow, shownRowMove } from "../../src/local";

// Moving a row in memory (Epic #86, E2.3): a grid's `row-move` applied to the app's rows, its
// `toIndex` the row's index once moved; a move of the rows a filter or a page shows placed beside
// the row it lands next to on screen.

const ROWS = ["a", "b", "c", "d", "e"] as const;

describe("moveRow", () => {
    it("moves a row to its index once moved, down and up", () => {
        expect(moveRow(ROWS, 1, 3)).toEqual(["a", "c", "d", "b", "e"]);
        expect(moveRow(ROWS, 3, 0)).toEqual(["d", "a", "b", "c", "e"]);
        expect(moveRow(ROWS, 0, 4)).toEqual(["b", "c", "d", "e", "a"]);
        // a new array: the rows given stay as they are
        expect(ROWS).toEqual(["a", "b", "c", "d", "e"]);
    });

    it("gives the rows themselves back when nothing moves", () => {
        expect(moveRow(ROWS, 2, 2)).toBe(ROWS);
        expect(moveRow(ROWS, -1, 2)).toBe(ROWS);
        expect(moveRow(ROWS, 2, 5)).toBe(ROWS);
        expect(moveRow(ROWS, 1.5, 2)).toBe(ROWS);
    });
});

describe("moveShownRow", () => {
    const ALL = [0, 1, 2, 3, 4];

    it("is moveRow when every row is shown", () => {
        for (const [from, to] of [
            [1, 3],
            [3, 0],
            [0, 4],
            [4, 0],
        ] as const) {
            expect(moveShownRow(ROWS, ALL, from, to)).toEqual(
                moveRow(ROWS, from, to),
            );
        }
    });

    it("places a row of a filter's beside the row it lands next to on screen", () => {
        // "b", "d" and "e" shown
        const shown = [1, 3, 4];
        // "b" after "d": before "e"
        expect(moveShownRow(ROWS, shown, 0, 1)).toEqual([
            "a",
            "c",
            "d",
            "b",
            "e",
        ]);
        // "e" first: before "b"
        expect(moveShownRow(ROWS, shown, 2, 0)).toEqual([
            "a",
            "e",
            "b",
            "c",
            "d",
        ]);
        // "b" last: after "e"
        expect(moveShownRow(ROWS, shown, 0, 2)).toEqual([
            "a",
            "c",
            "d",
            "e",
            "b",
        ]);
        expect(shownRowMove(shown, 0, 2)).toEqual({ fromIndex: 1, toIndex: 4 });
    });

    it("tells equal rows apart by their positions", () => {
        const rows = ["x", "y", "x", "y", "x"];
        // the second page of two: the "x" at 2 and the "y" at 3, swapped
        expect(moveShownRow(rows, [2, 3], 0, 1)).toEqual([
            "x",
            "y",
            "y",
            "x",
            "x",
        ]);
        expect(shownRowMove([2, 3], 0, 1)).toEqual({
            fromIndex: 2,
            toIndex: 3,
        });
    });

    it("gives the rows back when nothing moves", () => {
        expect(moveShownRow(ROWS, [1, 3], 1, 1)).toBe(ROWS);
        expect(moveShownRow(ROWS, [1, 3], 0, 2)).toBe(ROWS);
        expect(shownRowMove([1, 3], 0, -1)).toBeNull();
    });
});
