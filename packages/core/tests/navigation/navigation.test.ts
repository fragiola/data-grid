import { describe, expect, it } from "vitest";
import { type CellPosition, layoutColumns } from "../../src";
import {
    DIRECTIONS,
    type Direction,
    type GridBounds,
    nextPosition,
    sameCell,
} from "../../src/navigation/navigation";
import { CELLS, TREE } from "../header/tree";

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

describe("moving across header rows (column groups)", () => {
    const { header } = layoutColumns(TREE);
    const grouped: GridBounds = {
        rowCount: 10,
        columnCount: 6,
        headerRowCount: 3,
        headerCellAt: header.cellAt,
    };
    const { A, G1, G2, G3, G4, B, C, D, E, F } = CELLS;
    // A spans rows -3…-1 and D rows -2…-1: they have a position on each of their rows
    const A2 = at(-2, 0);
    const A1 = at(-1, 0);
    const D1 = at(-1, 3);

    // from every header position, every direction (page moves are 5 rows)
    const MOVES: [string, CellPosition, Record<Direction, CellPosition>][] = [
        [
            "A (row -3)",
            A,
            {
                up: A,
                down: at(0, 0),
                left: A,
                right: G1,
                "row-start": A,
                "row-end": G3,
                "grid-start": A,
                "grid-end": at(9, 5),
                "page-up": A,
                "page-down": at(4, 0),
            },
        ],
        [
            "A (row -2)",
            A2,
            {
                up: A2,
                down: at(0, 0),
                left: A2,
                right: G2,
                "row-start": A2,
                "row-end": G4,
                "grid-start": A,
                "grid-end": at(9, 5),
                "page-up": A2,
                "page-down": at(4, 0),
            },
        ],
        [
            "A (row -1)",
            A1,
            {
                up: A1,
                down: at(0, 0),
                left: A1,
                right: B,
                "row-start": A1,
                "row-end": F,
                "grid-start": A,
                "grid-end": at(9, 5),
                "page-up": A1,
                "page-down": at(4, 0),
            },
        ],
        [
            "G1",
            G1,
            {
                up: G1,
                down: G2,
                left: A,
                right: G3,
                "row-start": A,
                "row-end": G3,
                "grid-start": A,
                "grid-end": at(9, 5),
                "page-up": G1,
                "page-down": at(2, 1),
            },
        ],
        [
            "G3",
            G3,
            {
                up: G3,
                down: G4,
                left: G1,
                right: G3,
                "row-start": A,
                "row-end": G3,
                "grid-start": A,
                "grid-end": at(9, 5),
                "page-up": G3,
                "page-down": at(2, 4),
            },
        ],
        [
            "G2",
            G2,
            {
                up: G1,
                down: B,
                left: A2,
                right: D,
                "row-start": A2,
                "row-end": G4,
                "grid-start": A,
                "grid-end": at(9, 5),
                "page-up": G2,
                "page-down": at(3, 1),
            },
        ],
        [
            "D (row -2)",
            D,
            {
                up: G1,
                down: at(0, 3),
                left: G2,
                right: G4,
                "row-start": A2,
                "row-end": G4,
                "grid-start": A,
                "grid-end": at(9, 5),
                "page-up": D,
                "page-down": at(4, 3),
            },
        ],
        [
            "D (row -1)",
            D1,
            {
                up: G1,
                down: at(0, 3),
                left: C,
                right: E,
                "row-start": A1,
                "row-end": F,
                "grid-start": A,
                "grid-end": at(9, 5),
                "page-up": D1,
                "page-down": at(4, 3),
            },
        ],
        [
            "G4",
            G4,
            {
                up: G3,
                down: E,
                left: D,
                right: G4,
                "row-start": A2,
                "row-end": G4,
                "grid-start": A,
                "grid-end": at(9, 5),
                "page-up": G4,
                "page-down": at(3, 4),
            },
        ],
        [
            "B",
            B,
            {
                up: G2,
                down: at(0, 1),
                left: A1,
                right: C,
                "row-start": A1,
                "row-end": F,
                "grid-start": A,
                "grid-end": at(9, 5),
                "page-up": B,
                "page-down": at(4, 1),
            },
        ],
        [
            "C",
            C,
            {
                up: G2,
                down: at(0, 2),
                left: B,
                right: D1,
                "row-start": A1,
                "row-end": F,
                "grid-start": A,
                "grid-end": at(9, 5),
                "page-up": C,
                "page-down": at(4, 2),
            },
        ],
        [
            "E",
            E,
            {
                up: G4,
                down: at(0, 4),
                left: D1,
                right: F,
                "row-start": A1,
                "row-end": F,
                "grid-start": A,
                "grid-end": at(9, 5),
                "page-up": E,
                "page-down": at(4, 4),
            },
        ],
        [
            "F",
            F,
            {
                up: G4,
                down: at(0, 5),
                left: E,
                right: F,
                "row-start": A1,
                "row-end": F,
                "grid-start": A,
                "grid-end": at(9, 5),
                "page-up": F,
                "page-down": at(4, 5),
            },
        ],
    ];

    for (const [name, from, moves] of MOVES) {
        it(`moves from ${name} in every direction`, () => {
            for (const direction of DIRECTIONS) {
                expect(
                    nextPosition(from, direction, grouped, 5),
                    `${name} ${direction}`,
                ).toEqual(moves[direction]);
            }
        });
    }

    it("goes up from the first row to the header cell above each column, on the last header row", () => {
        [A1, B, C, D1, E, F].forEach((cell, columnIndex) => {
            expect(nextPosition(at(0, columnIndex), "up", grouped)).toEqual(
                cell,
            );
        });
    });

    it("walks every header row from end to end, and back", () => {
        const walk = (from: CellPosition, direction: Direction) => {
            const seen = [from];
            for (;;) {
                const last = seen[seen.length - 1] ?? from;
                const next = nextPosition(last, direction, grouped);
                if (
                    next.rowIndex === last.rowIndex &&
                    next.columnIndex === last.columnIndex
                ) {
                    return seen;
                }
                seen.push(next);
            }
        };
        expect(walk(A, "right")).toEqual([A, G1, G3]);
        expect(walk(A2, "right")).toEqual([A2, G2, D, G4]);
        expect(walk(A1, "right")).toEqual([A1, B, C, D1, E, F]);
        expect(walk(F, "left")).toEqual([F, E, D1, C, B, A1]);
        expect(walk(G4, "left")).toEqual([G4, D, G2, A2]);
        expect(walk(G3, "left")).toEqual([G3, G1, A]);
    });

    it("goes down from a group to its first column in view", () => {
        const inView = (start: number) => ({
            ...grouped,
            visibleColumns: { start, end: 6 },
        });
        // G1 spans columns 1–3: with column 2 first in view, G2 (1–2) still holds it
        expect(nextPosition(G1, "down", inView(2))).toEqual(G2);
        expect(nextPosition(G2, "down", inView(2))).toEqual(C);
        expect(nextPosition(G1, "down", inView(3))).toEqual(D);
        expect(nextPosition(G4, "down", inView(5))).toEqual(F);
        // a view starting before the group, or after it: the group's first column
        expect(nextPosition(G4, "down", inView(0))).toEqual(E);
        expect(nextPosition(G2, "down", inView(4))).toEqual(B);
        // and so does a page down, into the body
        expect(nextPosition(G1, "page-down", inView(3), 5)).toEqual(at(2, 3));
    });

    it("moves from a position inside a span as from that cell", () => {
        // a position a middleware might give: the cell holding it moves
        expect(nextPosition(at(-3, 3), "right", grouped)).toEqual(G3);
        expect(nextPosition(at(-2, 2), "up", grouped)).toEqual(G1);
        expect(nextPosition(at(-2, 5), "left", grouped)).toEqual(D);
    });

    it("always lands on a cell's first column, inside the grid", () => {
        const starts = [
            ...MOVES.map(([, from]) => from),
            ...[0, 1, 2, 3, 4, 5].flatMap((c) => [at(0, c), at(9, c)]),
        ];
        for (const start of starts) {
            for (const direction of DIRECTIONS) {
                const next = nextPosition(start, direction, grouped, 3);
                expect(next.rowIndex).toBeGreaterThanOrEqual(-3);
                expect(next.rowIndex).toBeLessThanOrEqual(9);
                if (next.rowIndex < 0) {
                    expect(
                        header.cellAt(next.rowIndex, next.columnIndex)
                            ?.columnIndex,
                    ).toBe(next.columnIndex);
                }
            }
        }
    });

    it("goes up from a column to its group, and back down", () => {
        for (const cell of [B, E]) {
            const group = nextPosition(cell, "up", grouped);
            expect(nextPosition(group, "down", grouped)).toEqual(cell);
        }
    });

    it("tells the positions of one header cell apart from another's", () => {
        expect(sameCell(A, A1, header.cellAt)).toBe(true);
        expect(sameCell(D, D1, header.cellAt)).toBe(true);
        expect(sameCell(at(-3, 2), G1, header.cellAt)).toBe(true);
        expect(sameCell(D, G2, header.cellAt)).toBe(false);
        expect(sameCell(at(0, 3), D1, header.cellAt)).toBe(false);
        expect(sameCell(at(0, 3), at(0, 3))).toBe(true);
        // without a header layout, positions only
        expect(sameCell(A, A1)).toBe(false);
    });
});
