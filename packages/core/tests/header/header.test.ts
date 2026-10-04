import { describe, expect, it } from "vitest";
import type { ColumnOrGroup } from "../../src";
import {
    columnsError,
    headerCellsIn,
    isColumnGroup,
    layoutColumns,
} from "../../src/header/header";
import { CELLS, leaf, type Row, TREE } from "./tree";

const keysOf = (cells: readonly { key: string }[]) => cells.map((c) => c.key);

describe("laying the columns out", () => {
    it("keeps the entries as the columns, in one header row, without groups", () => {
        const flat = [leaf("a"), leaf("b")];
        const { columns, header } = layoutColumns(flat);
        expect(columns).toBe(flat);
        expect(header.depth).toBe(1);
        expect(header.rows).toHaveLength(1);
        expect(header.rows[0]).toEqual([
            {
                key: "a",
                rowIndex: -1,
                columnIndex: 0,
                columnSpan: 1,
                rowSpan: 1,
                column: flat[0],
            },
            {
                key: "b",
                rowIndex: -1,
                columnIndex: 1,
                columnSpan: 1,
                rowSpan: 1,
                column: flat[1],
            },
        ]);
        expect(header.cellAt(-1, 1)?.key).toBe("b");
        expect(header.cellAt(-2, 1)).toBeUndefined();
    });

    it("flattens the leaves in order, and gives the header as many rows as the deepest leaf needs", () => {
        const { columns, header } = layoutColumns(TREE);
        expect(columns.map((c) => c.key)).toEqual([
            "A",
            "B",
            "C",
            "D",
            "E",
            "F",
        ]);
        expect(header.depth).toBe(3);
        expect(header.rows.map(keysOf)).toEqual([
            ["A", "G1", "G3"],
            ["G2", "D", "G4"],
            ["B", "C", "E", "F"],
        ]);
    });

    it("spans a group over its columns, and a shallow column down to the last header row", () => {
        const { header } = layoutColumns(TREE);
        const cells = header.rows.flat();
        const span = (key: string) => {
            const cell = cells.find((c) => c.key === key);
            return (
                cell && {
                    rowIndex: cell.rowIndex,
                    columnIndex: cell.columnIndex,
                    columnSpan: cell.columnSpan,
                    rowSpan: cell.rowSpan,
                    group: cell.group !== undefined,
                }
            );
        };
        expect(span("A")).toEqual({
            ...CELLS.A,
            columnSpan: 1,
            rowSpan: 3,
            group: false,
        });
        expect(span("G1")).toEqual({
            ...CELLS.G1,
            columnSpan: 3,
            rowSpan: 1,
            group: true,
        });
        expect(span("G2")).toEqual({
            ...CELLS.G2,
            columnSpan: 2,
            rowSpan: 1,
            group: true,
        });
        expect(span("D")).toEqual({
            ...CELLS.D,
            columnSpan: 1,
            rowSpan: 2,
            group: false,
        });
        expect(span("G3")).toEqual({
            ...CELLS.G3,
            columnSpan: 2,
            rowSpan: 1,
            group: true,
        });
        expect(span("G4")).toEqual({
            ...CELLS.G4,
            columnSpan: 2,
            rowSpan: 1,
            group: true,
        });
        expect(span("F")).toEqual({
            ...CELLS.F,
            columnSpan: 1,
            rowSpan: 1,
            group: false,
        });
    });

    it("finds the cell covering every header position", () => {
        const { header } = layoutColumns(TREE);
        const grid = [-3, -2, -1].map((rowIndex) =>
            [0, 1, 2, 3, 4, 5].map(
                (columnIndex) => header.cellAt(rowIndex, columnIndex)?.key,
            ),
        );
        expect(grid).toEqual([
            ["A", "G1", "G1", "G1", "G3", "G3"],
            ["A", "G2", "G2", "D", "G4", "G4"],
            ["A", "B", "C", "D", "E", "F"],
        ]);
        expect(header.cellAt(0, 0)).toBeUndefined();
        expect(header.cellAt(-4, 0)).toBeUndefined();
        expect(header.cellAt(-1, 6)).toBeUndefined();
    });

    it("lays out malformed children as an empty group, without throwing", () => {
        const malformed = JSON.parse(
            '[{ "key": "g", "children": null }, { "key": "a", "width": 10 }]',
        );
        const { columns, header } = layoutColumns<Row, unknown>(malformed);
        expect(columns.map((c) => c.key)).toEqual(["a"]);
        expect(header.rows.map(keysOf)).toEqual([["a"]]);
        expect(columnsError(malformed)).toMatch(/not an array/);
    });

    it("tells a group from a column", () => {
        expect(TREE.map(isColumnGroup)).toEqual([false, true, true]);
    });

    it("never loops on a group inside itself, and gives an empty group no cell", () => {
        const loop: { key: string; children: ColumnOrGroup<Row>[] } = {
            key: "loop",
            children: [leaf("x")],
        };
        loop.children.push(loop);
        const { columns, header } = layoutColumns<Row, unknown>([
            loop,
            { key: "empty", children: [] },
            leaf("y"),
        ]);
        expect(columns.map((c) => c.key)).toEqual(["x", "y"]);
        expect(header.rows.map(keysOf)).toEqual([["loop", "y"], ["x"]]);
    });
});

describe("validating the columns", () => {
    it("accepts columns, and groups of them nested to any depth", () => {
        expect(columnsError(TREE)).toBeNull();
        expect(columnsError([])).toBeNull();
    });

    it("refuses a key used twice, across groups and columns", () => {
        expect(columnsError([leaf("a"), leaf("a")])).toMatch(/"a"/);
        expect(columnsError([{ key: "a", children: [leaf("a")] }])).toMatch(
            /"a"/,
        );
        expect(
            columnsError([
                { key: "g", children: [leaf("x")] },
                { key: "h", children: [{ key: "g", children: [leaf("y")] }] },
            ]),
        ).toMatch(/"g"/);
    });

    it("refuses a group without a column below it", () => {
        expect(columnsError([{ key: "g", children: [] }])).toMatch(
            /"g" has no column/,
        );
        expect(
            columnsError([
                { key: "g", children: [{ key: "h", children: [] }] },
            ]),
        ).toMatch(/"h" has no column/);
    });

    it("refuses invalid widths, children that are no array, entries that are no object, and loops", () => {
        expect(columnsError([leaf("a", -1)])).toMatch(/width/);
        expect(columnsError([leaf("a", Number.NaN)])).toMatch(/width/);
        expect(columnsError([{ key: "g", children: "x" }])).toMatch(
            /not an array/,
        );
        expect(columnsError([null])).toMatch(/not an object/);
        expect(columnsError([{ width: 10 }])).toMatch(/key/);
        expect(columnsError("columns")).toMatch(/array/);
        const loop: { key: string; children: unknown[] } = {
            key: "loop",
            children: [],
        };
        loop.children.push(loop);
        // a group inside itself repeats its key
        expect(columnsError([loop])).toBe(
            'two columns or groups have the key "loop"',
        );
    });
});

describe("the header cells a column window needs", () => {
    const { header } = layoutColumns(TREE);
    const window = (start: number, end: number, extra: number | null = null) =>
        headerCellsIn(header, start, end, extra).map(keysOf);

    it("keeps a group cut on either side, and one wider than the window", () => {
        // C only: its group and its group's group are cut on both sides
        expect(window(2, 3)).toEqual([["G1"], ["G2"], ["C"]]);
        // D and E: G1 is cut on the left, G3 and G4 on the right
        expect(window(3, 5)).toEqual([["G1", "G3"], ["D", "G4"], ["E"]]);
        // inside G3: both groups are wider than the window
        expect(window(5, 6)).toEqual([["G3"], ["G4"], ["F"]]);
    });

    it("gives a spanning column to its top row only", () => {
        expect(window(0, 1)).toEqual([["A"], [], []]);
        expect(window(3, 4)).toEqual([["G1"], ["D"], []]);
    });

    it("adds the cells holding the active column, in column order", () => {
        expect(window(4, 6, 0)).toEqual([["A", "G3"], ["G4"], ["E", "F"]]);
        expect(window(4, 6, 2)).toEqual([
            ["G1", "G3"],
            ["G2", "G4"],
            ["C", "E", "F"],
        ]);
        expect(window(0, 2, 5)).toEqual([
            ["A", "G1", "G3"],
            ["G2", "G4"],
            ["B", "F"],
        ]);
        // inside the window: nothing to add
        expect(window(0, 6, 3)).toEqual(window(0, 6));
    });

    it("is empty for an empty window", () => {
        expect(window(0, 0)).toEqual([[], [], []]);
    });
});
