// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    COLUMN_RESIZER_ATTRIBUTE,
    type Column,
    type ColumnOrGroup,
    type ColumnReorder,
    headerCellPart,
    veto,
} from "../../src";
import {
    cellElement,
    keydown,
    keyEvent,
    type MountOptions,
    mountEngine,
    pointer,
    type Row,
    stubAnimationFrames,
} from "./harness";
import { stateOf, viewOf } from "./views";

// Column reordering on screen (Epic #75, O3, O4, O6): a reorderable header cell drags past a
// click's slop, its target worked out from the column axis (off screen and scaled alike), the
// edges scroll, a release moves it once and Escape, `pointercancel` or a lost capture cancel; its
// click never sorts, a click under the slop still does; Ctrl/⌘+Shift+←/→ move it; the parts tell
// its state.

const column = (
    key: string,
    extra: Partial<Column<Row>> = {},
): Column<Row> => ({ key, width: 100, reorderable: true, ...extra });

// "p" and "q" are pinned; "a" sorts; "g" groups "c" and "d"; "e" does not move; then "f0" … "f19".
// Every column is 100px: "a" at 200, "g" from 400 to 600, "f0" at 700
const COLUMNS: ColumnOrGroup<Row>[] = [
    column("p", { pinned: "start" }),
    column("q", { pinned: "start" }),
    column("a", { sortable: true }),
    column("b"),
    { key: "g", reorderable: true, children: [column("c"), column("d")] },
    column("e", { reorderable: false }),
    ...Array.from({ length: 20 }, (_, i) => column(`f${i}`)),
];

let frames: Map<number, FrameRequestCallback>;
let frame: () => void;

beforeEach(() => {
    ({ frames, frame } = stubAnimationFrames());
});

afterEach(() => {
    vi.unstubAllGlobals();
});

function setup(
    columns: ColumnOrGroup<Row>[] = COLUMNS,
    options: MountOptions = {},
) {
    const grid = document.createElement("div");
    /** a header cell's element, as an adapter renders it: at its top row and first column */
    const headerCell = (rowIndex: number, columnIndex: number) => {
        const cell = cellElement(grid, rowIndex, columnIndex);
        cell.setPointerCapture = vi.fn();
        return cell;
    };
    const cells = {
        p: headerCell(-2, 0),
        q: headerCell(-2, 1),
        a: headerCell(-2, 2),
        b: headerCell(-2, 3),
        g: headerCell(-2, 4),
        c: headerCell(-1, 4),
        e: headerCell(-2, 6),
    };
    const mounted = mountEngine(
        { columns, rowCount: 100 },
        { grid, width: 600, ...options },
    );
    const { model, engine } = mounted;
    const press = (
        target: Element,
        type: string,
        clientX: number,
        init: PointerEventInit = {},
    ) => pointer(engine, target, type, clientX, init);
    /** a press on `target` at `from`, moved past the slop, then to `to` (a frame later) */
    const drag = (target: Element, from: number, to: number) => {
        press(target, "pointerdown", from);
        press(target, "pointermove", from + 10);
        press(target, "pointermove", to);
        frame();
    };
    /** the click a browser sends after a release on `target` */
    const clickOn = (target: Element, clientX: number) => {
        const event = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            button: 0,
            detail: 1,
            clientX,
            clientY: 10,
        });
        Object.defineProperty(event, "target", { value: target });
        return engine.adapter.click(event);
    };
    /** a primary press on `target` handed to the engine: whether it took it */
    const pressed = (target: Element, clientX: number, prevent = false) => {
        const event = new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            button: 0,
            buttons: 1,
            pointerId: 1,
            clientX,
            clientY: 10,
        });
        target.dispatchEvent(event);
        if (prevent) event.preventDefault();
        return engine.adapter.pointerdown(event);
    };
    /** Escape pressed wherever focus is (here the page), as a browser dispatches it */
    const pressEscape = () => {
        const event = new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
            cancelable: true,
        });
        document.body.dispatchEvent(event);
        return event;
    };
    const moves: unknown[] = [];
    model.subscribe((event) => {
        if (event.command === "column-order.move") moves.push(event.payload);
    });
    const reorders: (ColumnReorder | null)[] = [];
    engine.subscribe("column-reorder", (value) => reorders.push(value));
    const leaves = () => model.state.columns.map((entry) => entry.key);
    const target = () => engine.get("column-reorder");
    return {
        ...mounted,
        grid,
        cells,
        headerCell,
        press,
        pressed,
        drag,
        clickOn,
        pressEscape,
        moves,
        reorders,
        leaves,
        target,
    };
}

describe("a drag on a header cell", () => {
    it("starts past the slop, targets once a frame and moves once on the release", () => {
        const { cells, press, engine, view, moves, leaves, reorders, target } =
            setup();
        // not prevented: under the slop it is a click, which focuses the cell
        expect(press(cells.a, "pointerdown", 250).defaultPrevented).toBe(false);
        press(cells.a, "pointermove", 253);
        expect(target()).toBeNull();
        expect(cells.a.setPointerCapture).not.toHaveBeenCalled();
        press(cells.a, "pointermove", 263);
        expect(cells.a.setPointerCapture).toHaveBeenCalledWith(1);
        // over itself: it would land where it is, beside nothing
        expect(target()).toEqual({
            columnKey: "a",
            targetKey: null,
            side: null,
        });
        press(cells.a, "pointermove", 330);
        press(cells.a, "pointermove", 370);
        expect(frames.size).toBe(1);
        expect(target()?.targetKey).toBeNull();
        frame();
        const over: ColumnReorder = {
            columnKey: "a",
            targetKey: "b",
            side: "after",
        };
        expect(target()).toEqual(over);
        expect(view().columnReorder).toEqual(over);
        expect(engine.get("column-reorder")).toBe(view().columnReorder);
        // the columns do not move meanwhile
        expect(leaves().slice(0, 4)).toEqual(["p", "q", "a", "b"]);
        press(cells.a, "pointerup", 370);
        expect(moves).toEqual([
            { columnKey: "a", targetKey: "b", side: "after" },
        ]);
        expect(leaves().slice(0, 4)).toEqual(["p", "q", "b", "a"]);
        expect(target()).toBeNull();
        expect(view().columnReorder).toBeNull();
        expect(reorders).toEqual([
            { columnKey: "a", targetKey: null, side: null },
            over,
            null,
        ]);
        // moves after it are nobody's
        press(cells.a, "pointermove", 500);
        expect(frames.size).toBe(0);
    });

    it("never sorts, wherever it ends; a click under the slop still sorts", () => {
        const { cells, press, drag, clickOn, model, moves } = setup();
        // dragged away and back to where it started
        drag(cells.a, 250, 400);
        press(cells.a, "pointermove", 250);
        press(cells.a, "pointerup", 250);
        expect(clickOn(cells.a, 250)).toBe(true);
        expect(model.state.sortColumns).toEqual([]);
        expect(moves).toEqual([]);
        // a press that moves less than the slop is a click
        press(cells.a, "pointerdown", 250);
        press(cells.a, "pointermove", 253);
        press(cells.a, "pointerup", 253);
        expect(clickOn(cells.a, 253)).toBe(true);
        expect(model.state.sortColumns).toEqual([
            { columnKey: "a", direction: "ascending" },
        ]);
    });

    it("targets from positions: the side of a sibling's middle, a group whole, siblings off screen", () => {
        const { cells, drag, press, engine, target } = setup();
        // before its neighbour: where it is
        drag(cells.a, 250, 330);
        expect(target()).toMatchObject({ targetKey: null, side: null });
        // the group is one sibling, 200px wide
        press(cells.a, "pointermove", 450);
        frame();
        expect(target()).toMatchObject({
            targetKey: "g",
            side: "before",
        });
        press(cells.a, "pointermove", 520);
        frame();
        expect(target()).toMatchObject({
            targetKey: "g",
            side: "after",
        });
        // scrolled far: no element of those columns exists, their positions are known
        engine.run("scroll-to", { left: 1500 });
        press(cells.a, "pointermove", 420);
        frame();
        expect(target()).toMatchObject({
            targetKey: "f12",
            side: "before",
        });
        press(cells.a, "pointerup", 420);
    });

    it("drags a group whole, and a group's column among its group's only", () => {
        const { cells, drag, press, leaves, target, moves } = setup();
        drag(cells.g, 450, 210);
        expect(target()).toMatchObject({
            columnKey: "g",
            targetKey: "a",
            side: "before",
        });
        press(cells.g, "pointerup", 210);
        expect(leaves().slice(0, 6)).toEqual(["p", "q", "c", "d", "a", "b"]);
        moves.length = 0;
        // rendered again in the new order
        cells.c.dataset.columnIndex = "2";
        // "c" is now at 200: over "d" (300–400), then far out of its group
        drag(cells.c, 250, 380);
        expect(target()).toMatchObject({
            columnKey: "c",
            targetKey: "d",
            side: "after",
        });
        press(cells.c, "pointermove", 650);
        frame();
        expect(target()).toMatchObject({ targetKey: "d", side: "after" });
        press(cells.c, "pointerup", 650);
        expect(moves).toEqual([
            { columnKey: "c", targetKey: "d", side: "after" },
        ]);
        expect(leaves().slice(0, 6)).toEqual(["p", "q", "d", "c", "a", "b"]);
    });

    it("moves the pinned among the pinned, with no edge scroll", () => {
        const { cells, drag, press, target, moves, leaves, engine } = setup();
        // over the columns that scroll, far right: kept over the pinned ones, where it is
        drag(cells.q, 150, 590);
        expect(target()).toMatchObject({ targetKey: null, side: null });
        expect(frames.size).toBe(0);
        expect(engine.get("scroll-position").left).toBe(0);
        press(cells.q, "pointerup", 590);
        expect(moves).toEqual([]);
        drag(cells.q, 150, 40);
        expect(target()).toMatchObject({ targetKey: "p", side: "before" });
        press(cells.q, "pointerup", 40);
        expect(moves).toEqual([
            { columnKey: "q", targetKey: "p", side: "before" },
        ]);
        expect(leaves().slice(0, 3)).toEqual(["q", "p", "a"]);
        // an unpinned one over the pinned columns: the first in view, here itself
        drag(cells.a, 250, 50);
        expect(target()).toMatchObject({ targetKey: null, side: null });
        press(cells.a, "pointerup", 50);
        expect(moves).toHaveLength(1);
    });

    it("scrolls near an edge a frame at a time, faster nearer, to the far end", () => {
        const { cells, drag, press, engine, target, leaves } = setup();
        // 20px into the 40px zone: half speed
        drag(cells.a, 250, 580);
        expect(engine.get("scroll-position").left).toBe(10);
        // the pointer held there keeps scrolling
        expect(frames.size).toBe(1);
        frame();
        expect(engine.get("scroll-position").left).toBe(20);
        // past the edge: full speed, until the end
        press(cells.a, "pointermove", 650);
        frame();
        expect(engine.get("scroll-position").left).toBe(40);
        for (let i = 0; i < 200 && frames.size > 0; i++) frame();
        expect(frames.size).toBe(0);
        expect(engine.get("scroll-position").left).toBe(2_100);
        expect(target()).toMatchObject({
            targetKey: "f19",
            side: "after",
        });
        // back toward the start
        press(cells.a, "pointermove", 0);
        frame();
        expect(engine.get("scroll-position").left).toBe(2_080);
        // the pointer kept over the columns that scroll: after "f15" (2_200–2_300)
        press(cells.a, "pointerup", 0);
        expect(frames.size).toBe(0);
        expect(leaves().indexOf("a")).toBe(leaves().indexOf("f15") + 1);
    });

    it("works under scroll scaling: exact edge scroll, targets in virtual positions", () => {
        const columns = Array.from({ length: 2_000 }, (_, i) =>
            column(`c${i}`),
        );
        const { model, engine, commit, headerCell, press, target } = setup(
            columns,
            { width: 500, maxScrollSize: 50_000, clamp: true },
        );
        expect(engine.get("scroll-scaled").columns).toBe(true);
        engine.run("scroll-to", { left: 100_000 });
        commit();
        const cell = headerCell(-1, 1_002);
        press(cell, "pointerdown", 250);
        press(cell, "pointermove", 260);
        press(cell, "pointermove", 470);
        frame();
        expect(engine.get("scroll-position").left).toBe(100_005);
        expect(target()).toMatchObject({
            targetKey: "c1004",
            side: "after",
        });
        press(cell, "pointermove", 380);
        frame();
        press(cell, "pointerup", 380);
        expect(model.state.columns[1_003]?.key).toBe("c1002");
        expect(model.state.columns[1_002]?.key).toBe("c1003");
    });

    it("cancels on Escape, wherever focus is, and leaves the release no move", () => {
        const {
            cells,
            drag,
            press,
            pressEscape,
            clickOn,
            target,
            moves,
            model,
        } = setup();
        // under the slop, Escape is not the drag's
        press(cells.a, "pointerdown", 250);
        expect(pressEscape().defaultPrevented).toBe(false);
        press(cells.a, "pointerup", 250);
        drag(cells.a, 250, 370);
        expect(target()).not.toBeNull();
        expect(pressEscape().defaultPrevented).toBe(true);
        expect(target()).toBeNull();
        press(cells.a, "pointerup", 370);
        expect(clickOn(cells.a, 370)).toBe(true);
        expect(moves).toEqual([]);
        expect(model.state.sortColumns).toEqual([]);
    });

    it("takes Escape in the grid's keys, after the consumer's", () => {
        const { cells, drag, engine, press, target, moves } = setup();
        drag(cells.a, 250, 370);
        const cancelled = keyEvent(cells.a, "Escape");
        cancelled.preventDefault();
        expect(engine.adapter.keydown(cancelled)).toBe(false);
        expect(target()).not.toBeNull();
        const event = keyEvent(cells.a, "Escape");
        expect(engine.adapter.keydown(event)).toBe(true);
        expect(event.defaultPrevented).toBe(true);
        expect(target()).toBeNull();
        press(cells.a, "pointerup", 370);
        expect(moves).toEqual([]);
    });

    it("cancels on pointercancel, a lost capture and a move with no button", () => {
        const { cells, drag, press, target, moves } = setup();
        drag(cells.a, 250, 370);
        press(cells.a, "pointercancel", 370);
        expect(target()).toBeNull();
        drag(cells.a, 250, 370);
        press(cells.a, "lostpointercapture", 370, { bubbles: false });
        expect(target()).toBeNull();
        drag(cells.a, 250, 370);
        press(cells.a, "pointermove", 400, { buttons: 0 });
        expect(target()).toBeNull();
        press(cells.a, "pointerup", 400);
        expect(moves).toEqual([]);
        expect(frames.size).toBe(0);
    });

    it("never starts from a control, a resizer, another button or a press the page prevented", () => {
        const { cells, press, pressed, target, model } = setup();
        const button = document.createElement("button");
        const resizer = document.createElement("div");
        resizer.setAttribute(COLUMN_RESIZER_ATTRIBUTE, "a");
        cells.a.append(button, resizer);
        for (const from of [button, resizer]) {
            press(from, "pointerdown", 250);
            press(from, "pointermove", 400);
            expect(target(), from.tagName).toBeNull();
            press(from, "pointerup", 400);
        }
        press(cells.a, "pointerdown", 250, { button: 2 });
        press(cells.a, "pointermove", 400);
        expect(target()).toBeNull();
        press(cells.a, "pointerup", 400);
        // the page's handler prevented it
        expect(pressed(cells.a, 250, true)).toBe(false);
        press(cells.a, "pointermove", 400);
        expect(target()).toBeNull();
        press(cells.a, "pointerup", 400);
        // a column that does not move
        expect(pressed(cells.e, 650)).toBe(false);
        press(cells.e, "pointermove", 800);
        expect(target()).toBeNull();
        press(cells.e, "pointerup", 800);
        expect(pressed(cells.a, 250)).toBe(true);
        press(cells.a, "pointerup", 250);
        expect(model.state.sortColumns).toEqual([]);
    });

    it("leaves a resizable column's resizer its own drag", () => {
        const { cells, press, target, engine } = setup([
            column("p", { pinned: "start" }),
            column("q", { pinned: "start" }),
            column("a", { resizable: true }),
        ]);
        const resizer = document.createElement("div");
        resizer.setAttribute(COLUMN_RESIZER_ATTRIBUTE, "a");
        resizer.setPointerCapture = vi.fn();
        cells.a.append(resizer);
        press(resizer, "pointerdown", 300);
        press(resizer, "pointermove", 340);
        frame();
        expect(engine.get("column-resize")).toEqual({
            columnKey: "a",
            width: 140,
        });
        expect(target()).toBeNull();
        press(resizer, "pointerup", 340);
    });

    it("is nothing in a grid with no reorderable column: a click sorts as before", () => {
        const { cells, press, pressed, clickOn, model, target } = setup(
            COLUMNS.map((entry) => ({ ...entry, reorderable: undefined })),
        );
        expect(pressed(cells.a, 250)).toBe(false);
        press(cells.a, "pointermove", 400);
        expect(target()).toBeNull();
        expect(frames.size).toBe(0);
        press(cells.a, "pointerup", 400);
        press(cells.a, "pointerdown", 250);
        press(cells.a, "pointerup", 250);
        expect(clickOn(cells.a, 250)).toBe(true);
        expect(model.state.sortColumns).toHaveLength(1);
    });

    it("runs one command a middleware can refuse: nothing moves", () => {
        const { cells, drag, press, model, leaves, target } = setup();
        const asked: unknown[] = [];
        model.use((ctx, next) => {
            if (ctx.command !== "column-order.move") return next();
            asked.push(ctx.payload);
            return veto();
        });
        drag(cells.a, 250, 370);
        press(cells.a, "pointerup", 370);
        expect(asked).toEqual([
            { columnKey: "a", targetKey: "b", side: "after" },
        ]);
        expect(leaves().slice(2, 4)).toEqual(["a", "b"]);
        expect(target()).toBeNull();
    });

    it("follows the columns: new ones with it go on, without it it ends", () => {
        const { cells, drag, press, model, target, moves, reorders } = setup();
        drag(cells.a, 250, 370);
        model.run("columns.set", { columns: [...COLUMNS] });
        expect(target()).toMatchObject({ targetKey: "b", side: "after" });
        model.run("columns.set", {
            columns: COLUMNS.filter((entry) => entry.key !== "a"),
        });
        expect(target()).toBeNull();
        expect(reorders.at(-1)).toBeNull();
        press(cells.a, "pointerup", 370);
        expect(moves).toEqual([]);
    });

    it("keeps the active cell on its column, and ends at a detach", () => {
        const { cells, drag, press, model, detach, target, moves } = setup();
        model.run("active-position.set", { rowIndex: -2, columnIndex: 2 });
        drag(cells.a, 250, 370);
        press(cells.a, "pointerup", 370);
        expect(model.state.activePosition).toEqual({
            rowIndex: -2,
            columnIndex: 3,
        });
        drag(cells.a, 350, 450);
        press(cells.a, "pointermove", 480);
        expect(frames.size).toBe(1);
        detach();
        expect(frames.size).toBe(0);
        expect(target()).toBeNull();
        expect(moves).toHaveLength(1);
    });
});

describe("a drag's pointer and the page", () => {
    it("targets the nearest sibling in view when the pointer leaves the columns that scroll", () => {
        const { cells, press, engine, target } = setup();
        engine.run("scroll-to", { left: 1500 });
        // over the pinned columns: the first scrolling column in view, not an unscrolled one
        press(cells.a, "pointerdown", 450);
        press(cells.a, "pointermove", 460);
        press(cells.a, "pointermove", 100);
        frame();
        // the edge scroll moved the columns by 20: 1_480 + 200 is in "f9" (1_600–1_700)
        expect(engine.get("scroll-position").left).toBe(1_480);
        expect(target()).toMatchObject({ targetKey: "f9", side: "after" });
        press(cells.a, "pointerup", 100);
        // and left of the view, with no pinned columns
        const unpinned = setup(
            COLUMNS.map((entry) =>
                entry.key === "p" || entry.key === "q"
                    ? { key: entry.key, width: 100 }
                    : entry,
            ),
        );
        unpinned.engine.run("scroll-to", { left: 1500 });
        unpinned.press(unpinned.cells.a, "pointerdown", 250);
        unpinned.press(unpinned.cells.a, "pointermove", 260);
        unpinned.press(unpinned.cells.a, "pointermove", -50);
        frame();
        expect(unpinned.engine.get("scroll-position").left).toBe(1_480);
        // 1_480 is in "f7" (1_400–1_500), right of its middle
        expect(unpinned.target()).toMatchObject({
            targetKey: "f7",
            side: "after",
        });
        unpinned.press(unpinned.cells.a, "pointerup", -50);
    });

    it("never scrolls away from the edge it is near: in a narrow view, the zones halve", () => {
        // 60px scroll right of the pinned columns: two 30px zones, meeting at 230
        const { cells, press, engine } = setup(COLUMNS, { width: 260 });
        press(cells.a, "pointerdown", 210);
        press(cells.a, "pointermove", 220);
        press(cells.a, "pointermove", 235);
        frame();
        expect(engine.get("scroll-position").left).toBeGreaterThan(0);
        press(cells.a, "pointerup", 235);
    });

    it("ends a press whose release the page never heard: the next press works, nothing blocked", () => {
        const { cells, press, pressed, target } = setup();
        const selectStart = () => {
            const event = new Event("selectstart", { cancelable: true });
            document.body.dispatchEvent(event);
            return event.defaultPrevented;
        };
        press(cells.a, "pointerdown", 250);
        // a press may drag: no text selection, no native drag of what it holds
        expect(selectStart()).toBe(true);
        const native = new Event("dragstart", { cancelable: true });
        cells.a.dispatchEvent(native);
        expect(native.defaultPrevented).toBe(true);
        // its release lost: a press elsewhere in the page ends it
        document.body.dispatchEvent(
            new PointerEvent("pointerdown", { pointerId: 2, bubbles: true }),
        );
        expect(selectStart()).toBe(false);
        // a later press on the grid still drags
        expect(pressed(cells.a, 250)).toBe(true);
        press(cells.a, "pointermove", 370);
        expect(target()).toMatchObject({ targetKey: "b" });
        press(cells.a, "pointerup", 370);
        expect(selectStart()).toBe(false);
        // the window losing focus ends one too
        press(cells.a, "pointerdown", 250);
        window.dispatchEvent(new Event("blur"));
        expect(selectStart()).toBe(false);
        press(cells.a, "pointermove", 370);
        expect(target()).toBeNull();
    });

    it("reports no drop target while a drop would move nothing", () => {
        const state = stateOf({ columns: COLUMNS });
        const view = viewOf(state, {
            columnReorder: { columnKey: "a", targetKey: null, side: null },
        });
        for (const key of ["a", "b", "q"]) {
            const cell = state.header.cellByKey(key);
            if (!cell) throw new Error(`no cell ${key}`);
            expect(headerCellPart(view, cell).state, key).toMatchObject({
                dragging: key === "a",
                dropTarget: null,
            });
        }
    });
});

describe("the keys on a header cell", () => {
    const reorderKey = (
        engine: ReturnType<typeof setup>["engine"],
        target: Element,
        key: "ArrowLeft" | "ArrowRight",
        init: KeyboardEventInit = { ctrlKey: true },
    ) => keydown(engine, target, key, { shiftKey: true, ...init });

    it("move its column one place with Ctrl/⌘+Shift+←/→, the active cell and focus with it", () => {
        const { cells, engine, model, leaves, commit } = setup();
        cells.a.focus();
        expect(model.state.activePosition).toEqual({
            rowIndex: -2,
            columnIndex: 2,
        });
        const { handled, event } = reorderKey(engine, cells.a, "ArrowRight");
        expect(handled).toBe(true);
        expect(event.defaultPrevented).toBe(true);
        expect(leaves().slice(2, 4)).toEqual(["b", "a"]);
        expect(model.state.activePosition).toEqual({
            rowIndex: -2,
            columnIndex: 3,
        });
        // focus waits for the cells to render in their new order
        expect(document.activeElement).toBe(cells.a);
        cells.a.dataset.columnIndex = "3";
        cells.b.dataset.columnIndex = "2";
        commit();
        expect(document.activeElement).toBe(cells.a);
        reorderKey(engine, cells.a, "ArrowLeft", { metaKey: true });
        expect(leaves().slice(2, 4)).toEqual(["a", "b"]);
    });

    it("move a group, and a group's column among its group's", () => {
        const { cells, engine, leaves } = setup();
        reorderKey(engine, cells.g, "ArrowLeft");
        expect(leaves().slice(2, 6)).toEqual(["a", "c", "d", "b"]);
        // rendered again in the new order
        cells.c.dataset.columnIndex = "3";
        const { handled } = reorderKey(engine, cells.c, "ArrowRight");
        expect(handled).toBe(true);
        expect(leaves().slice(2, 6)).toEqual(["a", "d", "c", "b"]);
    });

    it("do nothing at an end or past the pinned ones, the keys still taken", () => {
        const { cells, engine, leaves, headerCell } = setup();
        const before = leaves();
        for (const [target, key] of [
            [cells.a, "ArrowLeft"],
            [cells.p, "ArrowLeft"],
            [cells.q, "ArrowRight"],
            [headerCell(-2, 26), "ArrowRight"],
            [cells.c, "ArrowLeft"],
        ] as const) {
            const { handled, event } = reorderKey(engine, target, key);
            expect(handled, key).toBe(true);
            expect(event.defaultPrevented, key).toBe(true);
        }
        expect(leaves()).toEqual(before);
    });

    it("are the consumer's to cancel, and plain moves elsewhere: a body cell, a fixed column", () => {
        const { cells, engine, model, leaves, grid } = setup();
        const before = leaves();
        const cancelled = keyEvent(cells.a, "ArrowRight", {
            ctrlKey: true,
            shiftKey: true,
        });
        cancelled.preventDefault();
        expect(engine.adapter.keydown(cancelled)).toBe(false);
        // a body cell moves as an arrow does
        const body = cellElement(grid, 3, 2);
        body.focus();
        reorderKey(engine, body, "ArrowRight");
        expect(model.state.activePosition).toEqual({
            rowIndex: 3,
            columnIndex: 3,
        });
        // as does a header cell that does not move
        cells.e.focus();
        reorderKey(engine, cells.e, "ArrowRight");
        expect(model.state.activePosition).toEqual({
            rowIndex: -2,
            columnIndex: 7,
        });
        expect(leaves()).toEqual(before);
    });
});

describe("the parts", () => {
    it("tell a header cell reorderable, dragged, or where a drop lands beside it", () => {
        const state = stateOf({ columns: COLUMNS });
        const view = viewOf(state, {
            columnReorder: {
                columnKey: "a",
                targetKey: "g",
                side: "after",
            },
        });
        const stateOfCell = (key: string) => {
            const cell = state.header.cellByKey(key);
            if (!cell) throw new Error(`no cell ${key}`);
            return headerCellPart(view, cell).state;
        };
        expect(stateOfCell("a")).toMatchObject({
            reorderable: true,
            dragging: true,
            dropTarget: null,
        });
        expect(stateOfCell("g")).toMatchObject({
            reorderable: true,
            dragging: false,
            dropTarget: "after",
        });
        expect(stateOfCell("c")).toMatchObject({
            reorderable: true,
            dropTarget: null,
        });
        expect(stateOfCell("e")).toMatchObject({
            reorderable: false,
            dragging: false,
            dropTarget: null,
        });
    });
});
