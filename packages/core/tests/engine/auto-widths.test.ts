// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    COLUMN_RESIZER_ATTRIBUTE,
    type ColumnOrGroup,
    type ColumnWidths,
    type GridView,
} from "../../src";
import {
    cellElement,
    fakeContentWidth,
    keydown,
    mountEngine,
    pointer,
    type Row,
    stubAnimationFrames,
} from "./harness";

// Automatic widths on screen (Epic #80, A1–A6): flex columns share the view's leftover width,
// the engine measures its own cells to fit a column (a double click, Enter, `fit-columns`), and
// an `autoSize` column fits itself once; the engine's widths are never the model's.

afterEach(() => {
    vi.unstubAllGlobals();
});

/** The columns' widths on screen, in order. */
const sizes = (view: GridView<Row>) =>
    Array.from({ length: view.columnAxis.count }, (_, index) =>
        view.columnAxis.sizeOf(index),
    );

/** "a" is pinned and fixed; "b" (resizable) and "c" flex, one part and two. */
const FLEX: ColumnOrGroup<Row>[] = [
    { key: "a", width: 100, pinned: "start" },
    { key: "b", width: 50, flex: 1, resizable: true },
    { key: "c", width: 50, flex: 2 },
];

/** A grid of `columns` in a 400-pixel view, its `column-auto-widths` events kept. */
function mount(
    columns: ColumnOrGroup<Row>[],
    options: Parameters<typeof mountEngine>[1] = {},
    rowCount = 10,
) {
    const mounted = mountEngine({ columns, rowCount }, options);
    const events: ColumnWidths[] = [];
    mounted.engine.subscribe("column-auto-widths", (value) =>
        events.push(value),
    );
    return { ...mounted, events };
}

describe("flex columns", () => {
    it("share what the other columns leave of the view, pinned ones included, in proportion", () => {
        const { view, engine } = mount(FLEX);
        // 300 left: one part and two
        expect(sizes(view())).toEqual([100, 100, 200]);
        expect(view().pinnedWidth).toBe(100);
        expect(engine.get("column-auto-widths")).toEqual({ b: 100, c: 200 });
        // the parts read it from the view's column axis
        expect(view().columnAxis.sizeOf(2)).toBe(200);
    });

    it("stop at their maximum and their base, the others taking the rest", () => {
        const { view } = mount([
            { key: "a", width: 100 },
            { key: "b", width: 50, flex: 1, maxWidth: 80 },
            { key: "c", width: 50, flex: 1 },
            { key: "d", width: 120, flex: 1 },
        ]);
        // 100 each: "b" stops at 80, "d" never goes below its 120, "c" takes what is left
        expect(sizes(view())).toEqual([100, 80, 100, 120]);
    });

    it("fill the view when one stops at its base and another at its maximum in one round", () => {
        const { view } = mount(
            [
                { key: "a", width: 100, flex: 1 },
                { key: "b", width: 40, flex: 1, maxWidth: 50 },
            ],
            { width: 180 },
        );
        // 90 each: "a" up to its 100, "b" down to its 50; only the maximum holds, "a" takes 130
        expect(sizes(view())).toEqual([130, 50]);
    });

    it("start a resize from their share, the app's own too, and only the engine's widths fill it", () => {
        const { model } = mount(FLEX);
        const payloads: unknown[] = [];
        model.use((ctx, next) => {
            payloads.push(ctx.payload);
            return next();
        });
        // at its share already: nothing changes
        model.run("column-widths.resize", { columnKey: "b", width: 100 });
        expect(model.get("column-widths")).toEqual({});
        model.run("column-widths.resize", { columnKey: "b", width: 110 });
        expect(model.get("column-widths")).toEqual({ b: 110 });
        expect(payloads[0]).toEqual({
            columnKey: "b",
            width: 100,
            autoWidths: { b: 100, c: 200 },
        });
        // a grid whose engine sizes nothing: the payload as given
        const plain = mount([{ key: "a", width: 100, resizable: true }]);
        const given: unknown[] = [];
        plain.model.use((ctx, next) => {
            given.push(ctx.payload);
            return next();
        });
        plain.model.run("column-widths.resize", { columnKey: "a", width: 120 });
        expect(given).toEqual([{ columnKey: "a", width: 120 }]);
    });

    it("fill the view to the pixel: the rounding passes on", () => {
        const { view } = mount(
            [
                { key: "a", width: 100 },
                { key: "b", width: 10, flex: 1 },
                { key: "c", width: 10, flex: 1 },
                { key: "d", width: 10, flex: 1 },
            ],
            { width: 401 },
        );
        expect(sizes(view())).toEqual([100, 100, 101, 100]);
        expect(view().columnAxis.totalSize).toBe(401);
    });

    it("are their base when nothing is left, and the grid scrolls", () => {
        const { view, engine } = mount([
            { key: "a", width: 500 },
            { key: "b", width: 50, flex: 1 },
            { key: "c", width: 60, flex: 2 },
        ]);
        expect(sizes(view())).toEqual([500, 50, 60]);
        expect(engine.get("column-auto-widths")).toEqual({ b: 50, c: 60 });
    });

    it("stop flexing once resized, and flex again after a reset", () => {
        const { view, model, engine, events } = mount(FLEX);
        model.run("column-widths.resize", { columnKey: "b", width: 150 });
        expect(model.get("column-widths")).toEqual({ b: 150 });
        // "c" takes what "b" leaves
        expect(sizes(view())).toEqual([100, 150, 150]);
        expect(engine.get("column-auto-widths")).toEqual({ c: 150 });
        expect(events).toEqual([{ c: 150 }]);
        model.run("column-widths.reset", { columnKey: "b" });
        expect(sizes(view())).toEqual([100, 100, 200]);
        expect(events.at(-1)).toEqual({ b: 100, c: 200 });
    });

    it("follow the view's width, and only its width", () => {
        const { view, size, resize, events } = mount(FLEX);
        const axis = view().columnAxis;
        size.height = 100;
        resize();
        expect(view().columnAxis).toBe(axis);
        expect(events).toEqual([]);
        size.width = 600;
        resize();
        // 500 left
        expect(sizes(view())).toEqual([100, 167, 333]);
        expect(events).toEqual([{ b: 167, c: 333 }]);
    });

    it("follow the columns and their order", () => {
        const { view, model } = mount(
            FLEX.map((column) => ({ ...column, reorderable: true })),
        );
        model.run("column-order.move", {
            columnKey: "c",
            targetKey: "b",
            side: "before",
        });
        expect(sizes(view())).toEqual([100, 200, 100]);
        model.run("columns.set", {
            columns: [
                { key: "a", width: 100, pinned: "start" },
                { key: "b", width: 50, flex: 1 },
                { key: "c", width: 50, flex: 1 },
            ],
        });
        expect(sizes(view())).toEqual([100, 150, 150]);
    });

    it("resize from their share, and a cancelled drag gives the flex back", () => {
        const { frame } = stubAnimationFrames();
        const grid = document.createElement("div");
        const cell = cellElement(
            grid,
            -1,
            1,
            `<div ${COLUMN_RESIZER_ATTRIBUTE}="b"></div>`,
        );
        const resizer = cell.firstElementChild;
        if (!resizer) throw new Error("no resizer");
        const { engine, model, view } = mount(FLEX, { grid });
        pointer(engine, resizer, "pointerdown", 300);
        pointer(engine, resizer, "pointermove", 320);
        frame();
        // from 100 on screen, not its own 50
        expect(model.get("column-widths")).toEqual({ b: 120 });
        expect(sizes(view())).toEqual([100, 120, 180]);
        document.body.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "Escape",
                bubbles: true,
                cancelable: true,
            }),
        );
        expect(model.get("column-widths")).toEqual({});
        expect(sizes(view())).toEqual([100, 100, 200]);
    });
});

describe("a grid without flex or autoSize", () => {
    it("measures nothing and lays nothing out again when the view resizes", () => {
        const grid = document.createElement("div");
        const cell = cellElement(grid, 0, 0);
        const measure = vi.fn(() => DOMRect.fromRect({ width: 300 }));
        cell.getBoundingClientRect = measure;
        const { view, engine, size, resize, commit, events } = mount(
            [
                { key: "a", width: 100, resizable: true },
                { key: "b", width: 100 },
            ],
            { grid },
        );
        const axis = view().columnAxis;
        size.width = 700;
        resize();
        commit();
        expect(view().columnAxis).toBe(axis);
        expect(measure).not.toHaveBeenCalled();
        expect(engine.get("column-auto-widths")).toEqual({});
        expect(events).toEqual([]);
    });

    it("with autoSize only, lays nothing out again when the view resizes", () => {
        const { view, size, resize } = mount([
            { key: "a", width: 100, autoSize: true },
        ]);
        const axis = view().columnAxis;
        size.width = 700;
        resize();
        expect(view().columnAxis).toBe(axis);
    });
});

/**
 * A grid whose columns' cells (rows 0–2) and header cells are rendered with content widths:
 * `widths[columnIndex]` is `[header, row 0, row 1, row 2]`. Row 2 is not loaded.
 */
function measured(
    columns: ColumnOrGroup<Row>[],
    widths: readonly (readonly number[])[],
    options: Parameters<typeof mountEngine>[1] = {},
) {
    const grid = document.createElement("div");
    const cells = widths.map((contents, columnIndex) =>
        contents.map((content, index) => {
            const cell = cellElement(grid, index - 1, columnIndex);
            fakeContentWidth(cell, content);
            return cell;
        }),
    );
    const mounted = mountEngine(
        {
            columns,
            rowCount: 10,
            getRow: (id) => (id === 2 ? undefined : { id }),
        },
        { grid, ...options },
    );
    const commands: string[] = [];
    mounted.model.use((ctx, next) => {
        commands.push(ctx.command);
        return next();
    });
    return { ...mounted, cells, commands };
}

describe("fitting columns to their content", () => {
    const FIT: ColumnOrGroup<Row>[] = [
        { key: "a", width: 100, resizable: true, minWidth: 50, maxWidth: 300 },
        { key: "b", width: 100, resizable: true },
        { key: "e", width: 100 },
    ];

    it("takes the widest of its header cell and its loaded cells, rounded up, within its limits", () => {
        const { engine, model, commands } = measured(FIT, [
            // row 2 is not loaded: never measured
            [80.2, 120.4, 90, 999],
            [10, 20, 30, 999],
            [500, 500, 500, 500],
        ]);
        engine.run("fit-columns", { columnKeys: ["a"] });
        expect(model.get("column-widths")).toEqual({ a: 121 });
        // "b" to its minimum
        engine.run("fit-columns", { columnKeys: ["b"] });
        expect(model.get("column-widths")).toEqual({ a: 121, b: 40 });
        expect(commands).toEqual(["column-widths.set", "column-widths.set"]);
    });

    it("fits every resizable column in one set, the fixed ones and the other widths kept", () => {
        const { engine, model, commands } = measured(
            FIT,
            [
                [400, 0, 0],
                [70, 0, 0],
                [500, 0, 0],
            ],
            {},
        );
        model.run("column-widths.set", { columnWidths: { gone: 80 } });
        commands.length = 0;
        engine.run("fit-columns", {});
        expect(commands).toEqual(["column-widths.set"]);
        expect(model.get("column-widths")).toEqual({ gone: 80, a: 300, b: 70 });
        // nothing changes: nothing commits
        engine.run("fit-columns", {});
        engine.run("fit-columns", { columnKeys: ["e", "nothing"] });
        expect(commands).toEqual(["column-widths.set"]);
    });

    it("needs no width for a column fitted to its own, and leaves a column not rendered alone", () => {
        const { engine, model, commands } = measured(FIT, [[100, 100, 100]]);
        engine.run("fit-columns", {});
        expect(commands).toEqual([]);
        model.run("column-widths.set", { columnWidths: { a: 200, b: 150 } });
        engine.run("fit-columns", {});
        // "b" has no cell on screen: its width stays
        expect(model.get("column-widths")).toEqual({ b: 150 });
    });

    it("measures in one layout: every cell at max-content before a box is read", () => {
        const { engine, cells } = measured(FIT, [
            [100, 120, 130],
            [70, 80, 90],
        ]);
        const all = cells.flat();
        const atMaxContent: boolean[] = [];
        for (const cell of all) {
            const read = cell.getBoundingClientRect;
            cell.getBoundingClientRect = () => {
                atMaxContent.push(
                    all.every((each) => each.style.width === "max-content"),
                );
                return read();
            };
        }
        engine.run("fit-columns", {});
        expect(atMaxContent).toEqual(all.map(() => true));
        expect(all.some((each) => each.hasAttribute("style"))).toBe(false);
    });

    it("fits only the rendered columns without keys", () => {
        const grid = document.createElement("div");
        // a cell left in the page for a column out of the window
        fakeContentWidth(cellElement(grid, 0, 15), 300);
        const { engine, model } = mountEngine(
            {
                columns: Array.from({ length: 20 }, (_, index) => ({
                    key: `c${index}`,
                    width: 100,
                    resizable: true,
                })),
                rowCount: 10,
            },
            { grid },
        );
        expect(engine.get("column-window").rendered.end).toBeLessThan(15);
        engine.run("fit-columns", {});
        expect(model.get("column-widths")).toEqual({});
        engine.run("fit-columns", { columnKeys: ["c15"] });
        expect(model.get("column-widths")).toEqual({ c15: 300 });
    });

    it("fits a group's resizable columns", () => {
        const { engine, model } = measured(
            [
                {
                    key: "g",
                    children: [
                        { key: "c", width: 100, resizable: true },
                        { key: "d", width: 100 },
                    ],
                },
            ],
            [
                [130, 0, 0],
                [300, 0, 0],
            ],
        );
        engine.run("fit-columns", { columnKeys: ["g"] });
        expect(model.get("column-widths")).toEqual({ c: 130 });
    });

    it("puts each cell's inline style back exactly as it was", () => {
        const { engine, cells } = measured(
            [{ key: "a", width: 100, resizable: true, pinned: "start" }],
            [[90, 100, 110]],
        );
        const [header, styled] = cells[0] ?? [];
        if (!header || !styled) throw new Error("no cells");
        styled.setAttribute(
            "style",
            "position: absolute; width: 100px !important; flex-shrink: 1",
        );
        engine.adapter.registerLayer("pinned", styled);
        // a pinned cell cannot shrink in its row's flex while it is measured
        const read = styled.getBoundingClientRect;
        let shrink = "";
        styled.getBoundingClientRect = () => {
            shrink = styled.style.getPropertyValue("flex-shrink");
            return read();
        };
        const before = styled.getAttribute("style");
        engine.run("fit-columns", {});
        expect(shrink).toBe("0");
        expect(styled.getAttribute("style")).toBe(before);
        expect(styled.style.getPropertyPriority("width")).toBe("important");
        expect(header.hasAttribute("style")).toBe(false);
    });

    it("fixes a flex column, the others sharing what is left; a reset makes it flex again", () => {
        const { engine, model, view } = measured(FLEX, [
            [0, 0, 0],
            [70, 0, 0],
            [0, 0, 0],
        ]);
        expect(sizes(view())).toEqual([100, 100, 200]);
        engine.run("fit-columns", { columnKeys: ["b"] });
        expect(model.get("column-widths")).toEqual({ b: 70 });
        expect(sizes(view())).toEqual([100, 70, 230]);
        model.run("column-widths.reset", {});
        expect(sizes(view())).toEqual([100, 100, 200]);
    });

    it("on a focused resizer, with Enter, once a press", () => {
        const grid = document.createElement("div");
        const cell = cellElement(
            grid,
            -1,
            0,
            `<div role="separator" tabindex="0" ${COLUMN_RESIZER_ATTRIBUTE}="a"></div>`,
        );
        fakeContentWidth(cell, 175);
        const { engine, model } = mountEngine(
            {
                columns: [{ key: "a", width: 100, resizable: true }],
                rowCount: 10,
            },
            { grid },
        );
        const resizer = cell.firstElementChild;
        if (!resizer) throw new Error("no resizer");
        keydown(engine, cell, "F2");
        expect(document.activeElement).toBe(resizer);
        model.run("column-widths.set", { columnWidths: { a: 300 } });
        expect(
            keydown(engine, resizer, "Enter", { repeat: true }).handled,
        ).toBe(true);
        expect(model.get("column-widths")).toEqual({ a: 300 });
        const { handled, event } = keydown(engine, resizer, "Enter");
        expect(handled).toBe(true);
        expect(event.defaultPrevented).toBe(true);
        expect(model.get("column-widths")).toEqual({ a: 175 });
        expect(engine.get("interaction")).not.toBeNull();
    });
});

describe("autoSize columns", () => {
    /** "a" fits itself; its cells hold 130, its header 60; no row is loaded until `load` */
    function autoSized(
        columns?: ColumnOrGroup<Row>[],
        options: Parameters<typeof mountEngine>[1] = {},
    ) {
        const grid = document.createElement("div");
        const measure = vi.fn();
        const cells = [-1, 0, 1].map((rowIndex) => {
            const cell = cellElement(grid, rowIndex, 0);
            fakeContentWidth(cell, rowIndex < 0 ? 60 : 130);
            const read = cell.getBoundingClientRect;
            cell.getBoundingClientRect = () => {
                measure();
                return read();
            };
            return cell;
        });
        let loaded = false;
        const mounted = mountEngine(
            {
                columns: columns ?? [
                    { key: "a", width: 100, autoSize: true, resizable: true },
                    { key: "b", width: 100 },
                ],
                rowCount: 10,
                getRow: (id) => (loaded ? { id } : undefined),
            },
            { grid, ...options },
        );
        const events: ColumnWidths[] = [];
        mounted.engine.subscribe("column-auto-widths", (value) =>
            events.push(value),
        );
        let changes = 0;
        mounted.model.subscribe(() => {
            changes += 1;
        });
        const load = () => {
            loaded = true;
            mounted.model.run("rows.changed", {});
            mounted.commit();
        };
        return {
            ...mounted,
            cells,
            measure,
            load,
            events,
            changes: () => changes,
        };
    }

    it("fit once, after the first commit with loaded rows, as the engine's width only", () => {
        const { view, engine, model, measure, load, events, commit, cells } =
            autoSized();
        expect(measure).not.toHaveBeenCalled();
        expect(sizes(view())).toEqual([100, 100]);
        load();
        expect(measure).toHaveBeenCalledTimes(3);
        expect(sizes(view())).toEqual([130, 100]);
        expect(engine.get("column-auto-widths")).toEqual({ a: 130 });
        expect(events).toEqual([{ a: 130 }]);
        // never reported: the model keeps no width
        expect(model.get("column-widths")).toEqual({});
        expect(model.get("column-width-by", { columnKey: "a" })).toBe(100);
        // once: wider content later is not measured again
        const [, first] = cells;
        if (first) fakeContentWidth(first, 400);
        commit();
        expect(measure).toHaveBeenCalledTimes(3);
        expect(sizes(view())).toEqual([130, 100]);
    });

    it("come back to their automatic width on a reset, and keep it across new columns", () => {
        const { view, model, measure, load, changes, commit } = autoSized();
        load();
        const before = changes();
        model.run("column-widths.resize", { columnKey: "a", width: 200 });
        expect(sizes(view())).toEqual([200, 100]);
        model.run("column-widths.reset", {});
        expect(sizes(view())).toEqual([130, 100]);
        expect(changes()).toBe(before + 2);
        model.run("columns.set", {
            columns: [
                { key: "a", width: 100, autoSize: true, resizable: true },
                { key: "b", width: 100 },
            ],
        });
        commit();
        expect(sizes(view())).toEqual([130, 100]);
        expect(measure).toHaveBeenCalledTimes(3);
    });

    it("fit again once in a new attach; a fit by the app writes a width", () => {
        const { engine, model, measure, load, detach, viewport, commit } =
            autoSized();
        load();
        detach();
        engine.adapter.attach(viewport);
        commit();
        expect(measure).toHaveBeenCalledTimes(6);
        engine.run("fit-columns", { columnKeys: ["a"] });
        // its automatic width already: no width needed
        expect(model.get("column-widths")).toEqual({});
    });

    it("wait until the grid is laid out, and for a column measured wider than 0", () => {
        const { load, measure, view, size, resize, commit, cells } = autoSized(
            undefined,
            { width: 0, height: 0 },
        );
        load();
        // no size (a hidden tab): nothing measured, nothing marked
        expect(measure).not.toHaveBeenCalled();
        size.width = 400;
        size.height = 260;
        // its cells hidden: 0 wide
        for (const cell of cells) fakeContentWidth(cell, 0);
        resize();
        commit();
        expect(sizes(view())).toEqual([100, 100]);
        for (const cell of cells) fakeContentWidth(cell, 130);
        commit();
        expect(sizes(view())).toEqual([130, 100]);
    });

    it("are the base of a flex column", () => {
        const { view, load } = autoSized(
            [
                { key: "a", width: 50, autoSize: true, flex: 1 },
                { key: "b", width: 50, flex: 1 },
            ],
            { width: 200 },
        );
        // 100 each until "a" fits: never below its 130 then, "b" taking the rest
        expect(sizes(view())).toEqual([100, 100]);
        load();
        expect(sizes(view())).toEqual([130, 70]);
    });

    it("keep the view on the column it shows first when one left of it fits", () => {
        const grid = document.createElement("div");
        const columns = Array.from({ length: 20 }, (_, index) => ({
            key: `c${index}`,
            width: 100,
            ...(index === 3 ? { autoSize: true } : {}),
        }));
        for (const rowIndex of [0, 1]) {
            fakeContentWidth(cellElement(grid, rowIndex, 3), 250);
        }
        let loaded = false;
        const { engine, model, commit } = mountEngine(
            {
                columns,
                rowCount: 10,
                getRow: (id) => (loaded ? { id } : undefined),
            },
            { grid },
        );
        engine.run("scroll-to", { left: 500 });
        commit();
        // column 3 is rendered (the overscan), left of the view
        expect(engine.get("column-window").rendered.start).toBe(3);
        loaded = true;
        model.run("rows.changed", {});
        commit();
        expect(engine.get("column-auto-widths")).toEqual({ c3: 250 });
        expect(engine.get("scroll-position").left).toBe(650);
        expect(engine.get("column-window").visible.start).toBe(5);
    });
});
