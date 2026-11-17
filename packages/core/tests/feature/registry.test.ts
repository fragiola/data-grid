// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    bindGridRoot,
    type Column,
    createDataGridModel,
    type DataGridFeature,
    defineFeature,
    done,
    type FeatureTypes,
    fail,
    type GridRootProps,
    headerCellPart,
    withoutRootProps,
} from "../../src";
import { navigation } from "../../src/navigation";
import { sorting } from "../../src/sorting";
import { cellElement, click, keydown, mountEngine } from "../engine/harness";

// The feature registry (Epic #141): a grid installs its features once, at creation; the core
// composes what each contributes (state, commands, keys, source reactions, view keys, part
// attributes, keys and clicks, root props), and a grid without them has none of it.

interface Row {
    id: number;
}

const rows: Row[] = Array.from({ length: 5 }, (_, id) => ({ id }));
const columns: Column<Row>[] = [
    { key: "a", width: 100, sortable: true },
    { key: "b", width: 100 },
];

/** A feature for the tests: it counts, and logs what the registry calls. */
interface CounterTypes extends FeatureTypes {
    readonly state: { readonly count: number };
    readonly options: { readonly count?: number };
    readonly commands: {
        "count.add": { payload: { readonly by: number }; result: number };
    };
    readonly queries: { count: { payload: undefined; result: number } };
    readonly questions: { "count-above": { readonly value: number } };
    readonly props: {
        count?: number | undefined;
        onCountChange?: ((count: number) => void) | undefined;
    };
}

function counter(
    log: string[] = [],
    requires: readonly string[] = [],
): DataGridFeature<CounterTypes> {
    return defineFeature<CounterTypes>({
        name: "counter",
        requires,
        initial: (_, options) => ({ count: options.count ?? 0 }),
        commands: {
            "count.add": (state, { by }) => {
                if (!Number.isFinite(by)) {
                    return fail("invalid_payload", "by must be a number");
                }
                return by === 0
                    ? done(state, state.count)
                    : done(
                          { ...state, count: state.count + by },
                          state.count + by,
                      );
            },
        },
        queries: { count: (state) => state.count },
        questions: {
            "count-above": (state, { value }) => state.count > value,
        },
        sourceChanged: (after, before) => {
            log.push(
                after.source !== before.source
                    ? "source"
                    : after.columnEntries !== before.columnEntries
                      ? "columns"
                      : "rows",
            );
            return after.columns.length === 0 ? { ...after, count: 0 } : after;
        },
        view: ["count"],
        rowsOrdered: (state) => state.count > 10,
        headerCell: (view, cell) => ({
            state: { sortPriority: view.count },
            attributes:
                cell.column?.key === "b" ? { "data-counted": "" } : undefined,
        }),
        engine: ({ model, headerCellOf }) => ({
            keydown: (event, target) => {
                log.push(`key ${event.key}`);
                if (event.key !== "+" || !headerCellOf(target)) return false;
                model.run("count.add", { by: 1 });
                return true;
            },
            click: (event) => {
                log.push("click");
                const cell = headerCellOf(event.target);
                if (cell?.column?.key !== "b") return false;
                model.run("count.add", { by: 10 });
                return true;
            },
        }),
        root: {
            props: ["count", "onCountChange"],
            options: (props) => ({ count: props.count }),
        },
    });
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe("a grid without features", () => {
    it("runs a feature's command as not found, never a throw, and reads none of its keys", () => {
        const model = createDataGridModel({ columns, rows });
        const state = model.state;
        const run = model.run as (command: string, payload: unknown) => unknown;
        expect(run("sort-columns.toggle", { columnKey: "a" })).toMatchObject({
            ok: false,
            error: {
                code: "not_found",
                message: expect.stringContaining("sort-columns.toggle"),
            },
        });
        const check = model.check as (
            command: string,
            payload: unknown,
        ) => unknown;
        expect(check("sort-columns.set", { sortColumns: [] })).toMatchObject({
            ok: false,
            error: { code: "not_found" },
        });
        const get = model.get as (key: string) => unknown;
        const is = model.is as (key: string, payload: unknown) => boolean;
        expect(get("sort-columns")).toBeUndefined();
        expect(is("column-sortable", { columnKey: "a" })).toBe(false);
        expect(get("toString")).toBeUndefined();
        expect(model.state).toBe(state);
        expect("sortColumns" in model.state).toBe(false);
    });

    it("never sorts from its header: no sort attribute, a click and Enter are not the grid's", () => {
        const { engine, view, grid } = mountEngine({ columns, rowCount: 10 });
        const cell = view().header.cellByKey("a");
        if (!cell) throw new Error("no header cell a");
        const part = headerCellPart(view(), cell);
        expect(part.attributes).toBeUndefined();
        expect(part.state.sortable).toBeUndefined();
        expect(part.state.sortDirection).toBeUndefined();
        const element = cellElement(grid, -1, 0);
        expect(click(engine, element).handled).toBe(false);
        expect(keydown(engine, element, "Enter").event.defaultPrevented).toBe(
            false,
        );
        expect("sortColumns" in view()).toBe(false);
        expect(view().rowsOrdered).toBe(false);
    });
});

describe("composing features", () => {
    it("adds a feature's state from its options, its commands and its keys", () => {
        const model = createDataGridModel({
            columns,
            rows,
            features: [counter()],
            count: 2,
        });
        expect(model.state.count).toBe(2);
        expect(model.run("count.add", { by: 3 })).toEqual({
            ok: true,
            value: 5,
        });
        expect(model.get("count")).toBe(5);
        expect(model.is("count-above", { value: 4 })).toBe(true);
        expect(model.run("count.add", { by: Number.NaN })).toMatchObject({
            ok: false,
            error: { code: "invalid_payload" },
        });
    });

    it("runs its commands through the middleware and tells the listeners, as the core's", () => {
        const model = createDataGridModel({
            columns,
            rows,
            features: [counter()],
        });
        const listener = vi.fn();
        model.subscribe(listener);
        model.use((ctx, next) => {
            if (ctx.command === "count.add" && ctx.payload.by > 100) {
                return fail("vetoed", "too much");
            }
            return next();
        });
        expect(model.run("count.add", { by: 1000 }).ok).toBe(false);
        // the same state: nothing committed
        const state = model.state;
        model.run("count.add", { by: 0 });
        expect(model.state).toBe(state);
        expect(listener).not.toHaveBeenCalled();
        model.run("count.add", { by: 1 });
        expect(listener).toHaveBeenCalledWith(
            expect.objectContaining({ command: "count.add", result: 1 }),
        );
        // a dry run commits nothing
        expect(model.check("count.add", { by: 2 })).toEqual({
            ok: true,
            value: 3,
        });
        expect(model.get("count")).toBe(1);
    });

    it("keeps a feature's state to a new source, new columns or rows changed, only then", () => {
        const log: string[] = [];
        const model = createDataGridModel({
            columns,
            rows,
            features: [counter(log), navigation()],
            count: 4,
        });
        model.run("active-position.set", { rowIndex: 0, columnIndex: 0 });
        model.run("count.add", { by: 1 });
        expect(log).toEqual([]);
        model.run("data.set", { rows: [...rows] });
        model.run("rows.changed", { start: 0, end: 1 });
        model.run("columns.set", { columns: [...columns] });
        expect(log).toEqual(["source", "rows", "columns"]);
        model.run("columns.set", { columns: [] });
        expect(model.get("count")).toBe(0);
    });

    it("fails at creation for a feature twice, one missing what it requires, or a key taken", () => {
        expect(() =>
            createDataGridModel({ features: [counter(), counter()] }),
        ).toThrow(/feature "counter" is installed twice/);
        expect(() =>
            createDataGridModel({ features: [counter([], ["sorting"])] }),
        ).toThrow(/feature "counter" requires feature "sorting"/);
        // installed, the requirement is met
        expect(() =>
            createDataGridModel({
                features: [counter([], ["sorting"]), sorting()],
            }),
        ).not.toThrow();
        const thief = defineFeature<
            FeatureTypes & {
                readonly commands: {
                    "data.set": { payload: undefined; result: undefined };
                };
            }
        >({
            name: "thief",
            commands: { "data.set": (state) => done(state, undefined) },
        });
        expect(() => createDataGridModel({ features: [thief] })).toThrow(
            /adds the command "data.set"/,
        );
    });
});

describe("a feature in an engine", () => {
    function setup(log: string[] = []) {
        const mounted = mountEngine({
            columns,
            rowCount: 10,
            features: [counter(log), sorting()],
        });
        const header = (columnIndex: number) =>
            cellElement(mounted.grid, -1, columnIndex);
        return { ...mounted, header };
    }

    it("walks its keys and clicks in the features' order, before the grid's own", () => {
        const log: string[] = [];
        const { engine, model, header } = setup(log);
        expect(keydown(engine, header(1), "+").handled).toBe(true);
        expect(model.get("count")).toBe(1);
        // the counter's click takes "b"; "a" goes on to sorting
        expect(click(engine, header(1)).handled).toBe(true);
        expect(model.get("count")).toBe(11);
        expect(click(engine, header(0)).handled).toBe(true);
        expect(model.get("sort-columns")).toEqual([
            { columnKey: "a", direction: "ascending" },
        ]);
        expect(log).toEqual(["key +", "click", "click"]);
    });

    it("carries its view keys, renders a new view when one changes, and orders the rows", () => {
        const { engine, model, view } = setup();
        const listener = vi.fn();
        engine.adapter.subscribe(listener);
        const before = view();
        expect((before as unknown as { count: number }).count).toBe(0);
        model.run("count.add", { by: 11 });
        expect(listener).toHaveBeenCalledTimes(1);
        expect((view() as unknown as { count: number }).count).toBe(11);
        expect(view().rowsOrdered).toBe(true);
    });

    it("adds its state and attributes to a header cell's part, merged in order", () => {
        const { model, view } = setup();
        model.run("count.add", { by: 3 });
        model.run("sort-columns.set", {
            sortColumns: [{ columnKey: "a", direction: "descending" }],
        });
        const part = (key: string) => {
            const cell = view().header.cellByKey(key);
            if (!cell) throw new Error(`no header cell ${key}`);
            return headerCellPart(view(), cell);
        };
        // sorting's comes after the counter's: its priority wins on "a"
        expect(part("a").state.sortPriority).toBe(1);
        expect(part("a").attributes).toEqual({
            "aria-sort": "descending",
            "data-sortable": "",
            "data-sort": "descending",
            "data-sort-priority": "1",
        });
        expect(part("b").state.sortPriority).toBeUndefined();
        expect(part("b").attributes).toEqual({ "data-counted": "" });
    });
});

describe("a root's features", () => {
    it("are fixed when it is created: another list is told once, and not taken", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        let props: GridRootProps<Row, unknown, DataGridFeature[]> = {
            columns,
            rows,
            features: [sorting()],
        };
        const root = bindGridRoot(() => props);
        root.sync();
        // the same features in a new array are the same list
        props = { ...props, features: [sorting()] };
        root.sync();
        expect(warn).not.toHaveBeenCalled();
        props = { ...props, features: [] };
        root.sync();
        root.sync();
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]?.[0]).toMatch(/features/);
        const run = root.model.run as (
            command: string,
            payload: unknown,
        ) => { ok: boolean };
        expect(run("sort-columns.toggle", { columnKey: "a" }).ok).toBe(true);
    });

    it("take their props, give the model their options, and leave them off the element", () => {
        const onCountChange = vi.fn();
        const root = bindGridRoot(() => ({
            columns,
            rows,
            features: [counter()],
            count: 7,
            onCountChange,
        }));
        expect(root.model.get("count")).toBe(7);
        expect(
            withoutRootProps(
                {
                    columns,
                    count: 7,
                    onCountChange,
                    features: [counter()],
                    id: "grid",
                },
                [counter()],
            ),
        ).toEqual({ id: "grid" });
    });

    it("bind a feature's controlled prop: asked, then held as the prop says", () => {
        const onSortColumnsChange = vi.fn();
        const root = bindGridRoot(() => ({
            columns,
            rows,
            features: [sorting()],
            sortColumns: [],
            onSortColumnsChange,
        }));
        root.sync();
        root.model.run("sort-columns.toggle", { columnKey: "a" });
        expect(onSortColumnsChange).toHaveBeenCalledWith([
            { columnKey: "a", direction: "ascending" },
        ]);
        expect(root.model.get("sort-columns")).toEqual([]);
    });
});
