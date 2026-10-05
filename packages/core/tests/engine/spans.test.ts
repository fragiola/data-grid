// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
    type ColSpanArgs,
    type Column,
    type ColumnOrGroup,
    cellBox,
    cellPart,
    cellSpan,
    columnResizerPart,
    createDataGridModel,
    headerCellBox,
    headerCellPart,
    rowColumns,
} from "../../src";
import { activeColumn, elementPosition } from "../../src/engine/view";
import { columnsError } from "../../src/header/header";
import { spanAt } from "../../src/model/spans";
import {
    cellElement,
    click,
    fakeContentWidth,
    keydown,
    mountEngine,
    type Row,
} from "./harness";
import { stateOf, viewOf, windowOf } from "./views";

// Column spans (Epic #85, E1.2): a column's `colSpan` makes a cell cover the columns after it in
// its part, its row's cells partitioning each part from its start. The view renders the spanning
// cell (one reaching into the window from the left too) and skips the covered ones; the keys land
// on a span and leave from its edge; the active position snaps to its first column.

const column = (
    key: string,
    extra: Partial<Column<Row>> = {},
): Column<Row> => ({ key, width: 100, ...extra });

/** every fifth row spans its column and the next two */
const everyFifth = ({ type, row }: ColSpanArgs<Row>) =>
    type === "row" && row.id % 5 === 0 ? 3 : undefined;

/**
 * 10 columns of 100px: c0 and c1 pinned at the start (c0 asks for 3 on row 1), c2 spans 3 on
 * every fifth row, c3 asks for 2 on every row (covered by c2's spans), c5's header spans 2, c8
 * and c9 pinned at the end (c8 asks for 5).
 */
const COLUMNS: Column<Row>[] = [
    column("c0", {
        pinned: "start",
        colSpan: ({ type, row }) => (type === "row" && row.id === 1 ? 3 : 1),
    }),
    column("c1", { pinned: "start" }),
    column("c2", { colSpan: everyFifth }),
    column("c3", { colSpan: ({ type }) => (type === "row" ? 2 : undefined) }),
    column("c4"),
    column("c5", {
        colSpan: ({ type }) => (type === "header" ? 2 : undefined),
    }),
    column("c6"),
    column("c7"),
    column("c8", { pinned: "end", colSpan: () => 5 }),
    column("c9", { pinned: "end" }),
];

const spans = (options: Parameters<typeof stateOf>[0] = {}) =>
    stateOf({ columns: COLUMNS, ...options });

describe("a body cell's span", () => {
    it("covers the columns after it, a covered column never asked", () => {
        const asked: number[] = [];
        const state = stateOf({
            columns: [
                column("a", { colSpan: () => 3 }),
                column("b", {
                    colSpan: ({ rowIndex }) => {
                        asked.push(rowIndex);
                        return 2;
                    },
                }),
                column("c"),
                column("d", { colSpan: () => 2 }),
                column("e"),
            ],
        });
        expect(spanAt(state, 0, 0)).toEqual({ columnIndex: 0, columnSpan: 3 });
        expect(spanAt(state, 0, 2)).toEqual({ columnIndex: 0, columnSpan: 3 });
        expect(spanAt(state, 0, 3)).toEqual({ columnIndex: 3, columnSpan: 2 });
        expect(spanAt(state, 0, 4)).toEqual({ columnIndex: 3, columnSpan: 2 });
        expect(asked).toEqual([]);
    });

    it("never reaches past its part nor the last column", () => {
        const state = spans();
        // c0 asks 3 on row 1: its part ends after c1
        expect(spanAt(state, 1, 0)).toEqual({ columnIndex: 0, columnSpan: 2 });
        expect(spanAt(state, 1, 2)).toEqual({ columnIndex: 2, columnSpan: 1 });
        // c8 asks 5: the end part holds 2
        expect(spanAt(state, 3, 9)).toEqual({ columnIndex: 8, columnSpan: 2 });
        // c3 asks 2 on a row c2 does not span
        expect(spanAt(state, 3, 4)).toEqual({ columnIndex: 3, columnSpan: 2 });
        expect(spanAt(state, 5, 4)).toEqual({ columnIndex: 2, columnSpan: 3 });
        expect(spanAt(state, 5, 5)).toEqual({ columnIndex: 5, columnSpan: 1 });
    });

    it("is one column for a row not loaded, an answer below 2 or not a number", () => {
        const loose = createDataGridModel<Row>({
            columns: COLUMNS,
            rowCount: 10,
            getRow: (id) => (id === 0 ? undefined : { id }),
        }).state;
        expect(spanAt(loose, 0, 3)).toEqual({ columnIndex: 3, columnSpan: 1 });
        const odd = (value: unknown) =>
            spanAt(
                stateOf({
                    columns: [
                        // the app's function may answer anything at run time
                        column("a", { colSpan: () => value as number }),
                        column("b"),
                        column("c"),
                    ],
                }),
                0,
                1,
            );
        expect(odd(Number.NaN)).toEqual({ columnIndex: 1, columnSpan: 1 });
        expect(odd(-3)).toEqual({ columnIndex: 1, columnSpan: 1 });
        expect(odd("2")).toEqual({ columnIndex: 1, columnSpan: 1 });
        expect(odd(2.7)).toEqual({ columnIndex: 0, columnSpan: 2 });
        expect(odd(Number.POSITIVE_INFINITY)).toEqual({
            columnIndex: 0,
            columnSpan: 3,
        });
    });

    it("takes a function, on columns only", () => {
        expect(columnsError(COLUMNS)).toBeNull();
        expect(columnsError([{ key: "a", width: 10, colSpan: 2 }])).toMatch(
            /colSpan that is not a function/,
        );
        expect(
            columnsError([
                { key: "g", colSpan: () => 2, children: [column("a")] },
            ]),
        ).toMatch(/group "g" has a colSpan/);
    });
});

describe("a header cell's span", () => {
    it("covers its sibling columns after it: they have no cell, but a key", () => {
        const { header } = spans();
        const row = header.rows[0] ?? [];
        expect(row.map((cell) => [cell.key, cell.columnSpan])).toEqual([
            ["c0", 1],
            ["c1", 1],
            ["c2", 1],
            ["c3", 1],
            ["c4", 1],
            ["c5", 2],
            ["c7", 1],
            // c8 asks 5 of the header too: its part holds 2
            ["c8", 2],
        ]);
        expect(header.cellAt(-1, 6)?.key).toBe("c5");
        expect(header.cellByKey("c6")).toMatchObject({
            columnIndex: 6,
            columnSpan: 1,
        });
    });

    it("stops at a group, its siblings' end and its part", () => {
        const wide = () => 9;
        const { header } = createDataGridModel<Row>({
            columns: [
                column("p", { pinned: "start", colSpan: wide }),
                column("a", { colSpan: wide }),
                column("b"),
                { key: "g", children: [column("c", { colSpan: wide })] },
                {
                    key: "h",
                    children: [column("d", { colSpan: wide }), column("e")],
                },
                column("f"),
            ],
        }).state;
        const spansOf = (key: string) => header.cellByKey(key)?.columnSpan;
        expect(spansOf("p")).toBe(1);
        expect(spansOf("a")).toBe(2);
        expect(spansOf("c")).toBe(1);
        expect(spansOf("d")).toBe(2);
        // the leaves after a span keep their rows: a shallow column spans both header rows
        expect(header.cellByKey("a")).toMatchObject({
            rowIndex: -2,
            rowSpan: 2,
        });
        expect(header.cellAt(-2, 2)?.key).toBe("a");
        expect(header.cellAt(-1, 5)?.key).toBe("d");
    });

    it("resizes its whole span, as a group, and a covered column by its own key", () => {
        const model = createDataGridModel<Row>({
            columns: [
                column("a", {
                    resizable: true,
                    colSpan: ({ type }) => (type === "header" ? 2 : undefined),
                }),
                column("b", { resizable: true, minWidth: 50 }),
                column("c"),
            ],
            rows: [{ id: 0 }],
        });
        const resizer = () => {
            const view = viewOf(model.state, { columnWindow: windowOf(0, 3) });
            const cell = view.headerRows[0]?.cells[0];
            if (!cell) throw new Error("no header cell");
            return { view, cell, part: columnResizerPart(view, cell) };
        };
        const { view, cell, part } = resizer();
        expect(cell.columnSpan).toBe(2);
        expect(headerCellPart(view, cell).state).toMatchObject({
            columnSpan: 2,
            resizable: true,
        });
        expect(part.state).toMatchObject({ width: 200, minWidth: 90 });
        expect(part.attributes["aria-valuenow"]).toBe(200);
        expect(model.get("column-width-by", { columnKey: "a" })).toBe(200);
        // the two share the change in proportion to their widths
        model.run("column-widths.resize", { columnKey: "a", width: 300 });
        expect(model.get("column-widths")).toEqual({ a: 150, b: 150 });
        expect(resizer().part.attributes["aria-valuenow"]).toBe(300);
        model.run("column-widths.resize", { columnKey: "b", width: 60 });
        expect(model.get("column-widths")).toEqual({ a: 150, b: 60 });
        expect(headerCellBox(resizer().view, cell).width).toBe(210);
    });

    it("makes a covered column resizable through the span", () => {
        const model = createDataGridModel<Row>({
            columns: [
                column("a", { colSpan: () => 2 }),
                column("b", { resizable: true }),
            ],
        });
        model.run("column-widths.resize", { columnKey: "a", width: 250 });
        expect(model.get("column-widths")).toEqual({ b: 150 });
    });

    it("keeps a covered column from moving: it has no cell among its siblings", () => {
        const model = createDataGridModel<Row>({
            columns: [
                column("a", { colSpan: () => 2, reorderable: true }),
                column("b", { reorderable: true }),
                column("c", { reorderable: true }),
            ],
        });
        const covered = model.run("column-order.move", {
            columnKey: "b",
            targetKey: "c",
            side: "after",
        });
        expect(!covered.ok && covered.error.code).toBe("refused");
        expect(
            model.run("column-order.move", {
                columnKey: "c",
                targetKey: "a",
                side: "before",
            }).ok,
        ).toBe(true);
        // the span moves whole: "a" still covers "b", right after it
        expect(model.get("columns").map((entry) => entry.key)).toEqual([
            "c",
            "a",
            "b",
        ]);
        expect(model.state.header.rows[0]?.map((cell) => cell.key)).toEqual([
            "c",
            "a",
        ]);
        expect(
            model.run("column-order.move", {
                columnKey: "a",
                targetKey: "c",
                side: "before",
            }).ok,
        ).toBe(true);
        expect(model.get("columns").map((entry) => entry.key)).toEqual([
            "a",
            "b",
            "c",
        ]);
    });
});

describe("the view", () => {
    it("has no spans without a colSpan: every row renders the columns", () => {
        const view = viewOf();
        expect(view.rowSpans).toBeNull();
        expect(rowColumns(view, 12)).toBe(view.columns);
        expect(cellSpan(view, 12, 3)).toBe(1);
        expect(
            cellPart(view, { rowIndex: 12, columnIndex: 3, loaded: true })
                .ariaColSpan,
        ).toBeUndefined();
    });

    it("renders a span in place of the columns it covers, as wide as them", () => {
        // rows 10–20, columns 2–5 rendered: row 10 spans c2–c4; c3 spans c3–c4 elsewhere
        const view = viewOf(spans(), {
            pinnedColumnCount: 2,
            pinnedWidth: 200,
            pinnedEndColumnCount: 2,
            pinnedEndWidth: 200,
        });
        expect(view.columns).toEqual([0, 1, 2, 3, 4, 8, 9]);
        expect(rowColumns(view, 10)).toEqual([0, 1, 2, 8]);
        expect(rowColumns(view, 11)).toEqual([0, 1, 2, 3, 8]);
        expect(cellSpan(view, 10, 2)).toBe(3);
        expect(cellSpan(view, 10, 8)).toBe(2);
        expect(cellBox(view, 10, 2)).toMatchObject({ width: 300 });
        expect(cellBox(view, 11, 3)).toMatchObject({ width: 200 });
        expect(cellBox(view, 11, 2).width).toBe(100);
        const part = cellPart(view, {
            rowIndex: 10,
            columnIndex: 2,
            loaded: true,
        });
        expect(part.ariaColSpan).toBe(3);
        // a span inside a pinned part is pinned, and its edge
        expect(
            cellPart(view, { rowIndex: 10, columnIndex: 8, loaded: true })
                .state,
        ).toMatchObject({ pinned: true, pinnedEdge: true, pinnedSide: "end" });
    });

    it("renders a span starting left of the column window", () => {
        // columns 4–7 rendered: row 10's span from c2 reaches c4, row 11's from c3 too
        const view = viewOf(spans(), { columnWindow: windowOf(4, 7) });
        expect(view.columns).toEqual([4, 5, 6]);
        expect(rowColumns(view, 10)).toEqual([2, 5, 6]);
        expect(rowColumns(view, 11)).toEqual([3, 5, 6]);
        expect(rowColumns(view, 12)).toEqual([3, 5, 6]);
        expect(cellBox(view, 10, 2)).toEqual({
            left: -200,
            width: 300,
            height: 20,
        });
    });

    it("cuts a span to the rendered columns when the columns' scroll is scaled", () => {
        const view = viewOf(spans(), {
            columnWindow: windowOf(3, 4),
            width: 500,
        });
        // c2–c4 on row 10, c3 alone rendered: cut to it
        expect(cellBox(view, 10, 2)).toMatchObject({ width: 100 });
    });

    it("makes the cell spanning the active column active", () => {
        const view = viewOf(
            spans({ activePosition: { rowIndex: 10, columnIndex: 3 } }),
        );
        const at = (columnIndex: number) =>
            cellPart(view, { rowIndex: 10, columnIndex, loaded: true });
        expect(at(2).state.active).toBe(true);
        expect(at(2).tabIndex).toBe(0);
    });
});

describe("the active position", () => {
    const model = () =>
        createDataGridModel<Row>({
            columns: COLUMNS,
            rowCount: 100,
            getRow: (id) => ({ id }),
        });

    it("snaps to a span's first column", () => {
        const grid = model();
        const set = grid.run("active-position.set", {
            rowIndex: 5,
            columnIndex: 4,
        });
        expect(set.ok && set.value).toEqual({ rowIndex: 5, columnIndex: 2 });
        expect(grid.is("cell-active", { rowIndex: 5, columnIndex: 2 })).toBe(
            true,
        );
        grid.run("active-position.set", { rowIndex: -1, columnIndex: 6 });
        expect(grid.get("active-position")).toEqual({
            rowIndex: -1,
            columnIndex: 5,
        });
    });

    it("lands on a span with the arrows, and leaves it from its edge", () => {
        const grid = model();
        const move = (direction: "left" | "right" | "up" | "down") => {
            grid.run("active-position.move", { direction });
            return grid.get("active-position");
        };
        grid.run("active-position.set", { rowIndex: 5, columnIndex: 1 });
        expect(move("right")).toEqual({ rowIndex: 5, columnIndex: 2 });
        expect(move("right")).toEqual({ rowIndex: 5, columnIndex: 5 });
        expect(move("left")).toEqual({ rowIndex: 5, columnIndex: 2 });
        expect(move("left")).toEqual({ rowIndex: 5, columnIndex: 1 });
        grid.run("active-position.set", { rowIndex: 6, columnIndex: 4 });
        // row 6: c3 spans c3–c4
        expect(grid.get("active-position")).toEqual({
            rowIndex: 6,
            columnIndex: 3,
        });
        expect(move("up")).toEqual({ rowIndex: 5, columnIndex: 2 });
        expect(move("down")).toEqual({ rowIndex: 6, columnIndex: 2 });
        // the end part: c8 spans both
        grid.run("active-position.set", { rowIndex: 6, columnIndex: 7 });
        expect(move("right")).toEqual({ rowIndex: 6, columnIndex: 8 });
        expect(move("right")).toEqual({ rowIndex: 6, columnIndex: 8 });
        grid.run("active-position.move", { direction: "row-start" });
        grid.run("active-position.move", { direction: "row-end" });
        expect(grid.get("active-position")).toEqual({
            rowIndex: 6,
            columnIndex: 8,
        });
    });
});

describe("the active position under spans that change", () => {
    /** row 0's "a" spans 2 once `wide` is set */
    function mutable() {
        const wide = { on: false };
        const grid = createDataGridModel<Row>({
            columns: [
                column("a", {
                    reorderable: true,
                    colSpan: ({ type, row }) =>
                        type === "row" && row.id === 0 && wide.on
                            ? 2
                            : undefined,
                }),
                column("b", { reorderable: true }),
                column("c", { reorderable: true }),
            ],
            rowCount: 10,
            getRow: (id) => ({ id }),
        });
        return { grid, wide };
    }

    it("snaps when the active row's new data spans over its column", () => {
        const { grid, wide } = mutable();
        grid.run("active-position.set", { rowIndex: 0, columnIndex: 1 });
        wide.on = true;
        // another row changed: nothing asked
        grid.run("rows.changed", { start: 3, end: 4 });
        expect(grid.get("active-position")).toEqual({
            rowIndex: 0,
            columnIndex: 1,
        });
        // the active cell is the span's all the same
        expect(grid.is("cell-active", { rowIndex: 0, columnIndex: 0 })).toBe(
            true,
        );
        grid.run("rows.changed", { start: 0, end: 1 });
        expect(grid.get("active-position")).toEqual({
            rowIndex: 0,
            columnIndex: 0,
        });
        expect(grid.is("cell-active", { rowIndex: 0, columnIndex: 1 })).toBe(
            true,
        );
        expect(grid.is("cell-active", { rowIndex: 0, columnIndex: 2 })).toBe(
            false,
        );
        expect(grid.is("cell-active", { rowIndex: 1, columnIndex: 0 })).toBe(
            false,
        );
    });

    it("snaps when a new order puts its column under a span", () => {
        const { grid, wide } = mutable();
        wide.on = true;
        grid.run("active-position.set", { rowIndex: 0, columnIndex: 2 });
        grid.run("column-order.move", {
            columnKey: "c",
            targetKey: "b",
            side: "before",
        });
        // "c" right after "a": covered
        expect(grid.get("active-position")).toEqual({
            rowIndex: 0,
            columnIndex: 0,
        });
    });

    it("finds a covered position's element at the span's first column", () => {
        const { grid, wide } = mutable();
        wide.on = true;
        expect(
            elementPosition({ rowIndex: 0, columnIndex: 1 }, grid.state),
        ).toEqual({
            rowIndex: 0,
            columnIndex: 0,
        });
        const plain = { rowIndex: 1, columnIndex: 1 };
        expect(elementPosition(plain, grid.state)).toBe(plain);
    });

    it("renders no extra column for an active span reaching into the window", () => {
        // row 10 spans c2–c4: rendered with the window 4–7, active on its first column
        const state = spans({
            activePosition: { rowIndex: 10, columnIndex: 2 },
        });
        const view = viewOf(state, { columnWindow: windowOf(4, 7) });
        expect(view.columns).toEqual([4, 5, 6]);
        expect(rowColumns(view, 10)).toEqual([2, 5, 6]);
        expect(
            activeColumn(
                state.activePosition,
                state.header,
                0,
                { start: 4, end: 7 },
                10,
                {
                    columnIndex: 2,
                    columnSpan: 3,
                },
            ),
        ).toBeNull();
        // out of the window, its column is rendered
        expect(viewOf(state, { columnWindow: windowOf(5, 8) }).columns).toEqual(
            [2, 5, 6, 7],
        );
    });
});

describe("the engine", () => {
    /** 12 columns of 100px, c1 spans 3 on every fifth row; 400px wide */
    const WIDE: Column<Row>[] = Array.from({ length: 12 }, (_, i) =>
        column(`c${i}`, i === 1 ? { colSpan: everyFifth } : {}),
    );

    it("moves focus to the spanning cell, and a click activates its first column", () => {
        const { engine, model, body, commit } = mountEngine(
            { columns: WIDE, rowCount: 100 },
            { layers: ["body"] },
        );
        const span = cellElement(body, 5, 1);
        const after = cellElement(body, 5, 4);
        cellElement(body, 5, 0);
        model.run("active-position.set", { rowIndex: 5, columnIndex: 0 });
        commit();
        keydown(engine, cellElement(body, 5, 0), "ArrowRight");
        commit();
        expect(model.get("active-position")).toEqual({
            rowIndex: 5,
            columnIndex: 1,
        });
        expect(document.activeElement).toBe(span);
        keydown(engine, span, "ArrowRight");
        commit();
        expect(model.get("active-position")).toEqual({
            rowIndex: 5,
            columnIndex: 4,
        });
        expect(document.activeElement).toBe(after);
        span.focus();
        click(engine, span);
        expect(model.get("active-position")).toEqual({
            rowIndex: 5,
            columnIndex: 1,
        });
    });

    it("focuses the span when the active row's new data covers the active column", () => {
        const wide = { on: false };
        const columns = WIDE.map((entry, i) =>
            i === 1
                ? column("c1", {
                      colSpan: ({ type, row }) =>
                          type === "row" && row.id === 5 && wide.on
                              ? 3
                              : undefined,
                  })
                : entry,
        );
        const { model, body, commit } = mountEngine(
            { columns, rowCount: 100 },
            { layers: ["body"] },
        );
        const covered = cellElement(body, 5, 2);
        const span = cellElement(body, 5, 1);
        model.run("active-position.set", { rowIndex: 5, columnIndex: 2 });
        commit();
        covered.focus();
        wide.on = true;
        model.run("rows.changed", { start: 5, end: 6 });
        // the app renders the span: the covered cell is gone
        covered.remove();
        commit();
        expect(model.get("active-position")).toEqual({
            rowIndex: 5,
            columnIndex: 1,
        });
        expect(document.activeElement).toBe(span);
    });

    it("scrolls a span into view only when none of its columns is", () => {
        const { engine, model, scroll, viewport, commit } = mountEngine(
            { columns: WIDE, rowCount: 100 },
            { clamp: true, width: 400 },
        );
        viewport.scrollLeft = 300;
        viewport.dispatchEvent(new Event("scroll"));
        commit();
        // c3 in view: the span c1–c3 is
        model.run("active-position.set", { rowIndex: 5, columnIndex: 1 });
        commit();
        expect(scroll.left).toBe(300);
        viewport.scrollLeft = 800;
        viewport.dispatchEvent(new Event("scroll"));
        commit();
        model.run("active-position.set", { rowIndex: 4, columnIndex: 9 });
        model.run("active-position.set", { rowIndex: 5, columnIndex: 2 });
        commit();
        // its last column, the nearest, comes into view
        expect(scroll.left).toBe(300);
        expect(engine.get("column-window").visible.start).toBe(3);
    });

    it("never fits a column to a cell spanning it", () => {
        const grid = document.createElement("div");
        const columns = [
            column("a", { resizable: true, colSpan: everyFifth }),
            column("b"),
            column("c"),
        ];
        const header = cellElement(grid, -1, 0);
        fakeContentWidth(header, 80);
        const spanning = cellElement(grid, 0, 0);
        fakeContentWidth(spanning, 900);
        const plain = cellElement(grid, 1, 0);
        fakeContentWidth(plain, 120);
        const { engine, model } = mountEngine(
            { columns, rowCount: 10 },
            { grid },
        );
        engine.run("fit-columns", { columnKeys: ["a"] });
        expect(model.get("column-widths")).toEqual({ a: 120 });
    });

    it("fits each column of a header span by its key, never the spanning header cell", () => {
        const grid = document.createElement("div");
        const columns = [
            column("a", {
                resizable: true,
                colSpan: ({ type }) => (type === "header" ? 2 : undefined),
            }),
            column("b", { resizable: true }),
        ];
        fakeContentWidth(cellElement(grid, -1, 0), 900);
        fakeContentWidth(cellElement(grid, 0, 0), 70);
        fakeContentWidth(cellElement(grid, 0, 1), 130);
        const { engine, model } = mountEngine(
            { columns, rowCount: 10 },
            { grid },
        );
        engine.run("fit-columns", { columnKeys: ["a"] });
        expect(model.get("column-widths")).toEqual({ a: 70, b: 130 });
    });

    it("asks the spans of the rendered rows only, never on a scroll inside the overscan", () => {
        const colSpan = vi.fn(() => undefined);
        const { viewport, commit } = mountEngine(
            {
                columns: [column("a", { colSpan }), column("b")],
                rowCount: 1_000_000,
            },
            { height: 200 },
        );
        const asked = colSpan.mock.calls.length;
        expect(asked).toBeGreaterThan(0);
        expect(asked).toBeLessThan(40);
        viewport.scrollTop = 10;
        viewport.dispatchEvent(new Event("scroll"));
        commit();
        expect(colSpan.mock.calls.length).toBe(asked);
    });
});

describe("a grid with groups and spans", () => {
    it("lays a header span under its group", () => {
        const columns: ColumnOrGroup<Row>[] = [
            {
                key: "g",
                children: [
                    column("a", { colSpan: () => 2 }),
                    column("b"),
                    column("c"),
                ],
            },
        ];
        const { header } = createDataGridModel<Row>({ columns }).state;
        expect(header.rows[1]?.map((cell) => cell.key)).toEqual(["a", "c"]);
        expect(header.cellAt(-2, 1)?.key).toBe("g");
    });
});
