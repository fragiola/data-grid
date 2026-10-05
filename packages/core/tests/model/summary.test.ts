import { describe, expect, it } from "vitest";
import {
    type ColSpanArgs,
    type Column,
    createDataGridModel,
    type DataGridModelOptions,
    summaryRowAt,
    summaryRowIndex,
    summaryRowsOf,
} from "../../src";
import {
    type GridBounds,
    isRowOf,
    keptRow,
    lineRow,
    nextPosition,
    rowLine,
} from "../../src/navigation/navigation";

// Summary rows (Epic #86, E2.1): the model keeps how many there are at the top and at the bottom,
// and their row indexes extend the grid's on both sides, the header's (-depth … -1) and the
// body's (0 … rowCount - 1) untouched. The keys move through them top to bottom (by line).

interface Row {
    id: number;
}

const column = (
    key: string,
    extra: Partial<Column<Row>> = {},
): Column<Row> => ({
    key,
    width: 100,
    ...extra,
});

const COLUMNS = Array.from({ length: 5 }, (_, i) => column(`c${i}`));

function modelOf(options: DataGridModelOptions<Row> = {}) {
    return createDataGridModel<Row>({
        columns: COLUMNS,
        rows: Array.from({ length: 10 }, (_, id) => ({ id })),
        summaryRows: { top: 2, bottom: 1 },
        ...options,
    });
}

const at = (rowIndex: number, columnIndex: number) => ({
    rowIndex,
    columnIndex,
});

describe("the summary rows' counts", () => {
    it("start with none, and take the counts given (a count left out is 0)", () => {
        expect(
            createDataGridModel<Row>({ columns: COLUMNS }).get("summary-rows"),
        ).toEqual({ top: 0, bottom: 0 });
        expect(
            createDataGridModel<Row>({
                columns: COLUMNS,
                summaryRows: { bottom: 2 },
            }).get("summary-rows"),
        ).toEqual({ top: 0, bottom: 2 });
        // counts that are not whole numbers start without summary rows
        expect(
            createDataGridModel<Row>({
                columns: COLUMNS,
                summaryRows: { top: 1.5 },
            }).get("summary-rows"),
        ).toEqual({ top: 0, bottom: 0 });
    });

    it("are replaced by summary-rows.set, which commits nothing for the same counts", () => {
        const model = modelOf();
        const events: string[] = [];
        model.subscribe(({ command }) => events.push(command));
        expect(model.run("summary-rows.set", { top: 2, bottom: 1 })).toEqual({
            ok: true,
            value: { top: 2, bottom: 1 },
        });
        expect(events).toEqual([]);
        expect(model.run("summary-rows.set", { top: 1 })).toEqual({
            ok: true,
            value: { top: 1, bottom: 0 },
        });
        expect(events).toEqual(["summary-rows.set"]);
        for (const payload of [
            { top: -1 },
            { bottom: 0.5 },
            { top: Number.NaN },
        ]) {
            expect(model.run("summary-rows.set", payload)).toMatchObject({
                ok: false,
                error: { code: "invalid_payload" },
            });
        }
    });

    it("have a height of their own, 35 by default, set with sizes.set", () => {
        const model = modelOf();
        expect(model.get("summary-row-height")).toBe(35);
        model.run("sizes.set", { summaryRowHeight: 28 });
        expect(model.get("summary-row-height")).toBe(28);
        expect(model.run("sizes.set", { summaryRowHeight: -1 })).toMatchObject({
            ok: false,
            error: { code: "invalid_payload" },
        });
        expect(
            modelOf({ summaryRowHeight: 40 }).get("summary-row-height"),
        ).toBe(40);
    });
});

describe("the summary rows' indexes", () => {
    it("put the top ones before the header's rows and the bottom ones after the body's", () => {
        const model = modelOf();
        const { state } = model;
        // one header row (-1): the top summary rows are -3 and -2, the first one first
        expect(summaryRowIndex(state, "top", 0)).toBe(-3);
        expect(summaryRowIndex(state, "top", 1)).toBe(-2);
        expect(summaryRowIndex(state, "bottom", 0)).toBe(10);
        expect(summaryRowsOf(state, "top")).toEqual([
            { rowIndex: -3, position: "top", summaryIndex: 0 },
            { rowIndex: -2, position: "top", summaryIndex: 1 },
        ]);
        expect(model.get("summary-row-by", { rowIndex: -2 })).toEqual({
            rowIndex: -2,
            position: "top",
            summaryIndex: 1,
        });
        expect(model.get("summary-row-by", { rowIndex: 10 })).toEqual({
            rowIndex: 10,
            position: "bottom",
            summaryIndex: 0,
        });
        for (const rowIndex of [-4, -1, 0, 9, 11]) {
            expect(summaryRowAt(state, rowIndex), String(rowIndex)).toBe(
                undefined,
            );
        }
    });

    it("count the header's depth, shown or not", () => {
        const grouped = modelOf({
            columns: [
                column("a"),
                { key: "g", children: [column("b"), column("c")] },
            ],
        });
        expect(summaryRowIndex(grouped.state, "top", 0)).toBe(-4);
        // without a header, its rows are no cells, and the summary rows keep their indexes
        const flat = modelOf({ headerRowHeight: 0 });
        expect(summaryRowIndex(flat.state, "top", 0)).toBe(-3);
        expect(flat.can("active-position.set", at(-1, 0))).toBe(false);
        expect(flat.can("active-position.set", at(-3, 0))).toBe(true);
    });

    it("are cells the active position can be set to, and no row beyond them is", () => {
        const model = modelOf();
        for (const rowIndex of [-3, -2, -1, 0, 9, 10]) {
            expect(model.can("active-position.set", at(rowIndex, 4))).toBe(
                true,
            );
        }
        for (const rowIndex of [-4, 11]) {
            expect(
                model.run("active-position.set", at(rowIndex, 0)),
            ).toMatchObject({ ok: false, error: { code: "not_found" } });
        }
        expect(
            modelOf({ summaryRows: undefined }).can(
                "active-position.set",
                at(10, 0),
            ),
        ).toBe(false);
    });

    it("keep the active cell on its summary row when the counts change", () => {
        const model = modelOf();
        // the first top summary row (-3) stays the first when the top ones are fewer: -2 now
        model.run("active-position.set", at(-3, 1));
        model.run("summary-rows.set", { top: 1, bottom: 1 });
        expect(model.get("active-position")).toEqual(at(-2, 1));
        // the second top one, gone: the last one left there
        model.run("summary-rows.set", { top: 2, bottom: 1 });
        model.run("active-position.set", at(-2, 1));
        model.run("summary-rows.set", { top: 1, bottom: 1 });
        expect(model.get("active-position")).toEqual(at(-2, 1));
        expect(
            model.get("summary-row-by", { rowIndex: -2 })?.summaryIndex,
        ).toBe(0);
        // none left at the top: the header's last row; at the bottom: the last body row
        model.run("summary-rows.set", { bottom: 1 });
        expect(model.get("active-position")).toEqual(at(-1, 1));
        model.run("active-position.set", at(10, 2));
        model.run("summary-rows.set", { top: 2 });
        expect(model.get("active-position")).toEqual(at(9, 2));
    });

    it("keep the active cell on its summary row when the rows change", () => {
        const model = modelOf();
        model.run("active-position.set", at(10, 2));
        model.run("data.set", { rows: [{ id: 0 }, { id: 1 }] });
        expect(model.get("active-position")).toEqual(at(2, 2));
        model.run("data.set", {
            rows: Array.from({ length: 30 }, (_, id) => ({ id })),
        });
        expect(model.get("active-position")).toEqual(at(30, 2));
        // a top one keeps its index, the rows gone
        model.run("active-position.set", at(-2, 1));
        model.run("data.set", { rows: [] });
        expect(model.get("active-position")).toEqual(at(-2, 1));
    });

    it("keep a body row in the body when the rows shrink, never on a summary row", () => {
        const model = modelOf();
        model.run("active-position.set", at(9, 3));
        model.run("data.set", { rows: [{ id: 0 }, { id: 1 }, { id: 2 }] });
        expect(model.get("active-position")).toEqual(at(2, 3));
        model.run("data.set", { rowCount: 2, getRow: (id) => ({ id }) });
        expect(model.get("active-position")).toEqual(at(1, 3));
    });

    it("keep the active cell on its summary row when the header's depth changes", () => {
        const model = modelOf();
        model.run("active-position.set", at(-3, 1));
        model.run("columns.set", {
            columns: [
                column("c0"),
                { key: "g", children: [column("c1"), column("c2")] },
            ],
        });
        // two header rows: the first top summary row is -4 now
        expect(model.get("active-position")).toEqual(at(-4, 1));
        model.run("columns.set", { columns: COLUMNS });
        expect(model.get("active-position")).toEqual(at(-3, 1));
        // a header row stays in the header: the top one gone, the one left
        model.run("columns.set", {
            columns: [
                column("c0"),
                { key: "g", children: [column("c1"), column("c2")] },
            ],
        });
        model.run("active-position.set", at(-2, 0));
        model.run("columns.set", { columns: COLUMNS });
        expect(model.get("active-position")).toEqual(at(-1, 0));
    });

    it("are drawn again, without new columns, by summary-rows.changed", () => {
        const model = modelOf();
        const events: string[] = [];
        model.subscribe(({ command }) => events.push(command));
        expect(model.run("summary-rows.changed")).toEqual({
            ok: true,
            value: 1,
        });
        expect(model.state.summaryRevision).toBe(1);
        // no summary row: nothing to tell
        const plain = modelOf({ summaryRows: {} });
        plain.subscribe(({ command }) => events.push(`plain ${command}`));
        expect(plain.run("summary-rows.changed")).toEqual({
            ok: true,
            value: 0,
        });
        expect(events).toEqual(["summary-rows.changed"]);
    });

    it("follow their column when the order changes", () => {
        const model = modelOf({
            columns: COLUMNS.map((entry) => ({ ...entry, reorderable: true })),
        });
        model.run("active-position.set", at(-3, 1));
        model.run("column-order.move", {
            columnKey: "c1",
            targetKey: "c3",
            side: "after",
        });
        expect(model.get("active-position")).toEqual(at(-3, 3));
    });
});

describe("the keys through the summary rows", () => {
    const bounds: GridBounds = {
        rowCount: 10,
        columnCount: 5,
        headerRowCount: 1,
        headerDepth: 1,
        summaryRows: { top: 2, bottom: 1 },
    };
    const move = (
        rowIndex: number,
        direction: Parameters<typeof nextPosition>[1],
    ) => nextPosition(at(rowIndex, 2), direction, bounds, 3).rowIndex;

    it("orders the rows by line: the header, the top summary rows, the body, the bottom ones", () => {
        const order = [-1, -3, -2, 0, 1, 9, 10];
        const lines = order.map((rowIndex) => rowLine(rowIndex, 1, 2));
        expect(lines).toEqual([-3, -2, -1, 0, 1, 9, 10]);
        expect(lines.map((line) => lineRow(line, 1, 2))).toEqual(order);
        // without summary rows, a row's line is its index
        for (const rowIndex of [-2, -1, 0, 5]) {
            expect(rowLine(rowIndex, 2, 0)).toBe(rowIndex);
            expect(lineRow(rowIndex, 2, 0)).toBe(rowIndex);
        }
    });

    it("moves down and up through them in that order", () => {
        expect(move(-1, "down")).toBe(-3);
        expect(move(-3, "down")).toBe(-2);
        expect(move(-2, "down")).toBe(0);
        expect(move(9, "down")).toBe(10);
        expect(move(10, "down")).toBe(10);
        expect(move(10, "up")).toBe(9);
        expect(move(0, "up")).toBe(-2);
        expect(move(-3, "up")).toBe(-1);
        expect(move(-1, "up")).toBe(-1);
    });

    it("reaches the grid's ends with Ctrl+Home and Ctrl+End", () => {
        expect(nextPosition(at(5, 2), "grid-start", bounds)).toEqual(at(-1, 0));
        expect(nextPosition(at(5, 2), "grid-end", bounds)).toEqual(at(10, 4));
        // without a header, the first top summary row is the grid's first
        expect(
            nextPosition(at(5, 2), "grid-start", {
                ...bounds,
                headerRowCount: 0,
            }),
        ).toEqual(at(-3, 0));
    });

    it("pages in the body only: the summary rows are the arrows'", () => {
        expect(move(5, "page-down")).toBe(8);
        expect(move(8, "page-down")).toBe(9);
        expect(move(10, "page-down")).toBe(10);
        expect(move(5, "page-up")).toBe(2);
        expect(move(1, "page-up")).toBe(0);
        expect(move(-2, "page-up")).toBe(-2);
        expect(move(10, "page-up")).toBe(7);
        // from the header and the top summary rows, a page down goes into the body
        expect(move(-2, "page-down")).toBe(2);
    });

    it("tells a row of the grid, and keeps a row inside it", () => {
        expect([-4, -3, -1, 0, 10, 11].map((r) => isRowOf(r, bounds))).toEqual([
            false,
            true,
            true,
            true,
            true,
            false,
        ]);
        expect(keptRow(-7, bounds)).toBe(-1);
        expect(keptRow(15, bounds)).toBe(10);
        expect(
            keptRow(0, { rowCount: 0, columnCount: 1, headerRowCount: 0 }),
        ).toBe(null);
    });
});

describe("the summary rows' spans", () => {
    const asked: ColSpanArgs<Row>[] = [];
    const spanning = modelOf({
        columns: [
            column("c0"),
            column("c1", {
                colSpan: (args) => {
                    asked.push(args);
                    return args.type === "summary" ? 3 : undefined;
                },
            }),
            column("c2"),
            column("c3"),
            column("c4"),
        ],
    });

    it("asks a column's colSpan with the summary row, and snaps the active cell to the span", () => {
        spanning.run("active-position.set", at(10, 3));
        expect(spanning.get("active-position")).toEqual(at(10, 1));
        expect(asked).toContainEqual({
            type: "summary",
            rowIndex: 10,
            position: "bottom",
            summaryIndex: 0,
        });
        expect(spanning.is("cell-active", at(10, 2))).toBe(true);
        expect(spanning.is("cell-active", at(10, 4))).toBe(false);
        // an arrow out of it leaves from its edge
        spanning.run("active-position.move", { direction: "right" });
        expect(spanning.get("active-position")).toEqual(at(10, 4));
        spanning.run("active-position.move", { direction: "left" });
        expect(spanning.get("active-position")).toEqual(at(10, 1));
        // the header's row is no summary row: a header span is the header's
        spanning.run("active-position.set", at(-1, 2));
        expect(spanning.get("active-position")).toEqual(at(-1, 2));
    });
});
