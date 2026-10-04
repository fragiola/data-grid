import { describe, expect, it } from "vitest";
import {
    type Column,
    sameRowKeys,
    sameSortColumns,
    validSortColumns,
} from "../../src";
import { holdsRow, holdsRowIn, withRow } from "../../src/model/expansion";

// The model's small rules, tested on their own: the helpers the model, the engine and React share.

describe("holdsRowIn and holdsRow", () => {
    const rows = [2, 5, 9];

    it("finds an index in a range, end excluded", () => {
        expect(holdsRowIn(rows, 0, 3)).toBe(true);
        expect(holdsRowIn(rows, 3, 5)).toBe(false);
        expect(holdsRowIn(rows, 3, 6)).toBe(true);
        expect(holdsRowIn(rows, 9, 10)).toBe(true);
        expect(holdsRowIn(rows, 10, 100)).toBe(false);
        expect(holdsRowIn(rows, 6, 9)).toBe(false);
    });

    it("finds nothing in an empty range or an empty list", () => {
        expect(holdsRowIn(rows, 5, 5)).toBe(false);
        expect(holdsRowIn(rows, 6, 2)).toBe(false);
        expect(holdsRowIn([], 0, 100)).toBe(false);
    });

    it("tells whether one index is there", () => {
        expect(holdsRow(rows, 5)).toBe(true);
        expect(holdsRow(rows, 0)).toBe(false);
        expect(holdsRow(rows, 4)).toBe(false);
        expect(holdsRow(rows, 9)).toBe(true);
        expect(holdsRow(rows, 10)).toBe(false);
        expect(holdsRow([], 0)).toBe(false);
    });

    it("adds an index in its place", () => {
        expect(withRow(rows, 0)).toEqual([0, 2, 5, 9]);
        expect(withRow(rows, 6)).toEqual([2, 5, 6, 9]);
        expect(withRow(rows, 10)).toEqual([2, 5, 9, 10]);
        expect(withRow([], 3)).toEqual([3]);
        expect(rows).toEqual([2, 5, 9]);
    });
});

describe("sameRowKeys", () => {
    it("compares the keys in order", () => {
        expect(sameRowKeys([], [])).toBe(true);
        expect(sameRowKeys(["a", 1], ["a", 1])).toBe(true);
        expect(sameRowKeys(["a", 1], [1, "a"])).toBe(false);
        expect(sameRowKeys(["a"], ["a", "b"])).toBe(false);
        expect(sameRowKeys(["a", "b"], ["a"])).toBe(false);
    });

    it("compares by strict equality: a number and its text differ, 0 and -0 do not", () => {
        expect(sameRowKeys([1], ["1"])).toBe(false);
        expect(sameRowKeys([0], [-0])).toBe(true);
    });

    it("is the same list for the same array", () => {
        const keys = ["a", "b"];
        expect(sameRowKeys(keys, keys)).toBe(true);
    });
});

describe("sameSortColumns", () => {
    it("compares the columns and their directions, in order", () => {
        const sort = [
            { columnKey: "a", direction: "ascending" },
            { columnKey: "b", direction: "descending" },
        ] as const;
        expect(sameSortColumns(sort, sort)).toBe(true);
        expect(sameSortColumns([], [])).toBe(true);
        expect(
            sameSortColumns(sort, [
                { columnKey: "a", direction: "ascending" },
                { columnKey: "b", direction: "descending" },
            ]),
        ).toBe(true);
        expect(
            sameSortColumns(sort, [
                { columnKey: "a", direction: "ascending" },
                { columnKey: "b", direction: "ascending" },
            ]),
        ).toBe(false);
        expect(
            sameSortColumns(sort, [
                { columnKey: "b", direction: "descending" },
                { columnKey: "a", direction: "ascending" },
            ]),
        ).toBe(false);
        expect(sameSortColumns(sort, sort.slice(0, 1))).toBe(false);
        expect(sameSortColumns(sort.slice(0, 1), sort)).toBe(false);
    });
});

describe("validSortColumns", () => {
    const columns: Column<unknown>[] = [
        { key: "a", width: 10, sortable: true },
        { key: "b", width: 10, sortable: true },
        { key: "c", width: 10 },
    ];

    it("keeps a valid sort as the same array", () => {
        const sort = [
            { columnKey: "a", direction: "ascending" },
            { columnKey: "b", direction: "descending" },
        ] as const;
        expect(validSortColumns(columns, sort)).toBe(sort);
        const none: [] = [];
        expect(validSortColumns(columns, none)).toBe(none);
    });

    it("drops a column gone, not sortable, sorted twice or without a direction", () => {
        expect(
            validSortColumns(columns, [
                { columnKey: "gone", direction: "ascending" },
                { columnKey: "c", direction: "ascending" },
                { columnKey: "a", direction: "descending" },
                { columnKey: "a", direction: "ascending" },
                // @ts-expect-error: a direction that is not one
                { columnKey: "b", direction: "up" },
            ]),
        ).toEqual([{ columnKey: "a", direction: "descending" }]);
    });

    it("counts a column sorted twice once, even when its first entry is dropped", () => {
        expect(
            validSortColumns(columns, [
                // @ts-expect-error: a direction that is not one
                { columnKey: "a", direction: "up" },
                { columnKey: "a", direction: "ascending" },
            ]),
        ).toEqual([]);
    });
});
