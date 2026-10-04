import { describe, expect, it } from "vitest";
import {
    type ColumnOrGroup,
    createDataGridModel,
    type DataGridModelOptions,
    veto,
} from "../../src";

// Column widths (Epic #70, W1, W2, W5, W7): the model keeps the resized columns' widths over their
// `width`, clamped to their limits; a group's resize is shared by its resizable columns.

interface Row {
    id: number;
}

// "a" resizes within 50–200; "b" does not resize; "g" groups "d" (100–320), "c" (at least 40,
// no maximum) and the fixed "e"
const COLUMNS: ColumnOrGroup<Row>[] = [
    { key: "a", width: 100, resizable: true, minWidth: 50, maxWidth: 200 },
    { key: "b", width: 120 },
    {
        key: "g",
        children: [
            {
                key: "d",
                width: 300,
                resizable: true,
                minWidth: 100,
                maxWidth: 320,
            },
            { key: "c", width: 100, resizable: true },
            { key: "e", width: 60 },
        ],
    },
];

function grid(options: DataGridModelOptions<Row> = {}) {
    return createDataGridModel<Row>({ columns: COLUMNS, rows: [], ...options });
}

const width = (model: ReturnType<typeof grid>, columnKey: string) =>
    model.get("column-width-by", { columnKey });

describe("column widths", () => {
    it("start from the given widths, the ones that are not widths dropped", () => {
        const model = grid({
            columnWidths: {
                a: 150,
                gone: 80,
                c: Number.NaN,
                d: -1,
            },
        });
        expect(model.get("column-widths")).toEqual({ a: 150, gone: 80 });
        expect(width(model, "a")).toBe(150);
        expect(width(model, "c")).toBe(100);
    });

    it("are each column's width on screen: resized or its own, within its limits", () => {
        const model = grid({ columnWidths: { a: 500, b: 300, c: 10 } });
        expect(width(model, "a")).toBe(200);
        // a column that does not resize is its width, whatever the record says
        expect(width(model, "b")).toBe(120);
        // the default floor, 40
        expect(width(model, "c")).toBe(40);
        // a group is its columns together
        expect(width(model, "g")).toBe(300 + 40 + 60);
        expect(width(model, "nothing")).toBeUndefined();
        // one lookup by key, laid out with the columns
        expect(model.state.header.cellByKey("g")).toMatchObject({
            columnIndex: 2,
            columnSpan: 3,
        });
    });

    it("clamp a width the column starts outside its limits, and a floor above the maximum", () => {
        const model = createDataGridModel<Row>({
            columns: [
                { key: "wide", width: 900, resizable: true, maxWidth: 400 },
                { key: "thin", width: 10, resizable: true, maxWidth: 30 },
                { key: "fixed", width: 10 },
            ],
        });
        expect(width(model, "wide")).toBe(400);
        // no minimum, a maximum below the default floor: the maximum is the floor
        expect(width(model, "thin")).toBe(30);
        expect(width(model, "fixed")).toBe(10);
    });
});

describe("column-widths.resize", () => {
    it("resizes a column within its limits, in whole pixels", () => {
        const model = grid();
        expect(
            model.run("column-widths.resize", { columnKey: "a", width: 150.6 }),
        ).toEqual({ ok: true, value: { a: 151 } });
        model.run("column-widths.resize", { columnKey: "a", width: 500 });
        expect(width(model, "a")).toBe(200);
        model.run("column-widths.resize", { columnKey: "a", width: 0 });
        expect(width(model, "a")).toBe(50);
        expect(model.get("column-widths")).toEqual({ a: 50 });
    });

    it("refuses a column that does not resize, a key that is nothing, a width that is not one", () => {
        const model = grid();
        expect(
            model.check("column-widths.resize", { columnKey: "b", width: 90 })
                .ok,
        ).toBe(false);
        expect(
            model.check("column-widths.resize", { columnKey: "x", width: 90 }),
        ).toMatchObject({ ok: false, error: { code: "not_found" } });
        expect(
            model.check("column-widths.resize", {
                columnKey: "a",
                width: Number.NaN,
            }),
        ).toMatchObject({ ok: false, error: { code: "invalid_payload" } });
        expect(
            createDataGridModel<Row>({
                columns: [{ key: "g", children: [{ key: "x", width: 50 }] }],
            }).check("column-widths.resize", { columnKey: "g", width: 90 }),
        ).toMatchObject({ ok: false, error: { code: "refused" } });
    });

    it("commits nothing when the width does not change", () => {
        const model = grid({ columnWidths: { a: 150 } });
        let events = 0;
        model.subscribe(() => {
            events += 1;
        });
        model.run("column-widths.resize", { columnKey: "a", width: 150 });
        model.run("column-widths.resize", { columnKey: "a", width: 999 });
        model.run("column-widths.resize", { columnKey: "a", width: 999 });
        expect(events).toBe(1);
    });

    it("shares a group's change among its resizable columns, in proportion, the rest going on", () => {
        const model = grid();
        // 460 → 560: "d" takes 3/4 of 100 but stops at 320; "c" takes the rest; "e" stays
        model.run("column-widths.resize", { columnKey: "g", width: 560 });
        expect(model.get("column-widths")).toEqual({ d: 320, c: 180 });
        expect(width(model, "g")).toBe(560);
        expect(width(model, "e")).toBe(60);
    });

    it("shrinks a group no further than its columns' minimums", () => {
        const model = grid();
        // 460 → 160: "d" stops at 100, "c" at 40, "e" keeps 60
        model.run("column-widths.resize", { columnKey: "g", width: 160 });
        expect(model.get("column-widths")).toEqual({ d: 100, c: 40 });
        expect(width(model, "g")).toBe(200);
    });

    it("gives what a column at its limit could not take to every other one, earlier ones too", () => {
        const model = createDataGridModel<Row>({
            columns: [
                {
                    key: "g",
                    children: [
                        {
                            key: "x",
                            width: 100,
                            resizable: true,
                            maxWidth: 400,
                        },
                        {
                            key: "y",
                            width: 100,
                            resizable: true,
                            maxWidth: 110,
                        },
                    ],
                },
                {
                    key: "h",
                    children: [
                        { key: "p", width: 100, resizable: true, minWidth: 0 },
                        { key: "q", width: 100, resizable: true, minWidth: 90 },
                    ],
                },
            ],
        });
        // 200 → 400: half each, "y" stops at 110, "x" (before it) takes the rest
        model.run("column-widths.resize", { columnKey: "g", width: 400 });
        expect(model.get("column-widths")).toEqual({ x: 290, y: 110 });
        // to its minimum, as its resizer reports it: 0 + 90
        model.run("column-widths.resize", { columnKey: "h", width: 90 });
        expect(model.get("column-widths")).toMatchObject({ p: 0, q: 90 });
        expect(width(model, "h")).toBe(90);
    });

    it("writes a width only for a column whose width changes, and commits nothing else", () => {
        const model = grid();
        let events = 0;
        model.subscribe(() => {
            events += 1;
        });
        // rounds to the width it has
        model.run("column-widths.resize", { columnKey: "a", width: 100.4 });
        expect(events).toBe(0);
        expect(model.get("column-widths")).toEqual({});
        // "m" is at its maximum already: only "n" grows, and only it gets a width
        const group = createDataGridModel<Row>({
            columns: [
                {
                    key: "k",
                    children: [
                        {
                            key: "m",
                            width: 100,
                            resizable: true,
                            maxWidth: 100,
                        },
                        { key: "n", width: 100, resizable: true },
                    ],
                },
            ],
        });
        group.run("column-widths.resize", { columnKey: "k", width: 250 });
        expect(group.get("column-widths")).toEqual({ n: 150 });
    });

    it("goes through the middleware: a veto changes nothing, a rewrite applies", () => {
        const model = grid();
        const remove = model.use((ctx, next) =>
            ctx.command === "column-widths.resize" ? veto() : next(),
        );
        expect(
            model.run("column-widths.resize", { columnKey: "a", width: 150 }),
        ).toMatchObject({ ok: false, error: { code: "vetoed" } });
        expect(model.get("column-widths")).toEqual({});
        remove();
        model.use((ctx, next) => {
            if (ctx.command === "column-widths.resize") {
                ctx.payload = { ...ctx.payload, width: 120 };
            }
            return next();
        });
        model.run("column-widths.resize", { columnKey: "a", width: 150 });
        expect(width(model, "a")).toBe(120);
    });
});

describe("column-widths.set", () => {
    it("replaces the widths, keeping keys that are not columns", () => {
        const model = grid({ columnWidths: { a: 150 } });
        expect(
            model.run("column-widths.set", {
                columnWidths: { c: 90, gone: 70 },
            }),
        ).toEqual({ ok: true, value: { c: 90, gone: 70 } });
        expect(width(model, "a")).toBe(100);
        expect(width(model, "c")).toBe(90);
        // a column called "gone" comes back with its width
        model.run("columns.set", {
            columns: [{ key: "gone", width: 100, resizable: true }],
        });
        expect(width(model, "gone")).toBe(70);
    });

    it("refuses what is not a record of widths, and commits nothing for the same widths", () => {
        const model = grid({ columnWidths: { a: 150 } });
        for (const columnWidths of [{ a: -1 }, { a: "150" }, [150], null, 5]) {
            expect(
                // @ts-expect-error: not a record of widths
                model.check("column-widths.set", { columnWidths }),
            ).toMatchObject({ ok: false, error: { code: "invalid_payload" } });
        }
        const before = model.state;
        model.run("column-widths.set", { columnWidths: { a: 150 } });
        expect(model.state).toBe(before);
    });
});

describe("column-widths.reset", () => {
    it("gives a column its own width back, a group its columns, and every one without a key", () => {
        const model = grid({
            columnWidths: { a: 150, d: 120, c: 50, gone: 1 },
        });
        model.run("column-widths.reset", { columnKey: "a" });
        expect(model.get("column-widths")).toEqual({ d: 120, c: 50, gone: 1 });
        model.run("column-widths.reset", { columnKey: "g" });
        expect(model.get("column-widths")).toEqual({ gone: 1 });
        // a key kept by `set` drops too
        model.run("column-widths.reset", { columnKey: "gone" });
        expect(model.get("column-widths")).toEqual({});
        expect(
            model.check("column-widths.reset", { columnKey: "nothing" }),
        ).toMatchObject({ ok: false, error: { code: "not_found" } });
        model.run("column-widths.set", { columnWidths: { a: 60, c: 60 } });
        model.run("column-widths.reset");
        expect(model.get("column-widths")).toEqual({});
    });
});

describe("column limits", () => {
    it("are checked with the columns: widths, the minimum not above the maximum", () => {
        const bad = [
            { key: "x", width: 100, minWidth: -1 },
            { key: "x", width: 100, maxWidth: Number.NaN },
            { key: "x", width: 100, minWidth: 200, maxWidth: 100 },
        ];
        for (const column of bad) {
            expect(() =>
                createDataGridModel<Row>({ columns: [column] }),
            ).toThrow(/invalid columns: column "x"/);
            expect(
                grid().check("columns.set", { columns: [column] }),
            ).toMatchObject({ ok: false, error: { code: "invalid_payload" } });
        }
        expect(
            grid().check("columns.set", {
                columns: [
                    { key: "x", width: 100, minWidth: 100, maxWidth: 100 },
                ],
            }).ok,
        ).toBe(true);
    });
});
