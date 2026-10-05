// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    type DataGridModelOptions,
    ROW_DRAG_HANDLE_ATTRIBUTE,
    type RowMove,
    type RowReorder,
    rowDragHandlePart,
    rowPart,
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
import { stateOf, viewOf } from "./views";

// Row reordering on screen (Epic #86, E2.3): a press on a row's drag handle drags past a click's
// slop, its target worked out from the row axis (off screen, variable heights and details alike),
// the body's edges scroll, a release tells one move and Escape, `pointercancel` or a lost capture
// cancel; its click is the drag's; Ctrl/⌘+Shift+↑/↓ move a row by one; sorted, or not loaded, a
// row does not move; the active cell follows its row once the app moved it; the parts tell the
// state. The grid never orders the rows: the moves are events.

let frames: Map<number, FrameRequestCallback>;
let frame: () => void;

beforeEach(() => {
    ({ frames, frame } = stubAnimationFrames());
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// 20px rows under a 30px header in a 260px viewport: the body shows rows 0–11 (230px), and row
// `i` is at y 30 + 20i in the view (jsdom lays the viewport out at 0, 0)
const ROW = 20;
const TOP = 30;
/** the y of a row's cells' middle in the view, scrolled to `top` */
const middleOf = (rowIndex: number, top = 0) =>
    TOP + rowIndex * ROW + ROW / 2 - top;

function setup(
    modelOptions: Partial<DataGridModelOptions<Row>> = {},
    options: MountOptions = {},
) {
    const grid = document.createElement("div");
    const mounted = mountEngine(
        {
            columns: [
                { key: "a", width: 100 },
                { key: "b", width: 100 },
            ],
            rowCount: 1_000,
            rowKey: (row) => `r${row.id}`,
            ...modelOptions,
        },
        { grid, reorderableRows: true, ...options },
    );
    const { model, engine } = mounted;
    /** a row's first cell holding its drag handle, as an app renders it */
    const handleOf = (rowIndex: number) => {
        const cell = cellElement(grid, rowIndex, 0);
        const handle = document.createElement("span");
        handle.setAttribute(ROW_DRAG_HANDLE_ATTRIBUTE, String(rowIndex));
        handle.setPointerCapture = vi.fn();
        cell.append(handle);
        return { cell, handle };
    };
    const press = (
        target: Element,
        type: string,
        clientY: number,
        init: PointerEventInit = {},
    ) => pointer(engine, target, type, 10, { clientY, ...init });
    /** a primary press on `target` handed to the engine: whether it took it */
    const pressed = (target: Element, clientY: number) => {
        const event = new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            button: 0,
            buttons: 1,
            pointerId: 1,
            clientX: 10,
            clientY,
        });
        target.dispatchEvent(event);
        const taken = engine.adapter.pointerdown(event);
        // released at once: the next press is a new one
        pointer(engine, target, "pointerup", 10, { clientY });
        return taken;
    };
    /** a press on `target` at `from`, moved past the slop, then to `to` (a frame later) */
    const drag = (target: Element, from: number, to: number) => {
        press(target, "pointerdown", from);
        press(target, "pointermove", from + 10);
        press(target, "pointermove", to);
        frame();
    };
    const moves: RowMove[] = [];
    engine.subscribe("row-move", (move) => moves.push(move));
    const reorders: (RowReorder | null)[] = [];
    engine.subscribe("row-reorder", (value) => reorders.push(value));
    const target = () => engine.get("row-reorder");
    /** the app applies a move: its rows (ids by index) in the new order, as a new source */
    let ids = Array.from({ length: 1_000 }, (_, index) => index);
    const apply = ({ fromIndex, toIndex }: RowMove) => {
        const rest = ids.filter((_, index) => index !== fromIndex);
        ids = [
            ...rest.slice(0, toIndex),
            ...ids.slice(fromIndex, fromIndex + 1),
            ...rest.slice(toIndex),
        ];
        const order = ids;
        model.run("data.set", {
            rowCount: order.length,
            getRow: (index) => ({ id: order[index] ?? -1 }),
            rowKey: model.state.rowKey,
        });
    };
    return {
        ...mounted,
        grid,
        handleOf,
        press,
        pressed,
        drag,
        moves,
        reorders,
        target,
        apply,
    };
}

describe("a drag on a row's handle", () => {
    it("starts past the slop, targets once a frame and tells one move on the release", () => {
        const { handleOf, press, view, moves, reorders, target, model } =
            setup();
        const { handle } = handleOf(2);
        // not prevented: under the slop it is a click, which focuses its cell
        expect(press(handle, "pointerdown", middleOf(2)).defaultPrevented).toBe(
            false,
        );
        press(handle, "pointermove", middleOf(2) + 3);
        expect(target()).toBeNull();
        expect(handle.setPointerCapture).not.toHaveBeenCalled();
        press(handle, "pointermove", middleOf(2) + 8);
        expect(handle.setPointerCapture).toHaveBeenCalledWith(1);
        // the active cell is left as it is (a browser's press focused it already)
        expect(model.state.activePosition).toBeNull();
        // over itself: it would land where it is
        expect(target()).toEqual({
            rowIndex: 2,
            rowKey: "r2",
            targetIndex: null,
            side: null,
        });
        // over row 5's lower half, then row 6's: one frame for both
        press(handle, "pointermove", middleOf(5) + 5);
        press(handle, "pointermove", middleOf(6) + 5);
        expect(frames.size).toBe(1);
        frame();
        const over: RowReorder = {
            rowIndex: 2,
            rowKey: "r2",
            targetIndex: 6,
            side: "after",
        };
        expect(target()).toEqual(over);
        expect(view().rowReorder).toEqual(over);
        press(handle, "pointerup", middleOf(6) + 5);
        // after row 6: its index once moved is 6
        expect(moves).toEqual([{ fromIndex: 2, toIndex: 6, rowKey: "r2" }]);
        expect(target()).toBeNull();
        expect(view().rowReorder).toBeNull();
        expect(reorders).toEqual([
            { rowIndex: 2, rowKey: "r2", targetIndex: null, side: null },
            over,
            null,
        ]);
        // nothing moved in the grid: the rows are the app's
        expect(model.state.rowCount).toBe(1_000);
        press(handle, "pointermove", 200);
        expect(frames.size).toBe(0);
    });

    it("targets the side of a row's cells' middle, and nowhere where it would land where it is", () => {
        const { handleOf, drag, press, target } = setup();
        const { handle } = handleOf(4);
        // row 3's lower half and row 5's upper half: beside itself
        drag(handle, middleOf(4), middleOf(3) + 5);
        expect(target()).toMatchObject({ targetIndex: null, side: null });
        press(handle, "pointermove", middleOf(5) - 5);
        frame();
        expect(target()).toMatchObject({ targetIndex: null, side: null });
        // row 3's upper half: before it
        press(handle, "pointermove", middleOf(3) - 5);
        frame();
        expect(target()).toMatchObject({ targetIndex: 3, side: "before" });
        // over the header: kept over the body, the first row in view
        press(handle, "pointermove", 5);
        frame();
        expect(target()).toMatchObject({ targetIndex: 0, side: "before" });
        press(handle, "pointerup", 5);
    });

    it("targets from the row axis: variable heights, and a detail is after its row", () => {
        const { handleOf, drag, press, target } = setup({
            // rows 20px, every fourth one 60px
            rowHeight: (index) => (index % 4 === 3 ? 60 : 20),
            expandedRowKeys: ["r1"],
            detailHeight: 100,
        });
        const { handle } = handleOf(0);
        // in the view, row 1 is 20px of cells (50–70) and a 100px detail (70–170): over the
        // detail, after it
        drag(handle, 40, 120);
        expect(target()).toMatchObject({ targetIndex: 1, side: "after" });
        // row 3 is 60px (190–250): its upper half, then its lower half
        press(handle, "pointermove", 205);
        frame();
        expect(target()).toMatchObject({ targetIndex: 3, side: "before" });
        press(handle, "pointermove", 225);
        frame();
        expect(target()).toMatchObject({ targetIndex: 3, side: "after" });
        press(handle, "pointerup", 225);
    });

    it("cancels on Escape, a pointercancel or a lost capture: nothing moves", () => {
        const { handleOf, drag, press, moves, target, engine } = setup();
        const { handle } = handleOf(1);
        drag(handle, middleOf(1), middleOf(5));
        expect(target()?.targetIndex).toBe(5);
        const cancel = new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
            cancelable: true,
        });
        document.body.dispatchEvent(cancel);
        expect(cancel.defaultPrevented).toBe(true);
        expect(target()).toBeNull();
        press(handle, "pointerup", middleOf(5));
        // a prevented Escape (the app's) keeps it
        drag(handle, middleOf(1), middleOf(5));
        const kept = new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
            cancelable: true,
        });
        kept.preventDefault();
        document.body.dispatchEvent(kept);
        expect(target()?.targetIndex).toBe(5);
        press(handle, "pointercancel", middleOf(5));
        expect(target()).toBeNull();
        drag(handle, middleOf(1), middleOf(5));
        handle.dispatchEvent(
            Object.assign(new Event("lostpointercapture"), { pointerId: 1 }),
        );
        expect(target()).toBeNull();
        press(handle, "pointerup", middleOf(5));
        expect(moves).toEqual([]);
        // the grid's keys too: Escape in the grid ends it
        drag(handle, middleOf(1), middleOf(5));
        expect(keydown(engine, handle, "Escape").handled).toBe(true);
        expect(target()).toBeNull();
        press(handle, "pointerup", middleOf(5));
        expect(moves).toEqual([]);
    });

    it("keeps its click: the click ending it is the drag's", () => {
        const { handleOf, drag, press, engine } = setup();
        const { handle } = handleOf(1);
        drag(handle, middleOf(1), middleOf(4));
        press(handle, "pointerup", middleOf(4));
        const click = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            button: 0,
            detail: 1,
            clientX: 10,
            clientY: middleOf(4),
        });
        Object.defineProperty(click, "target", { value: handle });
        expect(engine.adapter.click(click)).toBe(true);
    });

    it("scrolls near the body's edges a frame at a time, to a far row, and stops at the ends", () => {
        const { handleOf, drag, press, engine, target, moves } = setup();
        const { handle } = handleOf(1);
        // the body is 30–260: 20px into the bottom 40px zone, half speed
        drag(handle, middleOf(1), 240);
        expect(engine.get("scroll-position").top).toBe(10);
        expect(frames.size).toBe(1);
        frame();
        expect(engine.get("scroll-position").top).toBe(20);
        // past the edge: full speed, until the last row
        press(handle, "pointermove", 300);
        for (let i = 0; i < 2_000 && frames.size > 0; i++) frame();
        expect(frames.size).toBe(0);
        // 1000 rows of 20px in a 230px body
        expect(engine.get("scroll-position").top).toBe(20_000 - 230);
        expect(target()).toMatchObject({ targetIndex: 999, side: "after" });
        // back up: the top zone (30–70) scrolls up
        press(handle, "pointermove", 40);
        frame();
        expect(engine.get("scroll-position").top).toBe(20_000 - 230 - 15);
        press(handle, "pointerup", 40);
        expect(moves).toEqual([
            {
                fromIndex: 1,
                toIndex: expect.any(Number),
                rowKey: "r1",
            },
        ]);
        // the middle of the body: no scroll
        drag(handle, middleOf(1), 150);
        expect(frames.size).toBe(0);
        press(handle, "pointerup", 150);
    });

    it("keeps the dragged row rendered, the active cell left alone, a middleware refusing every move", () => {
        const { handleOf, drag, press, engine, view, model, moves } = setup();
        const refused: unknown[] = [];
        model.use((ctx, next) => {
            if (ctx.command !== "active-position.set") return next();
            refused.push(ctx.payload);
            return veto("the parent ignores it");
        });
        const { handle } = handleOf(1);
        // held past the bottom edge to the last row: row 1 is far out of the window
        drag(handle, middleOf(1), 300);
        for (let i = 0; i < 2_000 && frames.size > 0; i++) frame();
        expect(view().renderedRows.start).toBeGreaterThan(900);
        expect(view().rows).toContain(1);
        expect(view().rows[0]).toBe(1);
        press(handle, "pointerup", 300);
        expect(moves).toEqual([{ fromIndex: 1, toIndex: 999, rowKey: "r1" }]);
        expect(refused).toEqual([]);
        expect(model.state.activePosition).toBeNull();
        expect(view().rows).not.toContain(1);
        expect(engine.get("row-reorder")).toBeNull();
    });

    it("works the target out again after a change, from the pointer's last y, with no layout read", () => {
        const { handleOf, drag, press, model, target, viewport } = setup();
        const { handle } = handleOf(1);
        drag(handle, middleOf(1), middleOf(5) + 5);
        expect(target()).toMatchObject({ targetIndex: 5, side: "after" });
        const read = vi.spyOn(viewport, "getBoundingClientRect");
        // rows taller: the pointer (115 into the body) is over row 4's upper half (104–130) now
        model.run("sizes.set", { rowHeight: 26 });
        expect(read).not.toHaveBeenCalled();
        expect(target()).toMatchObject({ targetIndex: 4, side: "before" });
        press(handle, "pointerup", middleOf(5) + 5);
    });

    it("scrolls on when rows are added while the pointer is held at the edge", () => {
        const { handleOf, drag, press, model, engine, target } = setup({
            rowCount: 20,
        });
        const { handle } = handleOf(1);
        drag(handle, middleOf(1), 300);
        for (let i = 0; i < 200 && frames.size > 0; i++) frame();
        // at the end: 20 rows of 20px in a 230px body
        expect(engine.get("scroll-position").top).toBe(170);
        expect(frames.size).toBe(0);
        model.run("data.set", {
            rowCount: 40,
            getRow: (id) => ({ id }),
            rowKey: (row) => `r${row.id}`,
        });
        expect(frames.size).toBe(1);
        for (let i = 0; i < 200 && frames.size > 0; i++) frame();
        expect(engine.get("scroll-position").top).toBe(570);
        expect(target()).toMatchObject({ targetIndex: 39, side: "after" });
        press(handle, "pointerup", 300);
    });

    it("works under scroll scaling: the target is the virtual row", () => {
        // its row active already: the press makes no other cell active (which would scroll)
        const { handleOf, drag, press, engine, target } = setup(
            {
                rowCount: 1_000_000,
                activePosition: { rowIndex: 1, columnIndex: 0 },
            },
            { maxScrollSize: 100_000 },
        );
        expect(engine.get("scroll-scaled").rows).toBe(true);
        engine.run("scroll-to", { top: 10_000_000 });
        const { handle } = handleOf(1);
        drag(handle, middleOf(1), middleOf(3) - 5);
        // 10M / 20 = row 500000 at the body's top
        expect(target()).toMatchObject({
            targetIndex: 500_003,
            side: "before",
        });
        press(handle, "pointerup", middleOf(3) - 5);
    });

    it("refuses a sorted grid's rows and rows not loaded: a plain press", () => {
        const sorted = setup({
            columns: [{ key: "a", width: 100, sortable: true }],
            sortColumns: [{ columnKey: "a", direction: "ascending" }],
        });
        const { handle } = sorted.handleOf(2);
        expect(sorted.pressed(handle, middleOf(2))).toBe(false);
        sorted.press(handle, "pointerdown", middleOf(2));
        sorted.press(handle, "pointermove", middleOf(6));
        frame();
        expect(sorted.target()).toBeNull();
        sorted.press(handle, "pointerup", middleOf(6));
        expect(sorted.moves).toEqual([]);
        document.body.innerHTML = "";

        // rows 5 and later are not loaded
        const partly = setup({
            getRow: (id) => (id < 5 ? { id } : undefined),
        });
        const loaded = partly.handleOf(1);
        const notLoaded = partly.handleOf(6);
        expect(partly.pressed(notLoaded.handle, middleOf(6))).toBe(false);
        expect(partly.pressed(loaded.handle, middleOf(1))).toBe(true);
        partly.press(notLoaded.handle, "pointerdown", middleOf(6));
        partly.press(notLoaded.handle, "pointermove", middleOf(2));
        frame();
        expect(partly.target()).toBeNull();
        partly.press(notLoaded.handle, "pointerup", middleOf(2));
        // over a row not loaded: nowhere
        partly.drag(loaded.handle, middleOf(1), middleOf(7));
        expect(partly.target()).toMatchObject({
            targetIndex: null,
            side: null,
        });
        partly.press(loaded.handle, "pointerup", middleOf(7));
        expect(partly.moves).toEqual([]);
    });

    it("does nothing while the rows do not move, nor for a vetoed press or a handle in a nested grid", () => {
        const off = setup({}, { reorderableRows: false });
        const { handle } = off.handleOf(2);
        expect(off.pressed(handle, middleOf(2))).toBe(false);
        off.drag(handle, middleOf(2), middleOf(6));
        expect(off.target()).toBeNull();
        off.press(handle, "pointerup", middleOf(6));
        expect(off.view().reorderableRows).toBe(false);
        // turned on: it drags; turned off mid-drag: it ends, moving nothing
        off.engine.adapter.setOptions({ reorderableRows: true });
        expect(off.view().reorderableRows).toBe(true);
        off.drag(handle, middleOf(2), middleOf(6));
        expect(off.target()?.targetIndex).toBe(6);
        off.engine.adapter.setOptions({ reorderableRows: false });
        expect(off.target()).toBeNull();
        off.press(handle, "pointerup", middleOf(6));
        expect(off.moves).toEqual([]);
        document.body.innerHTML = "";

        const on = setup();
        const vetoed = on.handleOf(2).handle;
        const event = new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            button: 0,
            pointerId: 1,
            clientY: middleOf(2),
        });
        vetoed.dispatchEvent(event);
        event.preventDefault();
        expect(on.engine.adapter.pointerdown(event)).toBe(false);
    });
});

describe("the keys", () => {
    it("move a row by one with Ctrl/⌘+Shift+↑/↓ on a body cell, handled at the ends too", () => {
        const { handleOf, engine, moves } = setup();
        const { cell } = handleOf(3);
        const down = keydown(engine, cell, "ArrowDown", {
            ctrlKey: true,
            shiftKey: true,
        });
        expect(down.handled).toBe(true);
        expect(down.event.defaultPrevented).toBe(true);
        expect(
            keydown(engine, cell, "ArrowUp", { metaKey: true, shiftKey: true })
                .handled,
        ).toBe(true);
        expect(moves).toEqual([
            { fromIndex: 3, toIndex: 4, rowKey: "r3" },
            { fromIndex: 3, toIndex: 2, rowKey: "r3" },
        ]);
        // the first row up: handled, nothing moves
        const first = handleOf(0).cell;
        expect(
            keydown(engine, first, "ArrowUp", { ctrlKey: true, shiftKey: true })
                .handled,
        ).toBe(true);
        expect(moves).toHaveLength(2);
        // Ctrl alone, Shift alone: not the move
        expect(
            keydown(engine, cell, "ArrowDown", { shiftKey: true }).handled,
        ).toBe(true);
        expect(moves).toHaveLength(2);
    });

    it("are refused under a sort and for a neighbour not loaded, still handled", () => {
        const sorted = setup({
            sortColumns: [{ columnKey: "a", direction: "ascending" }],
            columns: [{ key: "a", width: 100, sortable: true }],
        });
        const cell = sorted.handleOf(3).cell;
        expect(
            keydown(sorted.engine, cell, "ArrowDown", {
                ctrlKey: true,
                shiftKey: true,
            }).handled,
        ).toBe(true);
        expect(sorted.moves).toEqual([]);
        document.body.innerHTML = "";
        const partly = setup({
            getRow: (id) => (id < 5 ? { id } : undefined),
        });
        const last = partly.handleOf(4).cell;
        keydown(partly.engine, last, "ArrowDown", {
            ctrlKey: true,
            shiftKey: true,
        });
        expect(partly.moves).toEqual([]);
    });

    it("are plain arrows while rows do not move", () => {
        const { handleOf, engine, model, moves } = setup(
            { activePosition: { rowIndex: 3, columnIndex: 0 } },
            { reorderableRows: false },
        );
        const { cell } = handleOf(3);
        keydown(engine, cell, "ArrowDown", { ctrlKey: true, shiftKey: true });
        expect(moves).toEqual([]);
        expect(model.state.activePosition).toEqual({
            rowIndex: 4,
            columnIndex: 0,
        });
    });
});

describe("the active cell", () => {
    it("follows its row once the app moved it, by key", () => {
        const { handleOf, engine, model, moves, apply, drag, press } = setup({
            activePosition: { rowIndex: 3, columnIndex: 1 },
        });
        const { cell } = handleOf(3);
        keydown(engine, cell, "ArrowDown", { ctrlKey: true, shiftKey: true });
        const [move] = moves;
        if (!move) throw new Error("no move");
        apply(move);
        expect(model.state.activePosition).toEqual({
            rowIndex: 4,
            columnIndex: 1,
        });
        // a drop far away: the same
        const { handle } = handleOf(4);
        drag(handle, middleOf(4), middleOf(9) - 5);
        press(handle, "pointerup", middleOf(9) - 5);
        const drop = moves[1];
        expect(drop).toEqual({ fromIndex: 4, toIndex: 8, rowKey: "r3" });
        if (!drop) throw new Error("no drop");
        apply(drop);
        expect(model.state.activePosition).toEqual({
            rowIndex: 8,
            columnIndex: 1,
        });
    });

    it("stays on its index without rowKey: a row keyed by its index cannot be followed", () => {
        const { handleOf, engine, model, moves, apply } = setup({
            rowKey: undefined,
            activePosition: { rowIndex: 3, columnIndex: 1 },
        });
        keydown(engine, handleOf(3).cell, "ArrowUp", {
            ctrlKey: true,
            shiftKey: true,
        });
        const [move] = moves;
        expect(move).toEqual({ fromIndex: 3, toIndex: 2, rowKey: 3 });
        if (!move) throw new Error("no move");
        apply(move);
        expect(model.state.activePosition).toEqual({
            rowIndex: 3,
            columnIndex: 1,
        });
    });

    it("waits through rows that change otherwise for the moved rows (a server's answers)", () => {
        const { handleOf, engine, model, moves, apply } = setup({
            activePosition: { rowIndex: 3, columnIndex: 0 },
        });
        keydown(engine, handleOf(3).cell, "ArrowDown", {
            ctrlKey: true,
            shiftKey: true,
        });
        // an unrelated answer first: the same rows told again, then other rows
        model.run("rows.changed", { start: 0, end: 20 });
        model.run("data.set", {
            rowCount: 1_000,
            getRow: (id) => ({ id: id + 10 }),
            rowKey: (row) => `r${row.id}`,
        });
        expect(model.state.activePosition).toEqual({
            rowIndex: 3,
            columnIndex: 0,
        });
        // then the rows moved: it follows
        const [move] = moves;
        if (!move) throw new Error("no move");
        apply(move);
        expect(model.state.activePosition).toEqual({
            rowIndex: 4,
            columnIndex: 0,
        });
    });

    it("forgets a move at the next one, and when the viewport detaches", () => {
        const { handleOf, engine, model, moves, apply } = setup({
            activePosition: { rowIndex: 3, columnIndex: 0 },
        });
        const { cell } = handleOf(3);
        keydown(engine, cell, "ArrowDown", { ctrlKey: true, shiftKey: true });
        keydown(engine, cell, "ArrowUp", { ctrlKey: true, shiftKey: true });
        const [first] = moves;
        if (!first) throw new Error("no move");
        // the first one applied: the second is the one awaited, and its key is not where it says
        apply(first);
        expect(model.state.activePosition).toEqual({
            rowIndex: 3,
            columnIndex: 0,
        });
        document.body.innerHTML = "";

        const detached = setup({
            activePosition: { rowIndex: 3, columnIndex: 0 },
        });
        keydown(detached.engine, detached.handleOf(3).cell, "ArrowDown", {
            ctrlKey: true,
            shiftKey: true,
        });
        detached.detach();
        const [move] = detached.moves;
        if (!move) throw new Error("no move");
        detached.apply(move);
        expect(detached.model.state.activePosition).toEqual({
            rowIndex: 3,
            columnIndex: 0,
        });
    });

    it("moves once per press: a held key's repeats move nothing", () => {
        const { handleOf, engine, moves } = setup({
            activePosition: { rowIndex: 3, columnIndex: 0 },
        });
        const { cell } = handleOf(3);
        const held = keydown(engine, cell, "ArrowDown", {
            ctrlKey: true,
            shiftKey: true,
            repeat: true,
        });
        expect(held.handled).toBe(true);
        expect(held.event.defaultPrevented).toBe(true);
        expect(moves).toEqual([]);
    });

    it("stays where another cell was made active meanwhile", () => {
        const { handleOf, engine, model, moves, apply } = setup({
            activePosition: { rowIndex: 3, columnIndex: 0 },
        });
        keydown(engine, handleOf(3).cell, "ArrowDown", {
            ctrlKey: true,
            shiftKey: true,
        });
        model.run("active-position.set", { rowIndex: 0, columnIndex: 0 });
        const [move] = moves;
        if (!move) throw new Error("no move");
        apply(move);
        expect(model.state.activePosition).toEqual({
            rowIndex: 0,
            columnIndex: 0,
        });
    });
});

describe("the parts", () => {
    it("tell nothing of a drag while rows do not move, as before", () => {
        expect(rowPart(viewOf(), 12, true).state).toMatchObject({
            dragging: undefined,
            dropTarget: undefined,
        });
        expect(rowDragHandlePart(viewOf(), 12, true)).toEqual({
            state: { rowIndex: 12, reorderable: false, dragging: false },
            attributes: {
                "aria-hidden": true,
                [ROW_DRAG_HANDLE_ATTRIBUTE]: 12,
            },
        });
    });

    it("tell the dragged row and the drop target, and when a handle drags", () => {
        const view = viewOf(stateOf(), {
            reorderableRows: true,
            rowReorder: {
                rowIndex: 12,
                rowKey: 12,
                targetIndex: 15,
                side: "before",
            },
        });
        expect(rowPart(view, 12, true).state).toMatchObject({
            dragging: true,
            dropTarget: null,
        });
        expect(rowPart(view, 15, true).state).toMatchObject({
            dragging: false,
            dropTarget: "before",
        });
        expect(rowDragHandlePart(view, 12, true).state).toEqual({
            rowIndex: 12,
            reorderable: true,
            dragging: true,
        });
        // not loaded, or sorted: it does not drag
        expect(rowDragHandlePart(view, 13, false).state.reorderable).toBe(
            false,
        );
        const sorted = viewOf(
            stateOf({
                columns: [{ key: "a", width: 100, sortable: true }],
                sortColumns: [{ columnKey: "a", direction: "ascending" }],
            }),
            { reorderableRows: true },
        );
        expect(rowDragHandlePart(sorted, 12, true).state.reorderable).toBe(
            false,
        );
    });
});
