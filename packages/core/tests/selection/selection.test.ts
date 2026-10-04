import { describe, expect, it } from "vitest";
import {
    selectionStatus,
    toggledRowKeys,
    withoutRowKeys,
    withRowKeys,
} from "../../src/selection";

// The selection's extras (Epic #57, R8): answers over a list of keys the app chooses.

describe("selectionStatus", () => {
    it("tells all, some or none of the rows, and how many", () => {
        expect(selectionStatus(["a", "b"], ["b", "a", "z"])).toEqual({
            status: "all",
            count: 2,
        });
        expect(selectionStatus(["a", "b", "c"], ["b"])).toEqual({
            status: "some",
            count: 1,
        });
        expect(selectionStatus(["a"], ["z"])).toEqual({
            status: "none",
            count: 0,
        });
        expect(selectionStatus([], ["z"])).toEqual({
            status: "none",
            count: 0,
        });
    });
});

describe("key lists", () => {
    it("add keys after the selected ones, once each, and remove them", () => {
        expect(withRowKeys([3, 1], [1, 2, 2])).toEqual([3, 1, 2]);
        expect(withoutRowKeys([3, 1, 2], [1, 9])).toEqual([3, 2]);
    });

    it("toggle a list: removed when every key is selected, else added", () => {
        expect(toggledRowKeys(["x", "a"], ["a", "b"])).toEqual(["x", "a", "b"]);
        expect(toggledRowKeys(["x", "a", "b"], ["a", "b"])).toEqual(["x"]);
    });
});
