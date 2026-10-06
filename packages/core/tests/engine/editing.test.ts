// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    type CellEdit,
    type Column,
    cellPart,
    type DataGridModelOptions,
    EDITOR_ATTRIBUTE,
    type EditDraft,
} from "../../src";
import {
    cellElement,
    click,
    keydown,
    mountEngine,
    pointer,
    type Row,
    stubAnimationFrames,
} from "./harness";

// Cell editing on screen (Epic #88, E4.3): Enter, F2, a printable key or a double click edit an
// editable cell (a cell with controls and no edit stays an interaction); the engine keeps the
// draft, takes Enter, Tab and Escape from the editor (commit and move, cancel) and leaves it
// every other key; a press or focus outside the cell (and outside what the app marks as its
// editor's) commits; a commit is told when the value changed, and the grid writes nothing.

let frame: () => void;

beforeEach(() => {
    ({ frame } = stubAnimationFrames());
});

afterEach(() => {
    vi.unstubAllGlobals();
});

const COLUMNS: Column<Row>[] = [
    { key: "id", width: 100 },
    {
        key: "name",
        width: 100,
        editable: true,
        getValue: (row) => `n${row.id}`,
    },
    {
        key: "note",
        width: 100,
        editable: (row) => row.id % 2 === 0,
        getValue: (row) => row.id * 10,
    },
    { key: "c", width: 100 },
];

const at = (rowIndex: number, columnIndex: number) => ({
    rowIndex,
    columnIndex,
});

function setup(modelOptions: Partial<DataGridModelOptions<Row>> = {}) {
    const grid = document.createElement("div");
    const mounted = mountEngine(
        { columns: COLUMNS, rowCount: 100, ...modelOptions },
        { grid },
    );
    const { engine, model } = mounted;
    const edits: CellEdit[] = [];
    engine.subscribe("cell-edit", (edit) => edits.push(edit));
    const drafts: (EditDraft | null)[] = [];
    engine.subscribe("edit-draft", (draft) => drafts.push(draft));
    const cellAt = (rowIndex: number, columnIndex: number, html = "") =>
        cellElement(grid, rowIndex, columnIndex, html);
    /** the edited cell's editor, as an adapter renders it once the edit starts: an input */
    const editorIn = (cell: HTMLElement) => {
        const input = document.createElement("input");
        cell.append(input);
        mounted.commit();
        return input;
    };
    const editing = () => model.state.editingCell;
    return { ...mounted, grid, edits, drafts, cellAt, editorIn, editing };
}

describe("starting an edit", () => {
    it("Enter, F2 or a printable key on an editable active cell edit it, the key kept", () => {
        const { engine, cellAt, editing, drafts, model } = setup({
            activePosition: at(1, 1),
        });
        const cell = cellAt(1, 1);
        expect(keydown(engine, cell, "Enter").handled).toBe(true);
        expect(editing()).toEqual(at(1, 1));
        expect(drafts.at(-1)).toEqual({ value: "n1", initialValue: "n1" });
        expect(engine.get("edit-draft")).toBe(drafts.at(-1));
        model.run("editing-cell.clear", {});
        expect(drafts.at(-1)).toBeNull();
        keydown(engine, cell, "F2");
        expect(editing()).toEqual(at(1, 1));
        model.run("editing-cell.clear", {});
        const typed = keydown(engine, cell, "é");
        expect(typed.event.defaultPrevented).toBe(true);
        expect(editing()).toEqual({ ...at(1, 1), startKey: "é" });
        expect(engine.get("edit-draft")).toEqual({
            value: "n1",
            initialValue: "n1",
        });
    });

    it("leaves other keys, other cells and Shift+Space alone", () => {
        const { engine, cellAt, editing, model } = setup({
            activePosition: at(1, 2),
            rowSelection: "multiple",
        });
        // column 2 edits even rows only: row 1 is not editable
        expect(keydown(engine, cellAt(1, 2), "x").handled).toBe(false);
        model.run("active-position.set", at(1, 1));
        const cell = cellAt(1, 1);
        for (const [key, init] of [
            ["a", { ctrlKey: true }],
            ["Enter", { shiftKey: true }],
            ["ArrowDown", {}],
        ] as const) {
            keydown(engine, cell, key, init);
            expect(editing()).toBeNull();
            model.run("active-position.set", at(1, 1));
        }
        model.run("selected-rows.set", { rowKeys: [] });
        keydown(engine, cell, " ", { shiftKey: true });
        expect(editing()).toBeNull();
        expect(model.state.selectedRowKeys).toEqual([1]);
        // from the header: nothing to edit
        model.run("active-position.set", at(-1, 1));
        keydown(engine, cellAt(-1, 1), "Enter");
        expect(editing()).toBeNull();
    });

    it("keeps Enter and F2 a cell's interaction without an edit", () => {
        const { engine, cellAt, editing } = setup({
            activePosition: at(1, 3),
        });
        const cell = cellAt(1, 3, "<button>go</button>");
        keydown(engine, cell, "Enter");
        expect(editing()).toBeNull();
        expect(engine.get("interaction")).toEqual(at(1, 3));
    });

    it("edits on a double click on the cell, not on a control inside it", () => {
        const { engine, cellAt, editing } = setup({ activePosition: at(2, 2) });
        const cell = cellAt(2, 2, "<button>go</button>");
        const button = cell.querySelector("button");
        if (!button) throw new Error("no button");
        expect(click(engine, button, { detail: 2 }).handled).toBe(false);
        expect(editing()).toBeNull();
        expect(click(engine, cell, { detail: 2 }).handled).toBe(true);
        expect(editing()).toEqual(at(2, 2));
    });

    it("focuses the editor once rendered, and starts no interaction with it", () => {
        const { engine, cellAt, editorIn } = setup({
            activePosition: at(1, 1),
        });
        const cell = cellAt(1, 1);
        cell.focus();
        keydown(engine, cell, "Enter");
        const input = editorIn(cell);
        expect(document.activeElement).toBe(input);
        expect(engine.get("interaction")).toBeNull();
    });
});

describe("inside an edit", () => {
    it("Enter commits the draft and moves down, telling it once; Shift+Enter moves up", () => {
        const { engine, cellAt, editorIn, edits, editing, model } = setup({
            activePosition: at(2, 1),
        });
        const cell = cellAt(2, 1);
        keydown(engine, cell, "Enter");
        const input = editorIn(cell);
        engine.run("change-edit", { value: "renamed" });
        expect(engine.get("edit-draft")?.value).toBe("renamed");
        // keys of the editor's own: never the grid's
        expect(keydown(engine, input, "ArrowDown").handled).toBe(false);
        expect(keydown(engine, input, "a", { ctrlKey: true }).handled).toBe(
            false,
        );
        expect(model.state.activePosition).toEqual(at(2, 1));
        expect(keydown(engine, input, "Enter").handled).toBe(true);
        expect(edits).toEqual([
            { ...at(2, 1), columnKey: "name", value: "renamed" },
        ]);
        expect(editing()).toBeNull();
        expect(model.state.activePosition).toEqual(at(3, 1));
        // up
        const below = cellAt(3, 1);
        keydown(engine, below, "F2");
        const next = editorIn(below);
        engine.run("change-edit", { value: "up" });
        keydown(engine, next, "Enter", { shiftKey: true });
        expect(model.state.activePosition).toEqual(at(2, 1));
        expect(edits).toHaveLength(2);
    });

    it("Tab commits and moves to the next column, Shift+Tab to the previous one", () => {
        const { engine, cellAt, editorIn, edits, model } = setup({
            activePosition: at(2, 1),
        });
        const cell = cellAt(2, 1);
        keydown(engine, cell, "Enter");
        const input = editorIn(cell);
        // an unchanged value tells nothing
        const tab = keydown(engine, input, "Tab");
        expect(tab.event.defaultPrevented).toBe(true);
        expect(edits).toEqual([]);
        expect(model.state.activePosition).toEqual(at(2, 2));
        const beside = cellAt(2, 2);
        keydown(engine, beside, "Enter");
        engine.run("change-edit", { value: 7 });
        keydown(engine, editorIn(beside), "Tab", { shiftKey: true });
        expect(edits).toEqual([{ ...at(2, 2), columnKey: "note", value: 7 }]);
        expect(model.state.activePosition).toEqual(at(2, 1));
    });

    it("Escape cancels, telling nothing, focus back on the cell", () => {
        const { engine, cellAt, editorIn, edits, editing, model } = setup({
            activePosition: at(2, 1),
        });
        const cell = cellAt(2, 1);
        keydown(engine, cell, "Enter");
        const input = editorIn(cell);
        engine.run("change-edit", { value: "dropped" });
        expect(keydown(engine, input, "Escape").handled).toBe(true);
        expect(edits).toEqual([]);
        expect(editing()).toBeNull();
        expect(document.activeElement).toBe(cell);
        expect(model.state.activePosition).toEqual(at(2, 1));
    });

    it("leaves a key the consumer prevented, and a composition, to the editor", () => {
        const { engine, cellAt, editorIn, editing } = setup({
            activePosition: at(2, 1),
        });
        const edited = cellAt(2, 1);
        keydown(engine, edited, "Enter");
        const input = editorIn(edited);
        const prevented = new KeyboardEvent("keydown", {
            key: "Enter",
            cancelable: true,
        });
        Object.defineProperty(prevented, "target", { value: input });
        prevented.preventDefault();
        expect(engine.adapter.keydown(prevented)).toBe(false);
        expect(
            keydown(engine, input, "Enter", { isComposing: true }).handled,
        ).toBe(false);
        expect(editing()).toEqual(at(2, 1));
    });

    it("commits on a press outside the cell, but not inside it, on the viewport or on the app's marked editor", () => {
        const { engine, cellAt, editorIn, edits, editing, viewport } = setup({
            activePosition: at(2, 1),
        });
        const cell = cellAt(2, 1);
        keydown(engine, cell, "Enter");
        const input = editorIn(cell);
        engine.run("change-edit", { value: "kept" });
        const popover = document.createElement("div");
        popover.setAttribute(EDITOR_ATTRIBUTE, "");
        const option = document.createElement("span");
        popover.append(option);
        document.body.append(popover);
        for (const target of [input, cell, viewport, option]) {
            pointer(engine, target, "pointerdown", 10);
            pointer(engine, target, "pointerup", 10);
        }
        expect(editing()).toEqual(at(2, 1));
        const outside = document.createElement("button");
        document.body.append(outside);
        pointer(engine, outside, "pointerdown", 10);
        expect(edits).toEqual([
            { ...at(2, 1), columnKey: "name", value: "kept" },
        ]);
        expect(editing()).toBeNull();
        pointer(engine, outside, "pointerdown", 10);
        expect(edits).toHaveLength(1);
    });

    it("commits when focus leaves for an element outside the edit, not into the marked editor", () => {
        const { engine, cellAt, editorIn, edits, editing } = setup({
            activePosition: at(2, 1),
        });
        const edited = cellAt(2, 1);
        keydown(engine, edited, "Enter");
        const input = editorIn(edited);
        engine.run("change-edit", { value: "x" });
        const popover = document.createElement("input");
        popover.setAttribute(EDITOR_ATTRIBUTE, "");
        const elsewhere = document.createElement("input");
        document.body.append(popover, elsewhere);
        popover.focus();
        expect(editing()).toEqual(at(2, 1));
        input.focus();
        elsewhere.focus();
        expect(edits).toHaveLength(1);
        expect(editing()).toBeNull();
    });

    it("edit-cell changes nothing for a cell that cannot be edited, and commits another edit first", () => {
        const { engine, edits, editing, model, drafts } = setup({
            activePosition: at(1, 1),
        });
        // column 2 edits even rows only, column 0 none
        engine.run("edit-cell", at(3, 2));
        engine.run("edit-cell", at(5, 0));
        expect(model.state.activePosition).toEqual(at(1, 1));
        expect(drafts).toEqual([]);
        engine.run("edit-cell", at(1, 1));
        engine.run("change-edit", { value: "first" });
        engine.run("edit-cell", at(4, 2));
        expect(edits).toEqual([
            { ...at(1, 1), columnKey: "name", value: "first" },
        ]);
        expect(editing()).toEqual(at(4, 2));
        expect(model.state.activePosition).toEqual(at(4, 2));
        expect(engine.get("edit-draft")).toEqual({
            value: 40,
            initialValue: 40,
        });
    });

    it("focuses the editor of an edit-cell wherever focus was; cancels an edit with no editor", () => {
        const { engine, cellAt, editorIn, editing, commit } = setup({
            activePosition: at(1, 1),
        });
        const toolbar = document.createElement("button");
        document.body.append(toolbar);
        toolbar.focus();
        const cell = cellAt(2, 1);
        engine.run("edit-cell", at(2, 1));
        const input = editorIn(cell);
        expect(document.activeElement).toBe(input);
        engine.run("cancel-edit", {});
        // an editable cell rendering no editor: the edit is cancelled once it renders
        const bare = cellAt(3, 1);
        bare.focus();
        keydown(engine, bare, "Enter");
        expect(editing()).toEqual(at(3, 1));
        commit();
        expect(editing()).toBeNull();
        expect(document.activeElement).toBe(bare);
    });

    it("keeps the page keys of the edited cell itself from scrolling, its editor taking the others", () => {
        const { engine, cellAt, editing, model, commit } = setup({
            activePosition: at(2, 1),
        });
        const cell = cellAt(2, 1);
        model.run("editing-cell.set", at(2, 1));
        // its editor renders, but focus stays on the cell (a parent keeping the edit open)
        const input = document.createElement("input");
        cell.append(input);
        const own = document.createElement("input");
        document.body.append(own);
        own.focus();
        commit();
        cell.focus();
        const page = keydown(engine, cell, "PageDown");
        expect(page.handled).toBe(true);
        expect(page.event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(input);
        cell.focus();
        const typed = keydown(engine, cell, "x");
        expect(typed.event.defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(input);
        expect(editing()).toEqual(at(2, 1));
        expect(model.state.activePosition).toEqual(at(2, 1));
    });

    it("gives focus back to the active cell after a press that committed the edit focused nothing", () => {
        const { engine, cellAt, editorIn, editing, viewport, grid } = setup({
            activePosition: at(2, 1),
        });
        const cell = cellAt(2, 1);
        keydown(engine, cell, "Enter");
        const input = editorIn(cell);
        expect(document.activeElement).toBe(input);
        // a spot of the grid that takes no focus: focus lands on the viewport, then the cell
        const spot = document.createElement("div");
        grid.append(spot);
        pointer(engine, spot, "pointerdown", 10);
        expect(editing()).toBeNull();
        viewport.tabIndex = -1;
        viewport.focus();
        pointer(engine, spot, "pointerup", 10);
        expect(document.activeElement).toBe(cell);
        // a press outside that focuses something keeps it
        keydown(engine, cell, "Enter");
        editorIn(cell);
        const outside = document.createElement("input");
        document.body.append(outside);
        pointer(engine, outside, "pointerdown", 10);
        outside.focus();
        pointer(engine, outside, "pointerup", 10);
        expect(document.activeElement).toBe(outside);
    });

    it("commits and cancels through the engine's actions, an editor's onCommit and onCancel", () => {
        const { engine, cellAt, edits, editing, model } = setup({
            activePosition: at(4, 2),
        });
        engine.run("edit-cell", at(4, 2));
        expect(editing()).toEqual(at(4, 2));
        engine.run("commit-edit", { value: 99 });
        expect(edits).toEqual([{ ...at(4, 2), columnKey: "note", value: 99 }]);
        expect(model.state.activePosition).toEqual(at(4, 2));
        engine.run("edit-cell", at(6, 1));
        expect(model.state.activePosition).toEqual(at(6, 1));
        engine.run("change-edit", { value: "gone" });
        engine.run("cancel-edit", {});
        expect(edits).toHaveLength(1);
        expect(editing()).toBeNull();
        // `undefined` given is a value
        engine.run("edit-cell", at(6, 1));
        engine.run("commit-edit", { value: undefined });
        expect(edits.at(-1)).toEqual({
            ...at(6, 1),
            columnKey: "name",
            value: undefined,
        });
        expect(cellAt(6, 1)).toBeDefined();
    });

    it("drops the draft when the app moves the active cell, telling nothing", () => {
        const { engine, cellAt, edits, editing, model, drafts } = setup({
            activePosition: at(2, 1),
        });
        keydown(engine, cellAt(2, 1), "Enter");
        engine.run("change-edit", { value: "lost" });
        model.run("active-position.set", at(5, 1));
        expect(editing()).toBeNull();
        expect(drafts.at(-1)).toBeNull();
        expect(edits).toEqual([]);
        // another row coming under it (rows inserted above): the same
        model.run("active-position.set", at(2, 1));
        keydown(engine, cellAt(2, 1), "Enter");
        engine.run("change-edit", { value: "elsewhere" });
        model.run("data.set", {
            rowCount: 101,
            getRow: (index) => ({ id: index === 0 ? 500 : index - 1 }),
            rowKey: (row) => row.id,
        });
        expect(editing()).toBeNull();
        expect(drafts.at(-1)).toBeNull();
        expect(edits).toEqual([]);
    });

    it("ends a range's drag, and marks its cell's part as editing", () => {
        const { engine, cellAt, editing, view } = setup({
            activePosition: at(2, 1),
            cellSelection: "range",
        });
        const cell = cellAt(2, 1);
        pointer(engine, cell, "pointerdown", 150, { clientY: 80 });
        pointer(engine, cell, "pointermove", 160, { clientY: 80 });
        keydown(engine, cell, "Enter");
        expect(editing()).toEqual(at(2, 1));
        pointer(engine, cell, "pointermove", 250, { clientY: 160 });
        frame();
        expect(view().selectedRange).toBeNull();
        expect(
            cellPart(view(), { ...at(2, 1), loaded: true }).state.editing,
        ).toBe(true);
        expect(
            cellPart(view(), { ...at(2, 2), loaded: true }).state.editing,
        ).toBe(false);
        pointer(engine, cell, "pointerup", 250, { clientY: 160 });
    });
});
