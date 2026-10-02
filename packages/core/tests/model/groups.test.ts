import { describe, expect, it } from "vitest";
import { createDataGridModel } from "../../src";
import { CELLS, leaf, type Row, TREE } from "../header/tree";

// Column groups in the model (Epic #13, G1–G4): the leaves are the grid's columns, the header has
// a row per level, and a header cell's position is its top row and its first column.

const rows: Row[] = Array.from({ length: 10 }, (_, id) => ({ id }));

function grouped(headerRowHeight?: number) {
    return createDataGridModel<Row>({ columns: TREE, rows, headerRowHeight });
}

describe("columns with groups", () => {
    it("reads the leaves as the columns, the entries as declared, and the header", () => {
        const model = grouped();
        expect(model.get("columns").map((c) => c.key)).toEqual([
            "A",
            "B",
            "C",
            "D",
            "E",
            "F",
        ]);
        expect(model.get("column-count")).toBe(6);
        expect(model.get("column-entries")).toBe(TREE);
        expect(model.get("header-depth")).toBe(3);
        expect(model.get("header-row-count")).toBe(3);
        expect(model.get("header-rows").map((row) => row.length)).toEqual([
            3, 3, 4,
        ]);
        expect(
            model.get("header-cell-by", { rowIndex: -1, columnIndex: 3 })?.key,
        ).toBe("D");
        expect(
            model.get("header-cell-by", { rowIndex: -3, columnIndex: 2 })?.key,
        ).toBe("G1");
        expect(
            model.get("header-cell-by", { rowIndex: 0, columnIndex: 0 }),
        ).toBeUndefined();
        expect(
            model.get("header-cell-by", { rowIndex: -4, columnIndex: 0 }),
        ).toBeUndefined();
        // the body still reads by the leaves
        expect(model.get("column-by", { key: "D" })?.key).toBe("D");
        expect(model.get("column-by", { key: "G1" })).toBeUndefined();
    });

    it("has no header rows without a header, and keeps the depth", () => {
        const model = grouped(0);
        expect(model.get("header-row-count")).toBe(0);
        expect(model.get("header-depth")).toBe(3);
        expect(
            model.get("header-cell-by", { rowIndex: -1, columnIndex: 0 }),
        ).toBeUndefined();
        expect(
            model.run("active-position.set", { rowIndex: -1, columnIndex: 0 })
                .ok,
        ).toBe(false);
    });

    it("keeps the very array of columns without groups", () => {
        const flat = [leaf("a"), leaf("b")];
        const model = createDataGridModel<Row>({ columns: flat, rows });
        expect(model.get("columns")).toBe(flat);
        expect(model.get("column-entries")).toBe(flat);
        expect(model.get("header-depth")).toBe(1);
        expect(model.get("header-row-count")).toBe(1);
        const next = [leaf("c")];
        model.run("columns.set", { columns: next });
        expect(model.get("columns")).toBe(next);
    });

    it("sets groups, and refuses a key used by a group and a column", () => {
        const model = createDataGridModel<Row>({ columns: [leaf("a")], rows });
        expect(model.run("columns.set", { columns: TREE })).toEqual({
            ok: true,
            value: { columnCount: 6 },
        });
        expect(model.get("header-row-count")).toBe(3);
        const before = model.state;
        const result = model.run("columns.set", {
            columns: [{ key: "x", children: [leaf("x")] }],
        });
        expect(result.ok).toBe(false);
        expect(!result.ok && result.error.code).toBe("invalid_payload");
        expect(model.state).toBe(before);
        expect(
            model.run("columns.set", { columns: [{ key: "g", children: [] }] })
                .ok,
        ).toBe(false);
    });
});

describe("the active header cell", () => {
    it("activates a header cell from anywhere in its span, at its first column", () => {
        const model = grouped();
        expect(
            model.run("active-position.set", { rowIndex: -3, columnIndex: 3 }),
        ).toEqual({ ok: true, value: CELLS.G1 });
        expect(model.get("active-position")).toEqual(CELLS.G1);
        expect(model.is("cell-active", { rowIndex: -3, columnIndex: 2 })).toBe(
            true,
        );
        // a column spanning header rows is active on the row it is reached on
        model.run("active-position.set", { rowIndex: -1, columnIndex: 0 });
        expect(model.get("active-position")).toEqual({
            rowIndex: -1,
            columnIndex: 0,
        });
        expect(model.is("cell-active", CELLS.A)).toBe(true);
        model.run("active-position.set", { rowIndex: -1, columnIndex: 3 });
        expect(model.is("cell-active", CELLS.D)).toBe(true);
        expect(model.is("cell-active", CELLS.G2)).toBe(false);
        expect(
            model.run("active-position.set", { rowIndex: -4, columnIndex: 0 })
                .ok,
        ).toBe(false);
    });

    it("moves up from a column to its group, and down to the group's first column in view", () => {
        const model = grouped();
        model.run("active-position.set", { rowIndex: 0, columnIndex: 2 });
        model.run("active-position.move", { direction: "up" });
        expect(model.get("active-position")).toEqual(CELLS.C);
        model.run("active-position.move", { direction: "up" });
        expect(model.get("active-position")).toEqual(CELLS.G2);
        model.run("active-position.move", { direction: "up" });
        expect(model.get("active-position")).toEqual(CELLS.G1);
        expect(
            model.run("active-position.move", {
                direction: "down",
                visibleColumns: { start: 2.5, end: 6 },
            }).ok,
        ).toBe(false);
        model.run("active-position.move", {
            direction: "down",
            visibleColumns: { start: 3, end: 6 },
        });
        expect(model.get("active-position")).toEqual(CELLS.D);
        model.run("active-position.move", { direction: "down" });
        expect(model.get("active-position")).toEqual({
            rowIndex: 0,
            columnIndex: 3,
        });
    });

    it("keeps the active cell on a header cell when the columns change shape", () => {
        const model = createDataGridModel<Row>({
            columns: ["A", "B", "C", "D", "E", "F"].map((key) => leaf(key)),
            rows,
            activePosition: { rowIndex: -1, columnIndex: 3 },
        });
        model.run("columns.set", { columns: TREE });
        // column D's header now spans two rows: still active on the last
        expect(model.get("active-position")).toEqual({
            rowIndex: -1,
            columnIndex: 3,
        });
        expect(model.is("cell-active", CELLS.D)).toBe(true);
        model.run("active-position.set", CELLS.G2);
        model.run("columns.set", {
            columns: ["A", "B", "C"].map((key) => leaf(key)),
        });
        // one header row left: the header cell of the same column
        expect(model.get("active-position")).toEqual({
            rowIndex: -1,
            columnIndex: 1,
        });
    });

    it("starts on a header cell's own position", () => {
        const model = createDataGridModel<Row>({
            columns: TREE,
            rows,
            activePosition: { rowIndex: -2, columnIndex: 5 },
        });
        expect(model.get("active-position")).toEqual(CELLS.G4);
    });
});
