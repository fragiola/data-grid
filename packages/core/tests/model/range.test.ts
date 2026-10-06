import { describe, expect, it } from "vitest";
import {
    type CellRange,
    type Column,
    createDataGridModel,
    type DataGridModelOptions,
    veto,
} from "../../src";
import {
    inRange,
    keptRange,
    pastedRange,
    rangeEdgesOf,
    rangeText,
    sameCellRange,
    valueText,
} from "../../src/model/range";

// A range of cells (Epic #88, E4.1–E4.2): the model keeps one, between body cells, changed only
// through commands while cells are selectable; it stays inside the body when the grid's shape
// changes; on the clipboard it is TSV, and a paste lands from its first cell.

interface Row {
    id: number;
    name?: string;
}

const COLUMNS: Column<Row>[] = [
    { key: "id", width: 100 },
    { key: "name", width: 100, getValue: (row) => `n${row.id}` },
    { key: "c", width: 100, getValue: (row) => row.id * 10 },
    { key: "d", width: 100, getValue: () => ({ not: "text" }) },
];

function grid(options: DataGridModelOptions<Row> = {}) {
    return createDataGridModel<Row>({
        columns: COLUMNS,
        rows: Array.from({ length: 10 }, (_, id) => ({ id })),
        cellSelection: "range",
        ...options,
    });
}

const cell = (rowIndex: number, columnIndex: number) => ({
    rowIndex,
    columnIndex,
});
const range = (
    anchor: [number, number],
    focus: [number, number],
): CellRange => ({
    anchor: cell(...anchor),
    focus: cell(...focus),
});

describe("the selected range", () => {
    it("starts from the given range, kept inside the body, and reads through get and is", () => {
        const model = grid({ selectedRange: range([1, 1], [3, 2]) });
        expect(model.get("cell-selection")).toBe("range");
        expect(model.get("selected-range")).toEqual(range([1, 1], [3, 2]));
        expect(model.is("cell-selected", cell(2, 2))).toBe(true);
        expect(model.is("cell-selected", cell(2, 3))).toBe(false);
        expect(model.is("cell-selected", cell(0, 1))).toBe(false);
        // past the rows and columns: clamped to the last ones
        expect(
            grid({ selectedRange: range([8, 2], [50, 9]) }).state.selectedRange,
        ).toEqual(range([8, 2], [9, 3]));
        // not a range: none
        expect(
            grid({
                selectedRange: { anchor: cell(0, 0) } as unknown as CellRange,
            }).state.selectedRange,
        ).toBeNull();
    });

    it("is nothing while cells are not selectable: no range, the commands refuse", () => {
        const model = grid({
            cellSelection: undefined,
            selectedRange: range([0, 0], [1, 1]),
        });
        expect(model.get("cell-selection")).toBeUndefined();
        expect(model.get("selected-range")).toBeNull();
        expect(model.is("cell-selected", cell(0, 0))).toBe(false);
        for (const result of [
            model.run("selected-range.set", range([0, 0], [1, 1])),
            model.run("selected-range.extend", cell(1, 1)),
            model.run("selected-range.extend", { direction: "down" }),
            model.run("selected-range.select-all", {}),
        ]) {
            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.code).toBe("refused");
        }
    });

    it("set selects body cells only, its own copy, the same cells committing nothing", () => {
        const model = grid();
        const given = { anchor: { ...cell(4, 3) }, focus: { ...cell(1, 0) } };
        expect(model.run("selected-range.set", given)).toEqual({
            ok: true,
            value: range([4, 3], [1, 0]),
        });
        given.anchor.rowIndex = 9;
        expect(model.state.selectedRange).toEqual(range([4, 3], [1, 0]));
        const before = model.state;
        model.run("selected-range.set", range([4, 3], [1, 0]));
        expect(model.state).toBe(before);
        // the header, a summary row, past the columns: no body cell
        for (const corner of [
            cell(-1, 0),
            cell(10, 0),
            cell(0, 4),
            cell(0.5, 0),
        ]) {
            const result = model.run("selected-range.set", {
                anchor: cell(0, 0),
                focus: corner,
            });
            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.code).toBe("not_found");
        }
        expect(model.state).toBe(before);
    });

    it("extends from the anchor: to a cell, or a move of the focus kept in the body", () => {
        const model = grid({ activePosition: cell(2, 1) });
        // no range: from the active cell
        model.run("selected-range.extend", cell(4, 2));
        expect(model.state.selectedRange).toEqual(range([2, 1], [4, 2]));
        model.run("selected-range.extend", { direction: "right" });
        expect(model.state.selectedRange).toEqual(range([2, 1], [4, 3]));
        // at the last column: stays
        model.run("selected-range.extend", { direction: "right" });
        expect(model.state.selectedRange).toEqual(range([2, 1], [4, 3]));
        model.run("selected-range.extend", {
            direction: "page-down",
            pageSize: 3,
        });
        expect(model.state.selectedRange).toEqual(range([2, 1], [7, 3]));
        model.run("selected-range.extend", { direction: "grid-start" });
        expect(model.state.selectedRange).toEqual(range([2, 1], [0, 0]));
        // never into the header
        model.run("selected-range.extend", { direction: "up" });
        expect(model.state.selectedRange).toEqual(range([2, 1], [0, 0]));
        model.run("selected-range.extend", { direction: "grid-end" });
        expect(model.state.selectedRange).toEqual(range([2, 1], [9, 3]));
        // the active cell never moves
        expect(model.state.activePosition).toEqual(cell(2, 1));
    });

    it("extends from the cell itself without a range nor an active body cell, and refuses a move then", () => {
        const model = grid({ activePosition: cell(-1, 0) });
        const moved = model.run("selected-range.extend", { direction: "down" });
        expect(moved.ok).toBe(false);
        model.run("selected-range.extend", cell(3, 1));
        expect(model.state.selectedRange).toEqual(range([3, 1], [3, 1]));
        const bad = model.run("selected-range.extend", {
            direction: "sideways" as "up",
        });
        expect(bad.ok).toBe(false);
        if (!bad.ok) expect(bad.error.code).toBe("invalid_payload");
    });

    it("selects every body cell and clears", () => {
        const model = grid();
        expect(model.run("selected-range.select-all", {})).toEqual({
            ok: true,
            value: range([0, 0], [9, 3]),
        });
        model.run("selected-range.clear", {});
        expect(model.state.selectedRange).toBeNull();
        const before = model.state;
        model.run("selected-range.clear", {});
        expect(model.state).toBe(before);
        const empty = grid({ rows: [] });
        expect(empty.run("selected-range.select-all", {}).ok).toBe(false);
    });

    it("goes when cells stop being selectable, and keeps inside the body as rows and columns go", () => {
        const model = grid({ selectedRange: range([2, 1], [8, 3]) });
        model.run("data.set", {
            rows: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }],
        });
        expect(model.state.selectedRange).toEqual(range([2, 1], [3, 3]));
        model.run("columns.set", { columns: COLUMNS.slice(0, 2) });
        expect(model.state.selectedRange).toEqual(range([2, 1], [3, 1]));
        model.run("data.set", { rows: [] });
        expect(model.state.selectedRange).toBeNull();
        const other = grid({ selectedRange: range([0, 0], [1, 1]) });
        expect(
            other.run("cell-selection.set", { cellSelection: null }),
        ).toEqual({
            ok: true,
            value: undefined,
        });
        expect(other.state.selectedRange).toBeNull();
        const bad = other.run("cell-selection.set", {
            cellSelection: "rows" as "range",
        });
        expect(bad.ok).toBe(false);
        other.run("cell-selection.set", { cellSelection: "range" });
        expect(other.get("cell-selection")).toBe("range");
    });

    it("goes when the active cell moves off its anchor, whatever moves it", () => {
        const model = grid({ activePosition: cell(1, 1) });
        model.run("selected-range.extend", cell(3, 2));
        expect(model.state.selectedRange).toEqual(range([1, 1], [3, 2]));
        // to its anchor, or nowhere new: it stays
        model.run("active-position.set", cell(1, 1));
        model.run("sort-columns.set", { sortColumns: [] });
        expect(model.state.selectedRange).toEqual(range([1, 1], [3, 2]));
        // the app's `active-position.set` (a click, a Tab, a control taking focus)
        model.run("active-position.set", cell(2, 2));
        expect(model.state.selectedRange).toBeNull();
        model.run("selected-range.extend", cell(4, 3));
        model.run("active-position.move", { direction: "down" });
        expect(model.state.selectedRange).toBeNull();
        model.run("selected-range.extend", cell(5, 3));
        model.run("active-position.clear", {});
        expect(model.state.selectedRange).toBeNull();
        // a dry run says the same
        model.run("active-position.set", cell(0, 0));
        model.run("selected-range.extend", cell(1, 1));
        expect(model.check("active-position.set", cell(1, 1)).ok).toBe(true);
        expect(model.state.selectedRange).not.toBeNull();
    });

    it("selected whole, stays while the active cell does, and goes once it moves", () => {
        const model = grid({ activePosition: cell(4, 2) });
        model.run("selected-range.select-all", {});
        model.run("rows.changed", {});
        model.run("sort-columns.set", { sortColumns: [] });
        expect(model.state.selectedRange).toEqual(range([0, 0], [9, 3]));
        model.run("active-position.move", { direction: "left" });
        expect(model.state.selectedRange).toBeNull();
    });

    it("goes when the columns are laid out again: a new order, a group collapsed", () => {
        const model = grid({
            columns: [
                { key: "a", width: 100, reorderable: true },
                { key: "b", width: 100, reorderable: true },
                {
                    key: "g",
                    collapsible: true,
                    children: [
                        { key: "c", width: 100 },
                        { key: "d", width: 100, groupShow: "expanded" },
                    ],
                },
            ],
            activePosition: cell(1, 0),
        });
        model.run("selected-range.extend", cell(2, 3));
        model.run("column-order.move", {
            columnKey: "a",
            targetKey: "b",
            side: "after",
        });
        expect(model.state.selectedRange).toBeNull();
        model.run("selected-range.extend", cell(2, 3));
        expect(model.state.selectedRange).not.toBeNull();
        model.run("column-groups.toggle", { groupKey: "g" });
        expect(model.state.selectedRange).toBeNull();
    });

    it("goes through the middleware chain", () => {
        const model = grid();
        model.use((ctx, next) =>
            ctx.command === "selected-range.select-all" ? veto() : next(),
        );
        expect(model.run("selected-range.select-all", {}).ok).toBe(false);
        expect(model.state.selectedRange).toBeNull();
    });

    it("a cell spanning columns is selected while any of its columns is", () => {
        const model = grid({
            columns: [
                { key: "a", width: 100, colSpan: () => 3 },
                ...COLUMNS.slice(1),
            ],
            selectedRange: range([0, 2], [0, 3]),
        });
        // row 0's first cell spans columns 0–2: column 2 is in the range
        expect(model.is("cell-selected", cell(0, 0))).toBe(true);
        expect(model.is("cell-selected", cell(0, 1))).toBe(true);
        expect(model.is("cell-selected", cell(1, 3))).toBe(false);
    });
});

describe("range helpers", () => {
    it("tell the same range, a cell in it and its edges (logical, in a fixed order)", () => {
        expect(
            sameCellRange(range([0, 0], [1, 1]), range([0, 0], [1, 1])),
        ).toBe(true);
        expect(
            sameCellRange(range([0, 0], [1, 1]), range([1, 1], [0, 0])),
        ).toBe(false);
        expect(sameCellRange(null, undefined)).toBe(true);
        expect(sameCellRange(null, range([0, 0], [0, 0]))).toBe(false);
        const r = range([3, 3], [1, 1]);
        expect(inRange(r, 2, 2)).toBe(true);
        expect(inRange(r, 0, 2)).toBe(false);
        expect(inRange(r, 2, 4)).toBe(false);
        // a span from before it reaches into it
        expect(inRange(r, 2, 0, 2)).toBe(true);
        expect(inRange(null, 2, 2)).toBe(false);
        expect(rangeEdgesOf(r, 1, 1)).toBe("top start");
        expect(rangeEdgesOf(r, 1, 2)).toBe("top");
        expect(rangeEdgesOf(r, 3, 3)).toBe("bottom end");
        expect(rangeEdgesOf(r, 2, 2)).toBeUndefined();
        expect(rangeEdgesOf(r, 0, 0)).toBeUndefined();
        expect(rangeEdgesOf(range([2, 2], [2, 2]), 2, 2)).toBe(
            "top bottom start end",
        );
        // a span covering the whole range's columns
        expect(rangeEdgesOf(r, 2, 0, 5)).toBe("start end");
    });

    it("keep a range inside the body, the same object when it is", () => {
        const shape = {
            rowCount: 5,
            columns: { length: 3 },
            cellSelection: "range" as const,
        };
        const inside = range([0, 0], [4, 2]);
        expect(keptRange(shape, inside)).toBe(inside);
        expect(keptRange(shape, range([2, 1], [9, 9]))).toEqual(
            range([2, 1], [4, 2]),
        );
        expect(keptRange({ ...shape, rowCount: 0 }, inside)).toBeNull();
        expect(
            keptRange({ ...shape, cellSelection: undefined }, inside),
        ).toBeNull();
    });

    it("write values as text: strings, numbers, big integers and booleans; anything else empty", () => {
        expect(valueText("a")).toBe("a");
        expect(valueText(12.5)).toBe("12.5");
        expect(valueText(10n)).toBe("10");
        expect(valueText(false)).toBe("false");
        expect(valueText(null)).toBe("");
        expect(valueText(undefined)).toBe("");
        expect(valueText({})).toBe("");
        expect(valueText(new Date(0))).toBe("");
    });

    it("copy a range as TSV, top to bottom, through getCopyText, rows not loaded empty", () => {
        const { state } = createDataGridModel<Row>({
            columns: [
                ...COLUMNS,
                {
                    key: "e",
                    width: 100,
                    getValue: (row) => row.id,
                    getCopyText: ({ value, rowIndex, column, columnIndex }) =>
                        `${column.key}${columnIndex}:${String(value)}@${rowIndex}\tx`,
                },
            ],
            rowCount: 4,
            getRow: (index) => (index === 2 ? undefined : { id: index }),
        });
        expect(rangeText(state, range([3, 4], [1, 0]))).toBe(
            [
                '1\tn1\t10\t\t"e4:1@1\tx"',
                "\t\t\t\t",
                '3\tn3\t30\t\t"e4:3@3\tx"',
            ].join("\n"),
        );
    });

    it("copy a span's value at its first column in the range, the columns it covers empty", () => {
        const { state } = createDataGridModel<Row>({
            columns: [
                { key: "a", width: 100, getValue: () => "A" },
                {
                    key: "b",
                    width: 100,
                    getValue: () => "B",
                    colSpan: (args) => (args.type === "row" ? 2 : undefined),
                },
                { key: "c", width: 100, getValue: () => "C" },
                { key: "d", width: 100, getValue: () => "D" },
            ],
            rows: [{ id: 0 }],
        });
        expect(rangeText(state, range([0, 0], [0, 3]))).toBe("A\tB\t\tD");
        // starting on a covered column: its span's value there
        expect(rangeText(state, range([0, 2], [0, 3]))).toBe("B\tD");
    });

    it("copy a group row's cells as their values", () => {
        const { state } = createDataGridModel<Row>({
            columns: COLUMNS,
            rowCount: 2,
            getRow: (index) => ({ id: index }),
            getRowMeta: (index) =>
                index === 0
                    ? {
                          group: {
                              key: "g",
                              columnKey: "name",
                              value: "Group",
                              depth: 0,
                              childCount: 1,
                              aggregates: { c: 99 },
                          },
                      }
                    : { depth: 1 },
        });
        expect(rangeText(state, range([0, 0], [1, 2]))).toBe(
            "\tGroup\t99\n1\tn1\t10",
        );
    });

    it("land a paste from its first cell, as many cells as the values, cut at the grid's edges", () => {
        const shape = { rowCount: 5, columns: { length: 3 } };
        expect(pastedRange(shape, cell(1, 1), [["a", "b"], ["c"]])).toEqual({
            range: range([1, 1], [2, 2]),
            values: [
                ["a", "b"],
                ["c", ""],
            ],
        });
        // cut at the last row and column
        expect(
            pastedRange(shape, cell(4, 2), [
                ["a", "b"],
                ["c", "d"],
            ]),
        ).toEqual({ range: range([4, 2], [4, 2]), values: [["a"]] });
        expect(pastedRange(shape, cell(0, 0), [])).toBeNull();
        expect(pastedRange(shape, cell(-1, 0), [["a"]])).toBeNull();
    });
});
