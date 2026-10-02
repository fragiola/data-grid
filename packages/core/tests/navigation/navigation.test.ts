import { describe, expect, it } from "vitest";
import {
    DIRECTIONS,
    type GridBounds,
    nextPosition,
} from "../../src/navigation/navigation";

const bounds: GridBounds = { rowCount: 100, columnCount: 5, headerRowCount: 1 };
const at = (rowIndex: number, columnIndex: number) => ({
    rowIndex,
    columnIndex,
});

describe("moving the active cell", () => {
    it("steps one cell with the arrows", () => {
        expect(nextPosition(at(5, 2), "up", bounds)).toEqual(at(4, 2));
        expect(nextPosition(at(5, 2), "down", bounds)).toEqual(at(6, 2));
        expect(nextPosition(at(5, 2), "left", bounds)).toEqual(at(5, 1));
        expect(nextPosition(at(5, 2), "right", bounds)).toEqual(at(5, 3));
    });

    it("stops at every edge, never wrapping", () => {
        expect(nextPosition(at(-1, 2), "up", bounds)).toEqual(at(-1, 2));
        expect(nextPosition(at(99, 2), "down", bounds)).toEqual(at(99, 2));
        expect(nextPosition(at(5, 0), "left", bounds)).toEqual(at(5, 0));
        expect(nextPosition(at(5, 4), "right", bounds)).toEqual(at(5, 4));
    });

    it("goes from the first row up into the header, and back down", () => {
        expect(nextPosition(at(0, 3), "up", bounds)).toEqual(at(-1, 3));
        expect(nextPosition(at(-1, 3), "down", bounds)).toEqual(at(0, 3));
    });

    it("has no header row to go to without one", () => {
        const flat = { ...bounds, headerRowCount: 0 };
        expect(nextPosition(at(0, 3), "up", flat)).toEqual(at(0, 3));
        expect(nextPosition(at(7, 3), "grid-start", flat)).toEqual(at(0, 0));
    });

    it("goes to the row's ends and the grid's ends", () => {
        expect(nextPosition(at(5, 2), "row-start", bounds)).toEqual(at(5, 0));
        expect(nextPosition(at(5, 2), "row-end", bounds)).toEqual(at(5, 4));
        expect(nextPosition(at(5, 2), "grid-start", bounds)).toEqual(at(-1, 0));
        expect(nextPosition(at(5, 2), "grid-end", bounds)).toEqual(at(99, 4));
    });

    it("moves a page, stopping at the boundaries; a page up never enters the header", () => {
        expect(nextPosition(at(50, 1), "page-down", bounds, 20)).toEqual(
            at(70, 1),
        );
        expect(nextPosition(at(90, 1), "page-down", bounds, 20)).toEqual(
            at(99, 1),
        );
        expect(nextPosition(at(50, 1), "page-up", bounds, 20)).toEqual(
            at(30, 1),
        );
        expect(nextPosition(at(10, 1), "page-up", bounds, 20)).toEqual(
            at(0, 1),
        );
        expect(nextPosition(at(-1, 1), "page-up", bounds, 20)).toEqual(
            at(-1, 1),
        );
        expect(nextPosition(at(-1, 1), "page-down", bounds, 20)).toEqual(
            at(19, 1),
        );
        // a page is at least one row
        expect(nextPosition(at(5, 1), "page-down", bounds, 0)).toEqual(
            at(6, 1),
        );
    });

    it("stays on the header when there are no rows", () => {
        const empty = { ...bounds, rowCount: 0 };
        for (const direction of DIRECTIONS) {
            expect(nextPosition(at(-1, 0), direction, empty).rowIndex).toBe(-1);
        }
    });
});
