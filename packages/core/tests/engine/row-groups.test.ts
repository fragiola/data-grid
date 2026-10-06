// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
    type DataGridModelOptions,
    GROUP_TOGGLE_ATTRIBUTE,
    type GroupRow,
    gridRole,
    groupTogglePart,
    type RowMeta,
    rowDragHandlePart,
    rowPart,
    veto,
} from "../../src";
import {
    cellElement,
    click,
    fakeContentWidth,
    keydown,
    mountEngine,
} from "./harness";
import { stateOf, viewOf } from "./views";

// Row groups on screen (Epic #87, E3.1): a treegrid's row parts and ARIA, the APG treegrid keys
// (Enter and Space toggle a group row, → and ← on a row's first column expand, collapse or go up
// the tree), the app's toggle, a group row's selection, and nothing of it without row kinds.

const group = (key: string, rowKeys: readonly number[]): GroupRow => ({
    key,
    columnKey: "c0",
    value: key,
    depth: 0,
    childCount: rowKeys.length,
    aggregates: {},
    rowKeys,
});

/**
 * Group "g0" (row 0) over rows 1 and 2, group "g1" (row 3, nothing under it shown), then rows at
 * the top; row 5 expands (a tree's parent).
 */
const META: readonly (RowMeta | undefined)[] = [
    { group: group("g0", [1, 2]), setSize: 2, posInSet: 1 },
    { depth: 1, parentIndex: 0, setSize: 2, posInSet: 1 },
    { depth: 1, parentIndex: 0, setSize: 2, posInSet: 2 },
    { group: group("g1", [3]), setSize: 2, posInSet: 2 },
    undefined,
    { expandable: true },
];

const getRowMeta = (index: number) => META[index];

function setup(options: DataGridModelOptions<{ id: number }> = {}) {
    const mounted = mountEngine({
        columns: [
            { key: "c0", width: 100 },
            { key: "c1", width: 100 },
        ],
        rowCount: 50,
        getRowMeta,
        rowKey: (row) => row.id,
        expandedGroupKeys: ["g0"],
        ...options,
    });
    const { model, engine, grid } = mounted;
    const activate = (rowIndex: number, columnIndex = 0) => {
        model.run("active-position.set", { rowIndex, columnIndex });
        return cellElement(grid, rowIndex, columnIndex);
    };
    const key = (target: Element, name: string, init: KeyboardEventInit = {}) =>
        keydown(engine, target, name, init);
    const expanded = () => model.state.expandedGroupKeys;
    return { ...mounted, activate, key, expanded };
}

describe("the parts", () => {
    it("say nothing of a tree without row kinds: a grid, plain rows", () => {
        const view = viewOf();
        expect(gridRole(view)).toBe("grid");
        const part = rowPart(view, 12, true);
        expect(part.ariaTree).toBeUndefined();
        expect(part.state.depth).toBeUndefined();
        expect(part.state.group).toBeUndefined();
        expect(part.state.groupExpanded).toBeUndefined();
        expect(groupTogglePart(view, 12).attributes).toBeUndefined();
    });

    it("make a treegrid of rows with kinds: level, expansion, set", () => {
        const view = viewOf(stateOf({ getRowMeta, expandedGroupKeys: ["g0"] }));
        expect(gridRole(view)).toBe("treegrid");
        const head = rowPart(view, 0, true);
        expect(head.state).toMatchObject({
            depth: 0,
            groupExpanded: true,
            group: { key: "g0" },
        });
        expect(head.ariaTree).toEqual({
            "aria-level": 1,
            "aria-expanded": true,
            "aria-setsize": 2,
            "aria-posinset": 1,
        });
        expect(rowPart(view, 1, true).ariaTree).toEqual({
            "aria-level": 2,
            "aria-setsize": 2,
            "aria-posinset": 1,
        });
        expect(rowPart(view, 3, true).ariaTree?.["aria-expanded"]).toBe(false);
        // a row with no meta is a data row at the top
        expect(rowPart(view, 4, true).ariaTree).toEqual({ "aria-level": 1 });
        expect(rowPart(view, 4, true).state.groupExpanded).toBeUndefined();
    });

    it("read a row's kind once per row part", () => {
        const read = vi.fn(getRowMeta);
        const view = viewOf(
            stateOf({
                getRowMeta: read,
                rowKey: (row) => row.id,
                rowSelection: "multiple",
                selectedRowKeys: [1],
                expandedGroupKeys: ["g0"],
            }),
        );
        for (const rowIndex of [0, 1, 5]) {
            read.mockClear();
            rowPart(view, rowIndex, true);
            expect(read, `row ${rowIndex}`).toHaveBeenCalledTimes(1);
        }
    });

    it("give a toggle its row's state and its mark", () => {
        const view = viewOf(stateOf({ getRowMeta, expandedGroupKeys: ["g0"] }));
        expect(groupTogglePart(view, 0)).toEqual({
            state: {
                rowIndex: 0,
                groupKey: "g0",
                expandable: true,
                expanded: true,
                depth: 0,
            },
            attributes: {
                "aria-expanded": true,
                [GROUP_TOGGLE_ATTRIBUTE]: 0,
            },
        });
        // a row that expands, by its own key (its index without a rowKey)
        expect(groupTogglePart(view, 5).state).toMatchObject({
            groupKey: 5,
            expandable: true,
            expanded: false,
        });
        expect(groupTogglePart(view, 1).state.expandable).toBe(false);
        expect(groupTogglePart(view, 1).attributes).toBeUndefined();
    });

    it("never drag a row while the rows have kinds", () => {
        const plain = viewOf(stateOf(), { reorderableRows: true });
        expect(rowDragHandlePart(plain, 12, true).state.reorderable).toBe(true);
        const grouped = viewOf(stateOf({ getRowMeta }), {
            reorderableRows: true,
        });
        expect(rowDragHandlePart(grouped, 12, true).state.reorderable).toBe(
            false,
        );
    });
});

describe("Enter and Space", () => {
    it("toggle a group row, once per press", () => {
        const { activate, key, expanded } = setup();
        const target = activate(0, 1);
        const press = key(target, "Enter");
        expect(press.handled).toBe(true);
        expect(press.event.defaultPrevented).toBe(true);
        expect(expanded()).toEqual([]);
        key(target, " ");
        expect(expanded()).toEqual(["g0"]);
        expect(key(target, " ", { repeat: true }).handled).toBe(true);
        expect(expanded()).toEqual(["g0"]);
    });

    it("do nothing of the kind on a data row, nor without row kinds", () => {
        const { activate, key, expanded } = setup();
        key(activate(1), "Enter");
        key(activate(1), " ");
        // a tree's parent keeps Enter for its cell (its controls, editing)
        expect(key(activate(5), "Enter").handled).toBe(false);
        expect(expanded()).toEqual(["g0"]);
        const plain = setup({ getRowMeta: undefined });
        const toggles: unknown[] = [];
        plain.model.use((ctx, next) => {
            if (ctx.command.startsWith("row-groups.")) toggles.push(ctx);
            return next();
        });
        expect(plain.key(plain.activate(0), "Enter").handled).toBe(false);
        expect(toggles).toEqual([]);
    });

    it("Space toggles a tree's parent (a row that expands), by its key", () => {
        const { activate, key, expanded } = setup();
        const target = activate(5);
        expect(key(target, " ").handled).toBe(true);
        expect(expanded()).toEqual(["g0", 5]);
        key(target, " ");
        expect(expanded()).toEqual(["g0"]);
    });

    it("ranges from a group row toggled last: it is the anchor", () => {
        const { model, activate, key } = setup({ rowSelection: "multiple" });
        key(activate(1), " ", { shiftKey: true });
        key(activate(3), " ", { shiftKey: true });
        key(activate(3), "ArrowDown", { shiftKey: true });
        // from row 3, not from row 1: row 2 stays out
        expect(model.state.selectedRowKeys).toEqual([1, 3, 4]);
    });

    it("leave Shift+Space to the selection: a group row selects its rows", () => {
        const { model, activate, key, expanded } = setup({
            rowSelection: "multiple",
        });
        key(activate(0), " ", { shiftKey: true });
        expect(model.state.selectedRowKeys).toEqual([1, 2]);
        expect(expanded()).toEqual(["g0"]);
    });
});

describe("the arrows on a row's first column", () => {
    it("→ expands a collapsed row group, then moves", () => {
        const { model, activate, key, expanded } = setup();
        const target = activate(3);
        expect(key(target, "ArrowRight").handled).toBe(true);
        expect(expanded()).toEqual(["g0", "g1"]);
        expect(model.state.activePosition).toEqual({
            rowIndex: 3,
            columnIndex: 0,
        });
        key(target, "ArrowRight");
        expect(model.state.activePosition).toEqual({
            rowIndex: 3,
            columnIndex: 1,
        });
    });

    it("← collapses an expanded row group", () => {
        const { activate, key, expanded } = setup();
        key(activate(0), "ArrowLeft");
        expect(expanded()).toEqual([]);
    });

    it("← goes to the row a row is under", () => {
        const { model, activate, key } = setup();
        const press = key(activate(2), "ArrowLeft");
        expect(press.handled).toBe(true);
        expect(model.state.activePosition).toEqual({
            rowIndex: 0,
            columnIndex: 0,
        });
    });

    it("are plain moves on the other columns", () => {
        const { model, activate, key, expanded } = setup();
        key(activate(3, 1), "ArrowRight");
        key(activate(0, 1), "ArrowLeft");
        expect(expanded()).toEqual(["g0"]);
        expect(model.state.activePosition).toEqual({
            rowIndex: 0,
            columnIndex: 0,
        });
        key(activate(2, 1), "ArrowLeft");
        expect(model.state.activePosition).toEqual({
            rowIndex: 2,
            columnIndex: 0,
        });
    });

    it("act on the cell holding the row's toggle, and for a row with none on the toggles' column", () => {
        const { model, grid, activate, key, expanded } = setup();
        // the toggles in the second column, after a selection column
        cellElement(
            grid,
            3,
            1,
            `<button ${GROUP_TOGGLE_ATTRIBUTE}="3"></button>`,
        );
        cellElement(
            grid,
            0,
            1,
            `<button ${GROUP_TOGGLE_ATTRIBUTE}="0"></button>`,
        );
        const toggleCell = grid.querySelector(
            '[data-row-index="3"][data-column-index="1"]',
        );
        if (!toggleCell) throw new Error("no cell");
        model.run("active-position.set", { rowIndex: 3, columnIndex: 1 });
        key(toggleCell, "ArrowRight");
        expect(expanded()).toEqual(["g0", "g1"]);
        // the first column is a plain one there
        key(activate(3, 0), "ArrowRight");
        expect(model.state.activePosition).toEqual({
            rowIndex: 3,
            columnIndex: 1,
        });
        // a row with no toggle of its own: on the toggles' column, ← goes up, in that column
        key(activate(2, 1), "ArrowLeft");
        expect(model.state.activePosition).toEqual({
            rowIndex: 0,
            columnIndex: 1,
        });
    });

    it("remember the toggles' column for a row whose toggle is not rendered", () => {
        const { model, grid, activate, key } = setup();
        cellElement(
            grid,
            0,
            1,
            `<button ${GROUP_TOGGLE_ATTRIBUTE}="0"></button>`,
        );
        // found once (on a row of the tree)
        key(activate(2, 1), "ArrowLeft");
        expect(model.state.activePosition).toEqual({
            rowIndex: 0,
            columnIndex: 1,
        });
        // scrolled out of view: no toggle rendered, the column remembered
        for (const toggle of grid.querySelectorAll(
            `[${GROUP_TOGGLE_ATTRIBUTE}]`,
        )) {
            toggle.remove();
        }
        key(activate(2, 1), "ArrowLeft");
        expect(model.state.activePosition).toEqual({
            rowIndex: 0,
            columnIndex: 1,
        });
        // the first column is a plain one there
        key(activate(2, 0), "ArrowLeft");
        expect(model.state.activePosition).toEqual({
            rowIndex: 2,
            columnIndex: 0,
        });
        // new columns: found again (none rendered: the first column)
        model.run("columns.set", {
            columns: [
                { key: "c0", width: 100 },
                { key: "c1", width: 100 },
            ],
        });
        key(activate(2, 0), "ArrowLeft");
        expect(model.state.activePosition).toEqual({
            rowIndex: 0,
            columnIndex: 0,
        });
    });

    it("are plain on a row that neither expands nor sits under one", () => {
        const { model, activate, key } = setup();
        key(activate(4, 1), "ArrowLeft");
        expect(model.state.activePosition).toEqual({
            rowIndex: 4,
            columnIndex: 0,
        });
    });

    it("mirror right to left: ArrowLeft expands", () => {
        const { activate, key, expanded } = setup({ direction: "rtl" });
        key(activate(3), "ArrowLeft");
        expect(expanded()).toEqual(["g0", "g1"]);
        key(activate(3), "ArrowRight");
        expect(expanded()).toEqual(["g0"]);
    });

    it("go through the model: a middleware can refuse a toggle", () => {
        const { model, activate, key, expanded } = setup();
        model.use((ctx, next) =>
            ctx.command === "row-groups.toggle" ? veto() : next(),
        );
        key(activate(3), "ArrowRight");
        expect(expanded()).toEqual(["g0"]);
    });
});

describe("fitting columns", () => {
    /** Cells of column 0 for the header and the first rows, `widths` their contents' widths. */
    function measured(
        widths: readonly number[],
        options: DataGridModelOptions<{ id: number }>,
    ) {
        const grid = document.createElement("div");
        widths.forEach((content, index) => {
            fakeContentWidth(cellElement(grid, index - 1, 0), content);
        });
        return mountEngine({ rowCount: 10, ...options }, { grid });
    }

    it("measures a group row's cells: they are loaded", () => {
        const { engine, model } = measured([50, 250, 200, 70, 120, 999], {
            columns: [{ key: "c0", width: 100, resizable: true }],
            getRowMeta,
            getRow: (id) => (id === 4 ? undefined : { id }),
        });
        engine.run("fit-columns", {});
        // the group row 0 is the widest; row 4 (not loaded) is never measured
        expect(model.get("column-widths")).toEqual({ c0: 250 });
    });

    it("waits for a loaded data row to fit an autoSize column, then measures group rows too", () => {
        // every group collapsed: no data row yet, nothing fitted to the group cells
        const collapsed = measured([50, 180, 999, 999, 999], {
            columns: [{ key: "c0", width: 100, autoSize: true }],
            rowCount: 1,
            getRow: () => undefined,
            getRowMeta: () => ({ group: group("only", []) }),
        });
        expect(collapsed.engine.get("column-auto-widths")).toEqual({});
        // a group expanded: its data row loaded, the group row's cell measured with it
        const { engine } = measured([50, 180, 90, 999, 999], {
            columns: [{ key: "c0", width: 100, autoSize: true }],
            rowCount: 2,
            getRow: (id) => (id === 1 ? { id } : undefined),
            getRowMeta: (index) =>
                index === 0 ? { group: group("only", [1]) } : { depth: 1 },
        });
        expect(engine.get("column-auto-widths")).toEqual({ c0: 180 });
    });
});

describe("the toggle", () => {
    it("toggles its row's group on a Shift or Alt click too: a control, never a sort", () => {
        const { engine, grid, expanded } = setup();
        const cell = cellElement(
            grid,
            3,
            0,
            `<button ${GROUP_TOGGLE_ATTRIBUTE}="3">open</button>`,
        );
        const button = cell.querySelector("button");
        if (!button) throw new Error("no toggle");
        expect(click(engine, button, { shiftKey: true }).handled).toBe(true);
        expect(expanded()).toEqual(["g0", "g1"]);
        expect(click(engine, button, { altKey: true }).handled).toBe(true);
        expect(expanded()).toEqual(["g0"]);
    });

    it("toggles its row's group on a click", () => {
        const { engine, grid, expanded } = setup();
        const cell = cellElement(
            grid,
            3,
            0,
            `<button ${GROUP_TOGGLE_ATTRIBUTE}="3">open</button>`,
        );
        const button = cell.querySelector("button");
        if (!button) throw new Error("no toggle");
        expect(click(engine, button).handled).toBe(true);
        expect(expanded()).toEqual(["g0", "g1"]);
    });
});
