import { describe, expect, it } from "vitest";
import type { Column } from "../../src";
import { sameSortColumns, validSortColumns } from "../../src/sorting";

// Sorting's small rules, tested on their own: what the model, the root and `/local` share.

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
