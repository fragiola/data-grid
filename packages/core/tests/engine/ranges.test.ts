// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    type CellRange,
    type Column,
    type CommandEvent,
    cellPart,
    type DataGridModelOptions,
    type RangePaste,
    summaryCellPart,
    veto,
} from "../../src";
import {
    cellElement,
    keydown,
    type MountOptions,
    mountEngine,
    pointer,
    type Row,
    stubAnimationFrames,
} from "./harness";

// A range of cells on screen (Epic #88, E4.1–E4.2): Shift with the navigation keys moves its
// focus (the active cell its anchor), Ctrl/⌘+A selects every body cell, Escape and a plain move
// clear it; a press on a body cell drags one, the body's and the columns' edges scrolling (the
// pinned strips and scroll scaling alike, the cells from the axes); Shift+press reaches a cell;
// the parts tell the cells in it and their edges; a copy puts it on the clipboard as TSV and a
// paste is told as one event. A grid without cell selection is unchanged.

let frames: Map<number, FrameRequestCallback>;
let frame: () => void;

beforeEach(() => {
    ({ frames, frame } = stubAnimationFrames());
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// 20px rows under a 30px header in a 400 × 260 viewport: the body shows rows 0–11 (230px), 100px
// columns 0–3; cell (r, c) is at x 100c, y 30 + 20r in the view (jsdom lays it out at 0, 0)
const COLUMNS: Column<Row>[] = Array.from({ length: 8 }, (_, index) => ({
    key: `c${index}`,
    width: 100,
    getValue: (row: Row) => `${row.id}:${index}`,
}));
/** a cell's middle in the view: its x and y */
const xOf = (columnIndex: number, left = 0) => 100 * columnIndex + 50 - left;
const yOf = (rowIndex: number, top = 0) => 30 + 20 * rowIndex + 10 - top;

const at = (rowIndex: number, columnIndex: number) => ({
    rowIndex,
    columnIndex,
});
const range = (
    anchor: [number, number],
    focus: [number, number],
): CellRange => ({ anchor: at(...anchor), focus: at(...focus) });

function setup(
    modelOptions: Partial<DataGridModelOptions<Row>> = {},
    options: MountOptions = {},
) {
    const grid = document.createElement("div");
    const mounted = mountEngine(
        {
            columns: COLUMNS,
            rowCount: 1_000,
            cellSelection: "range",
            ...modelOptions,
        },
        { grid, ...options },
    );
    const { engine, model } = mounted;
    const commands: CommandEvent<Row>[] = [];
    model.subscribe((event) => commands.push(event));
    const pastes: RangePaste[] = [];
    engine.subscribe("range-paste", (paste) => pastes.push(paste));
    /** a cell's element, as an adapter renders it */
    const cellAt = (rowIndex: number, columnIndex: number, html = "") =>
        cellElement(grid, rowIndex, columnIndex, html);
    const press = (
        target: Element,
        type: string,
        x: number,
        y: number,
        init: PointerEventInit = {},
    ) => pointer(engine, target, type, x, { clientY: y, ...init });
    /** a press on a cell at its middle, moved past the slop, then to `x`, `y` (a frame later) */
    const drag = (
        target: Element,
        from: [number, number],
        x: number,
        y: number,
    ) => {
        press(target, "pointerdown", ...from);
        press(target, "pointermove", from[0] + 8, from[1]);
        press(target, "pointermove", x, y);
        frame();
    };
    const selected = () => model.state.selectedRange;
    return {
        ...mounted,
        grid,
        commands,
        pastes,
        cellAt,
        press,
        drag,
        selected,
    };
}

/** A copy or paste event from `target`, its clipboard a store of its own. */
function clipboardEvent(
    type: "copy" | "paste",
    target: Element,
    text = "",
): { event: ClipboardEvent; data: Map<string, string> } {
    const data = new Map<string, string>([["text/plain", text]]);
    const event = new Event(type, {
        bubbles: true,
        cancelable: true,
    }) as ClipboardEvent;
    Object.defineProperties(event, {
        target: { value: target },
        clipboardData: {
            value: {
                setData: (format: string, value: string) =>
                    data.set(format, value),
                getData: (format: string) => data.get(format) ?? "",
            },
        },
    });
    return { event, data };
}

describe("cell ranges by the keys", () => {
    it("Shift with the navigation keys moves the focus from the active cell, which stays", () => {
        const { engine, model, cellAt, selected, commands } = setup({
            activePosition: at(2, 1),
        });
        const cell = cellAt(2, 1);
        expect(
            keydown(engine, cell, "ArrowDown", { shiftKey: true }).handled,
        ).toBe(true);
        expect(selected()).toEqual(range([2, 1], [3, 1]));
        keydown(engine, cell, "ArrowRight", { shiftKey: true });
        keydown(engine, cell, "ArrowRight", { shiftKey: true });
        expect(selected()).toEqual(range([2, 1], [3, 3]));
        keydown(engine, cell, "Home", { shiftKey: true });
        expect(selected()).toEqual(range([2, 1], [3, 0]));
        keydown(engine, cell, "End", { shiftKey: true, ctrlKey: true });
        expect(selected()).toEqual(range([2, 1], [999, 7]));
        // the focus scrolled into view; the active cell never moved
        expect(engine.get("scroll-position").top).toBe(20_000 - 230);
        expect(model.state.activePosition).toEqual(at(2, 1));
        // one command a key
        expect(commands.map((event) => event.command)).toEqual(
            Array(5).fill("selected-range.extend"),
        );
    });

    it("pages by the rows in view, and moves right to left mirrored", () => {
        const { engine, cellAt, selected, model } = setup({
            activePosition: at(0, 2),
            direction: "rtl",
        });
        const cell = cellAt(0, 2);
        keydown(engine, cell, "PageDown", { shiftKey: true });
        expect(selected()).toEqual(range([0, 2], [11, 2]));
        // ArrowLeft is the next column right to left
        keydown(engine, cell, "ArrowLeft", { shiftKey: true });
        expect(selected()).toEqual(range([0, 2], [11, 3]));
        expect(model.state.activePosition).toEqual(at(0, 2));
    });

    it("Ctrl/⌘+A selects every body cell, from a header cell too; Escape and a plain move clear", () => {
        const { engine, cellAt, selected, model, commands } = setup({
            activePosition: at(1, 1),
        });
        const header = cellAt(-1, 0);
        const all = keydown(engine, header, "a", { ctrlKey: true });
        expect(all.handled).toBe(true);
        expect(all.event.defaultPrevented).toBe(true);
        expect(selected()).toEqual(range([0, 0], [999, 7]));
        // on a Greek layout: "α", the A key's place
        model.run("selected-range.clear", {});
        keydown(engine, header, "α", { ctrlKey: true, code: "KeyA" });
        expect(selected()).toEqual(range([0, 0], [999, 7]));
        // a held key repeats nothing
        commands.length = 0;
        keydown(engine, header, "a", { metaKey: true, repeat: true });
        expect(commands).toEqual([]);
        const cleared = keydown(engine, cellAt(1, 1), "Escape");
        expect(cleared.handled).toBe(true);
        expect(selected()).toBeNull();
        // without a range, Escape is not the grid's
        expect(keydown(engine, cellAt(1, 1), "Escape").handled).toBe(false);
        keydown(engine, cellAt(1, 1), "ArrowDown", { shiftKey: true });
        expect(selected()).not.toBeNull();
        keydown(engine, cellAt(1, 1), "ArrowDown");
        expect(selected()).toBeNull();
        expect(model.state.activePosition).toEqual(at(2, 1));
    });

    it("takes Shift+↑/↓ and Ctrl/⌘+A from the rows' selection; Shift+Space stays the rows'", () => {
        const { engine, cellAt, selected, model } = setup({
            activePosition: at(1, 0),
            rowSelection: "multiple",
        });
        const cell = cellAt(1, 0);
        keydown(engine, cell, "ArrowDown", { shiftKey: true });
        expect(selected()).toEqual(range([1, 0], [2, 0]));
        expect(model.state.selectedRowKeys).toEqual([]);
        keydown(engine, cell, "a", { ctrlKey: true });
        expect(model.state.selectedRowKeys).toEqual([]);
        keydown(engine, cell, " ", { shiftKey: true });
        expect(model.state.selectedRowKeys).toEqual([1]);
    });

    it("moves nothing from a header or a summary row cell, nor what a middleware refuses", () => {
        const { engine, cellAt, selected, model } = setup({
            activePosition: at(1, 0),
            summaryRows: { bottom: 1 },
        });
        // from the header, Shift+↓ is a plain move
        keydown(engine, cellAt(-1, 0), "ArrowDown", { shiftKey: true });
        expect(selected()).toBeNull();
        expect(
            keydown(engine, cellAt(1_000, 0), "ArrowUp", { shiftKey: true })
                .handled,
        ).toBe(true);
        expect(selected()).toBeNull();
        model.use((ctx, next) =>
            ctx.command === "selected-range.extend" ? veto() : next(),
        );
        model.run("active-position.set", at(1, 0));
        const refused = keydown(engine, cellAt(1, 0), "ArrowDown", {
            shiftKey: true,
        });
        expect(refused.handled).toBe(true);
        expect(selected()).toBeNull();
        expect(engine.get("scroll-position").top).toBe(0);
    });
});

describe("cell ranges by the pointer", () => {
    it("drags a range from the pressed cell, set once the pointer reaches another cell", () => {
        const { cellAt, drag, press, selected, commands, engine } = setup();
        const cell = cellAt(1, 1);
        drag(cell, [xOf(1), yOf(1)], xOf(3), yOf(4));
        expect(selected()).toEqual(range([1, 1], [4, 3]));
        expect(commands.map((event) => event.command)).toEqual([
            "selected-range.set",
        ]);
        // a frame at most: moves in between set nothing until it runs
        press(cell, "pointermove", xOf(2), yOf(5));
        press(cell, "pointermove", xOf(2), yOf(6));
        expect(selected()).toEqual(range([1, 1], [4, 3]));
        frame();
        expect(selected()).toEqual(range([1, 1], [6, 2]));
        // the release reaches the cell under it
        press(cell, "pointerup", xOf(0), yOf(0));
        expect(selected()).toEqual(range([1, 1], [0, 0]));
        expect(engine.get("scroll-position")).toEqual({ top: 0, left: 0 });
        // a new press clears it
        press(cellAt(5, 1), "pointerdown", xOf(1), yOf(5));
        expect(selected()).toBeNull();
        press(cellAt(5, 1), "pointerup", xOf(1), yOf(5));
        expect(selected()).toBeNull();
    });

    it("scrolls near the body's and the columns' edges, on both axes at once", () => {
        const { cellAt, drag, press, selected, engine } = setup();
        const cell = cellAt(1, 1);
        // into the bottom zone (220–260) and the end zone (360–400), 20px in: half speed
        drag(cell, [xOf(1), yOf(1)], 380, 240);
        expect(engine.get("scroll-position")).toEqual({ top: 10, left: 10 });
        expect(frames.size).toBe(1);
        frame();
        expect(engine.get("scroll-position")).toEqual({ top: 20, left: 20 });
        // the cell under the pointer, from the axes: y 240 is 230 into the rows scrolled 20, x
        // 380 is 400 into the columns scrolled 20
        expect(selected()).toEqual(range([1, 1], [11, 4]));
        // past the edges: full speed, to the end
        press(cell, "pointermove", 450, 300);
        for (let i = 0; i < 2_000 && frames.size > 0; i++) frame();
        expect(engine.get("scroll-position")).toEqual({
            top: 20_000 - 230,
            left: 800 - 400,
        });
        expect(selected()).toEqual(range([1, 1], [999, 7]));
        // back up and to the start
        press(cell, "pointermove", 0, 0);
        frame();
        expect(engine.get("scroll-position")).toEqual({
            top: 20_000 - 230 - 20,
            left: 400 - 20,
        });
        press(cell, "pointerup", 0, 0);
        expect(frames.size).toBe(0);
    });

    it("selects the pinned columns under the pointer, scrolling only from the scrolling columns' edges", () => {
        const pinned = COLUMNS.map((column, index) =>
            index === 0
                ? { ...column, pinned: "start" as const }
                : index === 7
                  ? { ...column, pinned: "end" as const }
                  : column,
        );
        const { cellAt, drag, press, selected, engine } = setup({
            columns: pinned,
        });
        engine.run("scroll-to", { left: 200 });
        const cell = cellAt(1, 4);
        const left = () => engine.get("scroll-position").left;
        // the view: c0 at 0–100, the columns that scroll from 100 to 300 (c3 at 100–200,
        // scrolled 200), c7 at 300–400; their edge zones 100–140 and 260–300
        drag(cell, [xOf(4, 200), yOf(1)], 350, yOf(2));
        expect(selected()).toEqual(range([1, 4], [2, 7]));
        // over a pinned strip: its column, nothing scrolls sideways
        expect(left()).toBe(200);
        expect(frames.size).toBe(0);
        press(cell, "pointermove", 50, yOf(2));
        frame();
        expect(selected()).toEqual(range([1, 4], [2, 0]));
        expect(left()).toBe(200);
        expect(frames.size).toBe(0);
        // in the scrolling columns' end zone, 20px in: half speed toward the end
        press(cell, "pointermove", 280, yOf(2));
        frame();
        expect(left()).toBe(210);
        // and in their start zone, back
        press(cell, "pointermove", 120, yOf(2));
        frame();
        expect(left()).toBe(200);
        press(cell, "pointerup", 120, yOf(2));
        // a range among the pinned columns alone scrolls nothing
        const first = cellAt(3, 0);
        drag(first, [xOf(0), yOf(3)], 20, yOf(5));
        expect(selected()).toEqual(range([3, 0], [5, 0]));
        expect(left()).toBe(200);
        expect(frames.size).toBe(0);
        press(first, "pointerup", 20, yOf(5));
    });

    it("keeps a drag through rows growing at the end (infinite scrolling) and same-keyed columns", () => {
        const getRow = (id: number) => ({ id });
        const { cellAt, drag, press, selected, model } = setup({
            rowKey: (row) => row.id,
        });
        const cell = cellAt(1, 1);
        drag(cell, [xOf(1), yOf(1)], xOf(2), 250);
        expect(frames.size).toBe(1);
        // more rows behind the same keys, a new getter, a new columns array: it goes on
        model.run("data.set", { rowCount: 2_000, getRow });
        model.run("columns.set", { columns: [...COLUMNS] });
        expect(frames.size).toBe(1);
        press(cell, "pointermove", xOf(3), yOf(2));
        frame();
        press(cell, "pointerup", xOf(3), yOf(2));
        // still dragging: the range reached the pointer's column
        expect(selected()?.anchor).toEqual(at(1, 1));
        expect(selected()?.focus.columnIndex).toBe(3);
    });

    it("ends a drag when other rows or columns come under its anchor", () => {
        const { cellAt, drag, press, selected, model } = setup({
            rowKey: (row) => row.id,
        });
        const cell = cellAt(1, 1);
        drag(cell, [xOf(1), yOf(1)], xOf(2), 250);
        expect(frames.size).toBe(1);
        // the rows sorted again: another row at its anchor (the range goes with it)
        model.run("data.set", {
            rowCount: 1_000,
            getRow: (index) => ({ id: 999 - index }),
        });
        frame();
        expect(frames.size).toBe(0);
        expect(selected()).toBeNull();
        press(cell, "pointermove", xOf(3), yOf(2));
        frame();
        press(cell, "pointerup", xOf(3), yOf(2));
        expect(selected()).toBeNull();
        // a column hidden at its anchor
        drag(cell, [xOf(1), yOf(1)], xOf(2), yOf(3));
        expect(selected()?.focus.columnIndex).toBe(2);
        model.run("columns.set", {
            columns: COLUMNS.filter((_, index) => index !== 1),
        });
        press(cell, "pointermove", xOf(0), yOf(5));
        frame();
        press(cell, "pointerup", xOf(0), yOf(5));
        expect(selected()).toBeNull();
    });

    it("starts no drag and selects nothing from a Shift+press whose extend is refused", () => {
        const { cellAt, press, selected, model, commands } = setup({
            activePosition: at(1, 1),
        });
        model.use((ctx, next) =>
            ctx.command.startsWith("selected-range.") ? veto() : next(),
        );
        const target = cellAt(4, 2);
        const down = press(target, "pointerdown", xOf(2), yOf(4), {
            shiftKey: true,
        });
        expect(down.defaultPrevented).toBe(true);
        press(target, "pointermove", xOf(3), yOf(6), { shiftKey: true });
        frame();
        press(target, "pointerup", xOf(3), yOf(6));
        expect(selected()).toBeNull();
        expect(frames.size).toBe(0);
        expect(commands).toEqual([]);
    });

    it("reads the pointer from the view's right edge right to left", () => {
        const { cellAt, drag, press, selected } = setup({ direction: "rtl" });
        // the 400px view's start is its right edge: column c's middle at x 400 - (100c + 50)
        const cell = cellAt(1, 0);
        drag(cell, [400 - xOf(0), yOf(1)], 400 - xOf(2), yOf(3));
        expect(selected()).toEqual(range([1, 0], [3, 2]));
        press(cell, "pointerup", 400 - xOf(2), yOf(3));
    });

    it("works under scroll scaling: the cells are the virtual ones", () => {
        const { cellAt, drag, press, selected, engine } = setup(
            { rowCount: 1_000_000 },
            { maxScrollSize: 100_000 },
        );
        expect(engine.get("scroll-scaled").rows).toBe(true);
        engine.run("scroll-to", { top: 10_000_000 });
        // 10M / 20: row 500000 at the body's top
        const cell = cellAt(500_001, 0);
        drag(cell, [xOf(0), yOf(1)], xOf(2), yOf(4));
        expect(selected()).toEqual(range([500_001, 0], [500_004, 2]));
        press(cell, "pointerup", xOf(2), yOf(4));
    });

    it("Shift+press reaches the cell from the anchor, prevented, and drags on from there", () => {
        const { cellAt, press, selected, model, engine } = setup({
            activePosition: at(2, 2),
        });
        const target = cellAt(5, 3);
        const down = press(target, "pointerdown", xOf(3), yOf(5), {
            shiftKey: true,
        });
        expect(down.defaultPrevented).toBe(true);
        expect(selected()).toEqual(range([2, 2], [5, 3]));
        expect(model.state.activePosition).toEqual(at(2, 2));
        press(target, "pointermove", xOf(3) + 8, yOf(5), { shiftKey: true });
        press(target, "pointermove", xOf(1), yOf(7), { shiftKey: true });
        frame();
        expect(selected()).toEqual(range([2, 2], [7, 1]));
        press(target, "pointerup", xOf(1), yOf(7));
        // with a range, from its anchor
        press(cellAt(0, 0), "pointerdown", xOf(0), yOf(0), { shiftKey: true });
        expect(selected()).toEqual(range([2, 2], [0, 0]));
        press(cellAt(0, 0), "pointerup", xOf(0), yOf(0));
        // a click ending a drag is the drag's
        expect(engine.get("scroll-position").top).toBe(0);
    });

    it("cancels on Escape, clearing the range; and is no press on a control, a header or with Ctrl", () => {
        const { cellAt, drag, press, selected, engine } = setup();
        const cell = cellAt(1, 1);
        drag(cell, [xOf(1), yOf(1)], xOf(2), yOf(3));
        expect(selected()).not.toBeNull();
        const cleared = keydown(engine, cell, "Escape");
        expect(cleared.handled).toBe(true);
        expect(selected()).toBeNull();
        press(cell, "pointerup", xOf(2), yOf(3));
        const button = cellAt(4, 1, "<button>go</button>").querySelector(
            "button",
        );
        if (!button) throw new Error("no button");
        for (const [target, init] of [
            [button, {}],
            [cellAt(-1, 2), {}],
            [cellAt(6, 2), { ctrlKey: true }],
        ] as const) {
            const event = new PointerEvent("pointerdown", {
                bubbles: true,
                cancelable: true,
                button: 0,
                buttons: 1,
                pointerId: 1,
                ...init,
            });
            target.dispatchEvent(event);
            expect(engine.adapter.pointerdown(event)).toBe(false);
        }
    });

    it("drags nothing from a touch: it scrolls; its press clears the range as a click's", () => {
        const { cellAt, press, selected, model, engine } = setup({
            selectedRange: range([0, 0], [1, 1]),
        });
        const cell = cellAt(3, 1);
        const down = press(cell, "pointerdown", xOf(1), yOf(3), {
            pointerType: "touch",
        });
        expect(down.defaultPrevented).toBe(false);
        expect(selected()).toBeNull();
        press(cell, "pointermove", xOf(1), yOf(6), { pointerType: "touch" });
        frame();
        expect(selected()).toBeNull();
        press(cell, "pointerup", xOf(1), yOf(6), { pointerType: "touch" });
        expect(model.state.selectedRange).toBeNull();
        expect(engine.get("scroll-position").top).toBe(0);
    });

    it("ends a drag when cells stop being selectable", () => {
        const { cellAt, drag, press, model, engine } = setup();
        const cell = cellAt(1, 1);
        drag(cell, [xOf(1), yOf(1)], xOf(1), 250);
        expect(frames.size).toBe(1);
        model.run("cell-selection.set", { cellSelection: null });
        frame();
        expect(frames.size).toBe(0);
        expect(model.state.selectedRange).toBeNull();
        press(cell, "pointerup", xOf(1), 250);
        expect(engine.get("scroll-position").top).toBeGreaterThan(0);
    });
});

describe("cell ranges' parts", () => {
    it("tell a cell in the range, its edges and its aria-selected; a summary row's none", () => {
        const { model, view } = setup({
            selectedRange: range([3, 3], [1, 1]),
            summaryRows: { top: 1 },
        });
        const part = (rowIndex: number, columnIndex: number) =>
            cellPart(view(), { rowIndex, columnIndex, loaded: true });
        expect(part(1, 1).state).toMatchObject({
            selected: true,
            rangeEdges: "top start",
        });
        expect(part(1, 1).ariaSelected).toBe(true);
        expect(part(2, 2).state).toMatchObject({ selected: true });
        expect(part(2, 2).state.rangeEdges).toBeUndefined();
        expect(part(3, 3).state.rangeEdges).toBe("bottom end");
        expect(part(4, 1).state.selected).toBe(false);
        expect(part(4, 1).ariaSelected).toBe(false);
        const summary = summaryCellPart(view(), {
            rowIndex: -2,
            columnIndex: 1,
            position: "top",
            summaryIndex: 0,
        });
        expect(summary.state.selected).toBeUndefined();
        expect(summary.ariaSelected).toBeUndefined();
        // a new view only when the range changes
        const before = view();
        model.run("selected-range.set", range([1, 1], [3, 3]));
        expect(view()).not.toBe(before);
        expect(part(1, 1).state.rangeEdges).toBe("top start");
    });

    it("leave a grid without cell selection unchanged: no state, no keys, no press, no clipboard", () => {
        const { model, engine, view, cellAt, pastes } = setup({
            cellSelection: undefined,
            activePosition: at(1, 1),
            rowSelection: "multiple",
        });
        const part = cellPart(view(), {
            rowIndex: 1,
            columnIndex: 1,
            loaded: true,
        });
        expect(part.state.selected).toBeUndefined();
        expect(part.state.rangeEdges).toBeUndefined();
        expect(part.ariaSelected).toBeUndefined();
        const cell = cellAt(1, 1);
        // the rows' keys, as before
        keydown(engine, cell, "ArrowDown", { shiftKey: true });
        expect(model.state.selectedRowKeys).toEqual([1, 2]);
        expect(model.state.selectedRange).toBeNull();
        const event = new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            button: 0,
            buttons: 1,
            pointerId: 1,
        });
        cell.dispatchEvent(event);
        expect(engine.adapter.pointerdown(event)).toBe(false);
        const copy = clipboardEvent("copy", cell);
        expect(engine.adapter.copy(copy.event)).toBe(false);
        expect(copy.event.defaultPrevented).toBe(false);
        const paste = clipboardEvent("paste", cell, "a\tb");
        expect(engine.adapter.paste(paste.event)).toBe(false);
        expect(pastes).toEqual([]);
    });
});

describe("the clipboard", () => {
    it("copies the range as TSV from one of the grid's cells, else the active cell", () => {
        const { engine, model, cellAt } = setup({
            activePosition: at(2, 1),
            selectedRange: range([3, 2], [2, 1]),
        });
        const cell = cellAt(2, 1);
        const { event, data } = clipboardEvent("copy", cell);
        expect(engine.adapter.copy(event)).toBe(true);
        expect(event.defaultPrevented).toBe(true);
        expect(data.get("text/plain")).toBe("2:1\t2:2\n3:1\t3:2");
        model.run("selected-range.clear", {});
        const single = clipboardEvent("copy", cell);
        expect(engine.adapter.copy(single.event)).toBe(true);
        expect(single.data.get("text/plain")).toBe("2:1");
    });

    it("holds a selection for Ctrl/⌘+C while the page's is collapsed, put back after the copy", () => {
        const { engine, cellAt, model } = setup({
            activePosition: at(2, 1),
            selectedRange: range([2, 1], [3, 2]),
        });
        const cell = cellAt(2, 1);
        const selection = document.getSelection();
        if (!selection) throw new Error("no selection");
        selection.removeAllRanges();
        const key = keydown(engine, cell, "c", { ctrlKey: true });
        // never the grid's key: the page's copy follows
        expect(key.handled).toBe(false);
        expect(key.event.defaultPrevented).toBe(false);
        const node = cell.lastElementChild;
        expect(node?.getAttribute("aria-hidden")).toBe("true");
        expect(selection.isCollapsed).toBe(false);
        expect(
            selection.anchorNode && node?.contains(selection.anchorNode),
        ).toBe(true);
        // the copy comes from the node the selection is in: the cell's range is copied
        if (!node) throw new Error("no node");
        const { event, data } = clipboardEvent("copy", node);
        expect(engine.adapter.copy(event)).toBe(true);
        expect(data.get("text/plain")).toBe("2:1\t2:2\n3:1\t3:2");
        expect(cell.contains(node)).toBe(false);
        expect(selection.rangeCount).toBe(0);
        // nothing to copy (no range, the active cell a header's): nothing held
        model.run("active-position.set", at(-1, 0));
        const header = cellAt(-1, 0);
        keydown(engine, header, "c", { metaKey: true });
        expect(header.childElementCount).toBe(0);
    });

    it("takes the copy from a page's selection elsewhere, leaves one in the cell, and drops its node with the next task", async () => {
        const { engine, cellAt } = setup({ activePosition: at(1, 1) });
        const cell = cellAt(1, 1);
        const text = document.createElement("p");
        text.textContent = "page text";
        document.body.append(text);
        const selection = document.getSelection();
        if (!selection) throw new Error("no selection");
        // text selected elsewhere on the page would take the copy: the cell's node holds it
        selection.selectAllChildren(text);
        keydown(engine, cell, "c", { ctrlKey: true });
        expect(cell.childElementCount).toBe(1);
        expect(cell.contains(selection.anchorNode)).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(cell.childElementCount).toBe(0);
        // the page's selection put back
        expect(String(selection)).toBe("page text");
        // text selected in the cell itself copies as it is
        const content = document.createElement("span");
        content.textContent = "cell text";
        cell.append(content);
        selection.selectAllChildren(content);
        keydown(engine, cell, "c", { ctrlKey: true });
        expect(cell.childElementCount).toBe(1);
        expect(String(selection)).toBe("cell text");
        content.remove();
        selection.removeAllRanges();
        keydown(engine, cell, "c", { ctrlKey: true });
        expect(cell.childElementCount).toBe(1);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(cell.childElementCount).toBe(0);
        expect(selection.rangeCount).toBe(0);
    });

    it("holds a selection in the cell for Ctrl/⌘+V too, whatever the page's, put back after the paste (Epic #89)", () => {
        const { engine, cellAt, pastes } = setup({ activePosition: at(1, 1) });
        const cell = cellAt(1, 1);
        const text = document.createElement("p");
        text.textContent = "page text";
        document.body.append(text);
        const selection = document.getSelection();
        if (!selection) throw new Error("no selection");
        // Firefox fires a paste at the selection, not at the focused cell: the cell's node holds it
        selection.selectAllChildren(text);
        const key = keydown(engine, cell, "v", { metaKey: true });
        expect(key.handled).toBe(false);
        expect(key.event.defaultPrevented).toBe(false);
        const node = cell.lastElementChild;
        if (!node) throw new Error("no node");
        expect(node.contains(selection.anchorNode)).toBe(true);
        // the paste comes from the node: the grid's, landing at the active cell
        const { event } = clipboardEvent("paste", node, "a");
        expect(engine.adapter.paste(event)).toBe(true);
        expect(pastes).toEqual([
            { range: range([1, 1], [1, 1]), values: [["a"]] },
        ]);
        expect(cell.contains(node)).toBe(false);
        expect(String(selection)).toBe("page text");
        // a layout whose letters are not Latin (Cyrillic: м on V, с on C): the key's place
        const russian = { ctrlKey: true, code: "KeyV" };
        keydown(engine, cell, "м", russian);
        expect(cell.lastElementChild?.getAttribute("aria-hidden")).toBe("true");
        const held = cell.lastElementChild;
        if (!held) throw new Error("no node");
        expect(
            engine.adapter.paste(clipboardEvent("paste", held, "b").event),
        ).toBe(true);
        keydown(engine, cell, "с", { ctrlKey: true, code: "KeyC" });
        const copied = cell.lastElementChild;
        if (!copied) throw new Error("no node");
        const copy = clipboardEvent("copy", copied);
        expect(engine.adapter.copy(copy.event)).toBe(true);
        expect(copy.data.get("text/plain")).toBe("1:1");
        // a Latin layout's own letters win over their place (Dvorak's j is on C)
        keydown(engine, cell, "j", { ctrlKey: true, code: "KeyC" });
        expect(cell.childElementCount).toBe(0);
        // even text selected inside the cell: a paste into a cell is the grid's
        const content = document.createElement("span");
        content.textContent = "cell text";
        cell.append(content);
        selection.selectAllChildren(content);
        keydown(engine, cell, "v", { ctrlKey: true });
        expect(cell.childElementCount).toBe(2);
        expect(String(selection)).not.toBe("cell text");
        content.remove();
        text.remove();
    });

    it("leaves a field's copy, a prevented one and one with no body cell to copy alone", () => {
        const { engine, model, cellAt } = setup({ activePosition: at(-1, 0) });
        const header = cellAt(-1, 0);
        expect(engine.adapter.copy(clipboardEvent("copy", header).event)).toBe(
            false,
        );
        model.run("active-position.set", at(1, 1));
        const input = cellAt(1, 1, "<input>").querySelector("input");
        if (!input) throw new Error("no input");
        expect(engine.adapter.copy(clipboardEvent("copy", input).event)).toBe(
            false,
        );
        const prevented = clipboardEvent("copy", cellAt(1, 1));
        prevented.event.preventDefault();
        expect(engine.adapter.copy(prevented.event)).toBe(false);
        // a grid nested in a cell: its cells are its own
        const outside = document.createElement("div");
        outside.dataset.rowIndex = "1";
        outside.dataset.columnIndex = "1";
        document.body.append(outside);
        expect(engine.adapter.copy(clipboardEvent("copy", outside).event)).toBe(
            false,
        );
    });

    it("tells a paste once, from the range's first cell, sized by the values and cut at the edges", () => {
        const { engine, cellAt, pastes, model } = setup({
            activePosition: at(998, 6),
            selectedRange: range([999, 7], [998, 6]),
        });
        const cell = cellAt(998, 6);
        const { event } = clipboardEvent(
            "paste",
            cell,
            "a\tb\tc\r\nd\te\r\nf\r\n",
        );
        expect(engine.adapter.paste(event)).toBe(true);
        expect(event.defaultPrevented).toBe(true);
        expect(pastes).toEqual([
            {
                range: range([998, 6], [999, 7]),
                values: [
                    ["a", "b"],
                    ["d", "e"],
                ],
            },
        ]);
        // the grid writes nothing, and selects nothing new
        expect(model.state.selectedRange).toEqual(range([999, 7], [998, 6]));
        // without a range, at the active cell; no text, nothing
        model.run("selected-range.clear", {});
        engine.adapter.paste(clipboardEvent("paste", cell, "x").event);
        expect(pastes[1]).toEqual({
            range: range([998, 6], [998, 6]),
            values: [["x"]],
        });
        const empty = clipboardEvent("paste", cell, "");
        expect(engine.adapter.paste(empty.event)).toBe(false);
        expect(empty.event.defaultPrevented).toBe(false);
        expect(pastes).toHaveLength(2);
    });
});
