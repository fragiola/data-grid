import { describe, expect, it } from "vitest";
import {
    type Column,
    type ColumnOrGroup,
    createDataGridModel,
    type DataGridModelOptions,
    veto,
} from "../../src";

// The column order (Epic #75, O1, O2, O5): the model keeps the keys in the order siblings take,
// moves a reorderable column or group among its siblings only (the pinned among the pinned), and
// lays the columns, the header and everything keyed by column out in it; the active cell follows
// its column.

interface Row {
    id: number;
}

const column = (
    key: string,
    extra: Partial<Column<Row>> = {},
): Column<Row> => ({ key, width: 100, reorderable: true, ...extra });

// "p" and "q" are pinned; "fixed" does not move; "g" (reorderable) groups "c", "d" and the fixed
// "e"; every other entry is reorderable
const COLUMNS: ColumnOrGroup<Row>[] = [
    column("p", { pinned: "start" }),
    column("q", { pinned: "start" }),
    column("a"),
    column("fixed", { reorderable: false }),
    {
        key: "g",
        reorderable: true,
        children: [
            column("c"),
            column("d", { width: 50 }),
            column("e", { reorderable: undefined }),
        ],
    },
    column("b"),
];

function grid(options: DataGridModelOptions<Row> = {}) {
    return createDataGridModel<Row>({
        columns: COLUMNS,
        rowCount: 10,
        getRow: (id) => ({ id }),
        ...options,
    });
}

const leaves = (model: ReturnType<typeof grid>) =>
    model.state.columns.map((entry) => entry.key);
const headerRows = (model: ReturnType<typeof grid>) =>
    model.state.header.rows.map((row) => row.map((cell) => cell.key));

describe("column-order.move", () => {
    it("moves a column before or after a sibling, past the ones that do not move", () => {
        const model = grid();
        expect(model.get("column-order")).toEqual([]);
        expect(leaves(model)).toEqual([
            "p",
            "q",
            "a",
            "fixed",
            "c",
            "d",
            "e",
            "b",
        ]);
        const moved = model.run("column-order.move", {
            columnKey: "a",
            targetKey: "g",
            side: "after",
        });
        expect(moved).toEqual({
            ok: true,
            value: ["p", "q", "fixed", "g", "a", "b"],
        });
        expect(model.get("column-order")).toEqual([
            "p",
            "q",
            "fixed",
            "g",
            "a",
            "b",
        ]);
        expect(leaves(model)).toEqual([
            "p",
            "q",
            "fixed",
            "c",
            "d",
            "e",
            "a",
            "b",
        ]);
        // beside a fixed sibling too
        model.run("column-order.move", {
            columnKey: "a",
            targetKey: "fixed",
            side: "before",
        });
        expect(leaves(model).slice(2, 4)).toEqual(["a", "fixed"]);
        // the app's columns stay as declared
        expect(model.get("column-entries")).toBe(COLUMNS);
    });

    it("moves a group whole, and a group's column inside it only", () => {
        const model = grid();
        model.run("column-order.move", {
            columnKey: "g",
            targetKey: "a",
            side: "before",
        });
        expect(leaves(model)).toEqual([
            "p",
            "q",
            "c",
            "d",
            "e",
            "a",
            "fixed",
            "b",
        ]);
        expect(
            model.run("column-order.move", {
                columnKey: "e",
                targetKey: "c",
                side: "before",
            }).ok,
        ).toBe(false);
        model.run("column-order.move", {
            columnKey: "c",
            targetKey: "e",
            side: "after",
        });
        expect(leaves(model)).toEqual([
            "p",
            "q",
            "d",
            "e",
            "c",
            "a",
            "fixed",
            "b",
        ]);
        expect(headerRows(model)).toEqual([
            ["p", "q", "g", "a", "fixed", "b"],
            ["d", "e", "c"],
        ]);
        // its siblings are its group's: a column outside it is none
        expect(
            model.run("column-order.move", {
                columnKey: "c",
                targetKey: "b",
                side: "after",
            }),
        ).toMatchObject({ ok: false, error: { code: "refused" } });
        expect(
            model.run("column-order.move", {
                columnKey: "g",
                targetKey: "c",
                side: "after",
            }),
        ).toMatchObject({ ok: false, error: { code: "refused" } });
    });

    it("lands the pinned among the pinned, the others among the others", () => {
        const model = grid();
        expect(
            model.run("column-order.move", {
                columnKey: "q",
                targetKey: "p",
                side: "before",
            }).ok,
        ).toBe(true);
        expect(leaves(model).slice(0, 2)).toEqual(["q", "p"]);
        // landing across the pinned columns' edge, either way
        for (const [columnKey, targetKey, side] of [
            ["q", "a", "after"],
            ["q", "fixed", "before"],
            ["a", "p", "before"],
            ["b", "q", "before"],
        ] as const) {
            expect(
                model.run("column-order.move", { columnKey, targetKey, side }),
                `${columnKey} ${side} ${targetKey}`,
            ).toMatchObject({ ok: false, error: { code: "refused" } });
        }
        expect(leaves(model).slice(0, 3)).toEqual(["q", "p", "a"]);
        // beside the first one past the edge, on its near side: the last pinned, the first not
        model.run("column-order.move", {
            columnKey: "q",
            targetKey: "a",
            side: "before",
        });
        expect(leaves(model).slice(0, 3)).toEqual(["p", "q", "a"]);
        model.run("column-order.move", {
            columnKey: "b",
            targetKey: "q",
            side: "after",
        });
        expect(leaves(model).slice(0, 4)).toEqual(["p", "q", "b", "a"]);
    });

    it("refuses what does not move, what is not there and a side that is none", () => {
        const model = grid();
        let events = 0;
        model.subscribe(() => {
            events += 1;
        });
        expect(
            model.run("column-order.move", {
                columnKey: "fixed",
                targetKey: "b",
                side: "after",
            }),
        ).toMatchObject({ ok: false, error: { code: "refused" } });
        for (const [columnKey, targetKey] of [
            ["nope", "a"],
            ["a", "nope"],
        ] as const) {
            expect(
                model.run("column-order.move", {
                    columnKey,
                    targetKey,
                    side: "before",
                }),
            ).toMatchObject({ ok: false, error: { code: "not_found" } });
        }
        expect(
            model.run("column-order.move", {
                columnKey: "a",
                targetKey: "b",
                side: "beside" as "before",
            }),
        ).toMatchObject({ ok: false, error: { code: "invalid_payload" } });
        // where it is: beside itself, or on its neighbour's near side
        for (const [targetKey, side] of [
            ["a", "before"],
            ["a", "after"],
            ["fixed", "before"],
        ] as const) {
            expect(
                model.run("column-order.move", {
                    columnKey: "a",
                    targetKey,
                    side,
                }),
                `${side} ${targetKey}`,
            ).toEqual({ ok: true, value: [] });
        }
        expect(events).toBe(0);
    });

    it("is a middleware's to refuse or to rewrite", () => {
        const model = grid();
        const stop = model.use((ctx, next) =>
            ctx.command === "column-order.move" ? veto() : next(),
        );
        const move = {
            columnKey: "a",
            targetKey: "b",
            side: "after",
        } as const;
        expect(model.run("column-order.move", move)).toMatchObject({
            ok: false,
            error: { code: "vetoed" },
        });
        expect(model.get("column-order")).toEqual([]);
        stop();
        model.use((ctx, next) => {
            if (ctx.command === "column-order.move") {
                ctx.payload = { ...ctx.payload, targetKey: "fixed" };
            }
            return next();
        });
        model.run("column-order.move", move);
        expect(leaves(model).slice(2, 4)).toEqual(["fixed", "a"]);
    });

    it("writes its siblings where the order listed the first of them, other keys kept", () => {
        // "b" and "a" swapped: "b" is at 2
        const model = grid({ columnOrder: ["gone", "d", "b", "a", "later"] });
        model.run("column-order.move", {
            columnKey: "b",
            targetKey: "a",
            side: "after",
        });
        expect(model.get("column-order")).toEqual([
            "gone",
            "d",
            "p",
            "q",
            "fixed",
            "g",
            "a",
            "b",
            "later",
        ]);
    });
});

describe("column-order.set and reset", () => {
    it("order the listed entries in the places of the listed ones, the others where they are", () => {
        const model = grid();
        const set = model.run("column-order.set", {
            columnOrder: ["missing", "b", "a", "e", "c"],
        });
        expect(set).toEqual({
            ok: true,
            value: ["missing", "b", "a", "e", "c"],
        });
        // "a" and "b" swap places; "fixed" and "g" keep theirs; in "g", "e" and "c" swap
        expect(leaves(model)).toEqual([
            "p",
            "q",
            "b",
            "fixed",
            "e",
            "d",
            "c",
            "a",
        ]);
        // a key that is no column is kept: it may come back
        expect(model.get("column-order")).toContain("missing");
    });

    it("keep the pinned columns first whatever the order says", () => {
        const model = grid();
        model.run("column-order.set", { columnOrder: ["b", "a", "q", "p"] });
        expect(leaves(model)).toEqual([
            "q",
            "p",
            "b",
            "fixed",
            "c",
            "d",
            "e",
            "a",
        ]);
    });

    it("refuse what is not a list of keys, each once", () => {
        const model = grid();
        for (const columnOrder of [
            ["a", "a"],
            ["a", 1],
            "a",
            null,
        ] as unknown as string[][]) {
            expect(
                model.run("column-order.set", { columnOrder }),
            ).toMatchObject({ ok: false, error: { code: "invalid_payload" } });
        }
    });

    it("commit nothing for the same order; reset gives the declared one back", () => {
        const model = grid({ columnOrder: ["b", "a"] });
        let events = 0;
        model.subscribe(() => {
            events += 1;
        });
        const before = model.state;
        model.run("column-order.set", { columnOrder: ["b", "a"] });
        expect(model.state).toBe(before);
        expect(model.run("column-order.reset")).toEqual({
            ok: true,
            value: [],
        });
        expect(leaves(model)).toEqual([
            "p",
            "q",
            "a",
            "fixed",
            "c",
            "d",
            "e",
            "b",
        ]);
        model.run("column-order.reset");
        expect(events).toBe(1);
    });

    it("start from an option, its keys each once, what is not a key dropped", () => {
        const model = grid({
            columnOrder: ["b", 3, "a", "b"] as unknown as string[],
        });
        expect(model.get("column-order")).toEqual(["b", "a"]);
        expect(leaves(model).at(-1)).toBe("a");
    });
});

describe("the ordered layout", () => {
    it("lays the header out in it, and keyed state follows: widths, the sort", () => {
        const model = grid({
            columns: [
                column("a", { sortable: true, resizable: true }),
                column("b"),
                column("c"),
            ],
            columnWidths: { a: 150 },
            sortColumns: [{ columnKey: "a", direction: "ascending" }],
        });
        model.run("column-order.move", {
            columnKey: "a",
            targetKey: "c",
            side: "after",
        });
        expect(
            model.get("header-cell-by", { rowIndex: -1, columnIndex: 2 }),
        ).toMatchObject({ key: "a", columnIndex: 2 });
        expect(model.get("column-width-by", { columnKey: "a" })).toBe(150);
        expect(model.get("sort-columns")).toEqual([
            { columnKey: "a", direction: "ascending" },
        ]);
    });

    it("stays through new columns: a new one keeps its place among the listed", () => {
        const model = grid({ columns: [column("a"), column("b")] });
        model.run("column-order.move", {
            columnKey: "a",
            targetKey: "b",
            side: "after",
        });
        model.run("columns.set", {
            columns: [column("x"), column("a"), column("b"), column("y")],
        });
        expect(leaves(model)).toEqual(["x", "b", "a", "y"]);
    });
});

describe("the active cell", () => {
    it("follows its column on a body row", () => {
        const model = grid({ activePosition: { rowIndex: 4, columnIndex: 2 } });
        model.run("column-order.move", {
            columnKey: "a",
            targetKey: "b",
            side: "after",
        });
        expect(model.get("active-position")).toEqual({
            rowIndex: 4,
            columnIndex: 7,
        });
        model.run("column-order.set", { columnOrder: ["a", "b"] });
        expect(model.get("active-position")).toEqual({
            rowIndex: 4,
            columnIndex: 2,
        });
    });

    it("follows its header cell: a group's, and a column's on any row it spans", () => {
        const model = grid({
            activePosition: { rowIndex: -2, columnIndex: 4 },
        });
        // the group "g", at its first column
        model.run("column-order.move", {
            columnKey: "g",
            targetKey: "a",
            side: "before",
        });
        expect(model.get("active-position")).toEqual({
            rowIndex: -2,
            columnIndex: 2,
        });
        // "a" spans both header rows: active on the lower one, it stays there
        model.run("active-position.set", { rowIndex: -1, columnIndex: 5 });
        model.run("column-order.move", {
            columnKey: "a",
            targetKey: "b",
            side: "after",
        });
        expect(model.get("active-position")).toEqual({
            rowIndex: -1,
            columnIndex: 7,
        });
        // a column of the group, among its siblings
        model.run("active-position.set", { rowIndex: -1, columnIndex: 2 });
        model.run("column-order.move", {
            columnKey: "c",
            targetKey: "e",
            side: "after",
        });
        expect(model.get("active-position")).toEqual({
            rowIndex: -1,
            columnIndex: 4,
        });
    });

    it("stays at its indexes through columns.set, as before", () => {
        const model = grid({ activePosition: { rowIndex: 3, columnIndex: 2 } });
        model.run("columns.set", { columns: [...COLUMNS].reverse() });
        expect(model.get("active-position")).toEqual({
            rowIndex: 3,
            columnIndex: 2,
        });
    });
});
