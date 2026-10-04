// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    COLUMN_RESIZER_ATTRIBUTE,
    type ColumnOrGroup,
    type ColumnResize,
    columnResizerPart,
    createDataGridEngine,
    createDataGridModel,
    headerCellPart,
    veto,
} from "../../src";
import { columnAxisOf } from "../../src/engine/view";
import {
    cellElement,
    click,
    fakeContentWidth,
    keydown,
    keyEvent,
    mountEngine,
    type Row,
} from "./harness";
import { stateOf, viewOf } from "./views";

// Column resizing on screen (Epic #70, W1, W3–W8): the column axis reads the widths; a resizer's
// drag resizes once a frame, Escape and `pointercancel` restore, its click never sorts and a
// double click fits (Epic #80, A4); its keys resize in interaction; the parts tell its state and
// ARIA.

// "a" (pinned, sortable, 50–200), "b" (resizable, no maximum), "g" groups "c" and "d"; "e" is fixed
const COLUMNS: ColumnOrGroup<Row>[] = [
    {
        key: "a",
        width: 100,
        pinned: "start",
        sortable: true,
        resizable: true,
        minWidth: 50,
        maxWidth: 200,
    },
    { key: "b", width: 100, resizable: true },
    {
        key: "g",
        children: [
            { key: "c", width: 100, resizable: true, maxWidth: 150 },
            { key: "d", width: 100, resizable: true, maxWidth: 250 },
        ],
    },
    { key: "e", width: 100 },
];

/** The animation frames the engine asked for, run by `frame()`. */
let frames: Map<number, FrameRequestCallback>;
let nextFrame = 0;

beforeEach(() => {
    frames = new Map();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
        nextFrame += 1;
        frames.set(nextFrame, callback);
        return nextFrame;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});

afterEach(() => {
    vi.unstubAllGlobals();
});

/** Runs the frames asked for so far. */
function frame() {
    const waiting = [...frames.values()];
    frames.clear();
    for (const callback of waiting) callback(0);
}

function setup(columns: ColumnOrGroup<Row>[] = COLUMNS) {
    const grid = document.createElement("div");
    /**
     * a header cell holding a resizer for `columnKey`, as an adapter renders them: at its top
     * row (the columns outside "g" span both header rows)
     */
    const resizable = (
        columnIndex: number,
        columnKey: string,
        rowIndex = -2,
    ) => {
        const cell = cellElement(
            grid,
            rowIndex,
            columnIndex,
            `<div role="separator" tabindex="0" ${COLUMN_RESIZER_ATTRIBUTE}="${columnKey}"></div>`,
        );
        const resizer = cell.firstElementChild as HTMLElement;
        resizer.setPointerCapture = vi.fn();
        return { cell, resizer };
    };
    const a = resizable(0, "a");
    const mounted = mountEngine(
        { columns, rowCount: 100 },
        { grid, width: 600 },
    );
    const { model, engine } = mounted;
    /**
     * a pointer event on `target`, the primary button held until the release; returns it. A
     * press goes to the engine after the page's own handlers, as the root hands it over
     */
    const pointer = (
        target: Element,
        type: string,
        clientX: number,
        init: PointerEventInit = {},
    ) => {
        const released = type === "pointerup" || type === "pointercancel";
        const event = new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            button: 0,
            buttons: released ? 0 : 1,
            pointerId: 1,
            clientX,
            clientY: 10,
            ...init,
        });
        target.dispatchEvent(event);
        if (type === "pointerdown") engine.adapter.pointerdown(event);
        return event;
    };
    /** Escape pressed wherever focus is (here the page), as a browser dispatches it */
    const pressEscape = (target: Element = document.body) => {
        const event = new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
            cancelable: true,
        });
        target.dispatchEvent(event);
        return event;
    };
    const widthOf = (columnKey: string) =>
        model.get("column-width-by", { columnKey });
    /** a press and its release on `target`, then the click a browser sends (`detail` in a row) */
    const clickOn = (target: Element, detail = 1) => {
        pointer(target, "pointerdown", 300);
        pointer(target, "pointerup", 300);
        const event = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            button: 0,
            detail,
            clientX: 300,
            clientY: 10,
        });
        Object.defineProperty(event, "target", { value: target });
        return engine.adapter.click(event);
    };
    const resizes: (ColumnResize | null)[] = [];
    engine.subscribe("column-resize", (value) => resizes.push(value));
    return {
        ...mounted,
        grid,
        a,
        resizable,
        pointer,
        pressEscape,
        clickOn,
        widthOf,
        resizes,
    };
}

describe("the column axis", () => {
    it("reads the widths on screen: resized, clamped, a fixed column as it is", () => {
        const state = stateOf({
            columns: COLUMNS,
            columnWidths: { a: 999, b: 130, e: 10 },
        });
        const axis = columnAxisOf(state);
        expect([0, 1, 2, 3, 4].map((i) => axis.sizeOf(i))).toEqual([
            200, 130, 100, 100, 100,
        ]);
    });

    it("follows a resize: the view, the pinned width and the column window", () => {
        const { model, view, engine } = setup();
        expect(view().pinnedWidth).toBe(100);
        const before = engine.get("column-window").visible;
        model.run("column-widths.resize", { columnKey: "a", width: 200 });
        expect(view().columnAxis.sizeOf(0)).toBe(200);
        expect(view().pinnedWidth).toBe(200);
        model.run("column-widths.resize", { columnKey: "b", width: 400 });
        // the view right of the pinned column holds fewer columns
        expect(engine.get("column-window").visible.end).toBeLessThan(
            before.end,
        );
        expect(view().columnAxis.totalSize).toBe(200 + 400 + 300);
    });
});

describe("a drag on a resizer", () => {
    it("resizes once a frame, live, and ends at the release", () => {
        const { a, pointer, widthOf, engine, view, model, resizes } = setup();
        let events = 0;
        model.subscribe(() => {
            events += 1;
        });
        // no focus, no text selection: the header cell stays where the pointer is
        expect(pointer(a.resizer, "pointerdown", 300).defaultPrevented).toBe(
            true,
        );
        expect(a.resizer.setPointerCapture).toHaveBeenCalledWith(1);
        expect(engine.get("column-resize")).toEqual({
            columnKey: "a",
            width: 100,
        });
        expect(view().columnResize).toEqual({ columnKey: "a", width: 100 });
        pointer(a.resizer, "pointermove", 310);
        pointer(a.resizer, "pointermove", 320);
        pointer(a.resizer, "pointermove", 340);
        // one frame asked for, nothing resized before it
        expect(frames.size).toBe(1);
        expect(events).toBe(0);
        frame();
        expect(events).toBe(1);
        expect(widthOf("a")).toBe(140);
        expect(engine.get("column-resize")).toEqual({
            columnKey: "a",
            width: 140,
        });
        // within its limits
        pointer(a.resizer, "pointermove", 600);
        frame();
        expect(widthOf("a")).toBe(200);
        // the release resizes to where it happens, now: no frame left behind
        pointer(a.resizer, "pointermove", 360);
        pointer(a.resizer, "pointerup", 370);
        expect(frames.size).toBe(0);
        expect(widthOf("a")).toBe(170);
        expect(engine.get("column-resize")).toBeNull();
        expect(view().columnResize).toBeNull();
        expect(resizes.at(-1)).toBeNull();
        expect(resizes[0]).toEqual({ columnKey: "a", width: 100 });
        // moves after it are nobody's
        pointer(a.resizer, "pointermove", 400);
        expect(frames.size).toBe(0);
    });

    it("restores the widths it started from on Escape, and on pointercancel", () => {
        const { a, pointer, pressEscape, widthOf, engine, model } = setup();
        model.run("column-widths.set", { columnWidths: { a: 120 } });
        pointer(a.resizer, "pointerdown", 300);
        pointer(a.resizer, "pointermove", 350);
        frame();
        expect(widthOf("a")).toBe(170);
        // focus outside the grid
        expect(pressEscape().defaultPrevented).toBe(true);
        expect(model.get("column-widths")).toEqual({ a: 120 });
        expect(engine.get("column-resize")).toBeNull();
        // the drag over, Escape is no longer the resizer's
        expect(pressEscape().defaultPrevented).toBe(false);

        pointer(a.resizer, "pointerdown", 300);
        pointer(a.resizer, "pointermove", 250);
        pointer(a.resizer, "pointercancel", 250);
        expect(frames.size).toBe(0);
        expect(model.get("column-widths")).toEqual({ a: 120 });
        expect(engine.get("column-resize")).toBeNull();
    });

    it("restores only its own columns, through a resize: what changed meanwhile stays", () => {
        const { a, pointer, pressEscape, widthOf, model } = setup();
        // a middleware that lets the widths be resized, never replaced
        model.use((ctx, next) =>
            ctx.command === "column-widths.set" ? veto() : next(),
        );
        pointer(a.resizer, "pointerdown", 300);
        pointer(a.resizer, "pointermove", 350);
        frame();
        model.run("column-widths.resize", { columnKey: "b", width: 160 });
        pressEscape();
        expect(widthOf("a")).toBe(100);
        expect(widthOf("b")).toBe(160);
        expect(model.get("column-widths")).toEqual({ b: 160 });
    });

    it("takes Escape once, in the grid's keys first: interaction stays", () => {
        const { a, pointer, engine, widthOf } = setup();
        keydown(engine, a.cell, "F2");
        expect(engine.get("interaction")).not.toBeNull();
        pointer(a.resizer, "pointerdown", 300);
        pointer(a.resizer, "pointermove", 350);
        frame();
        // the root hands the key to the engine before the document hears it
        const event = keyEvent(a.resizer, "Escape");
        expect(engine.adapter.keydown(event)).toBe(true);
        expect(event.defaultPrevented).toBe(true);
        expect(engine.get("interaction")).not.toBeNull();
        expect(engine.get("column-resize")).toBeNull();
        expect(widthOf("a")).toBe(100);
    });

    it("leaves Escape to the page's handlers first: one they prevent keeps the drag", () => {
        const { a, pointer, pressEscape, engine, widthOf } = setup();
        pointer(a.resizer, "pointerdown", 300);
        pointer(a.resizer, "pointermove", 350);
        frame();
        const cancel = (event: Event) => event.preventDefault();
        document.body.addEventListener("keydown", cancel);
        pressEscape();
        document.body.removeEventListener("keydown", cancel);
        expect(engine.get("column-resize")).not.toBeNull();
        expect(widthOf("a")).toBe(150);
        pointer(a.resizer, "pointerup", 350);
    });

    it("is the page's to cancel: a press it prevents starts no drag", () => {
        const { a, engine } = setup();
        const event = new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            button: 0,
            buttons: 1,
            pointerId: 1,
            clientX: 300,
        });
        a.resizer.dispatchEvent(event);
        event.preventDefault();
        expect(engine.adapter.pointerdown(event)).toBe(false);
        expect(engine.get("column-resize")).toBeNull();
    });

    it("never gets stuck: a lost capture, a move with no button, a capture refused", () => {
        const { a, pointer, widthOf, engine } = setup();
        pointer(a.resizer, "pointerdown", 300);
        pointer(a.resizer, "pointermove", 320);
        frame();
        pointer(a.resizer, "pointermove", 330);
        // the resizer lost the pointer: the drag ends where it is
        pointer(a.resizer, "lostpointercapture", 330, { bubbles: false });
        expect(engine.get("column-resize")).toBeNull();
        expect(frames.size).toBe(0);
        expect(widthOf("a")).toBe(130);

        // a release the page never heard: the next move has no button down
        pointer(a.resizer, "pointerdown", 300);
        pointer(a.resizer, "pointermove", 400, { buttons: 0 });
        expect(engine.get("column-resize")).toBeNull();
        expect(widthOf("a")).toBe(130);

        // a capture the browser refuses still drags, and ends at the release
        a.resizer.setPointerCapture = vi.fn(() => {
            throw new DOMException("no such pointer", "NotFoundError");
        });
        pointer(a.resizer, "pointerdown", 300);
        expect(engine.get("column-resize")).not.toBeNull();
        pointer(a.resizer, "pointermove", 310);
        pointer(a.resizer, "pointerup", 310);
        expect(engine.get("column-resize")).toBeNull();
        expect(widthOf("a")).toBe(140);
    });

    it("ignores a press that is not the primary button", () => {
        const { a, pointer, widthOf, engine } = setup();
        expect(
            pointer(a.resizer, "pointerdown", 300, { button: 2 })
                .defaultPrevented,
        ).toBe(false);
        pointer(a.resizer, "pointermove", 350);
        frame();
        expect(engine.get("column-resize")).toBeNull();
        expect(widthOf("a")).toBe(100);
    });

    it("never sorts: its click is the resizer's, wherever it lands", () => {
        const { a, pointer, clickOn, engine, model } = setup();
        pointer(a.resizer, "pointerdown", 300);
        pointer(a.resizer, "pointermove", 302);
        pointer(a.resizer, "pointerup", 302);
        // the click a browser may send to the header cell holding the resizer
        const event = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            button: 0,
            detail: 1,
            clientX: 302,
            clientY: 10,
        });
        Object.defineProperty(event, "target", { value: a.cell });
        expect(engine.adapter.click(event)).toBe(true);
        expect(model.state.sortColumns).toEqual([]);
        // a press with no move
        expect(clickOn(a.resizer)).toBe(true);
        expect(model.state.sortColumns).toEqual([]);
        // a press the engine was never handed (no drag) on a resizer is still no sort
        expect(click(engine, a.resizer).handled).toBe(false);
        expect(model.state.sortColumns).toEqual([]);
        // the header cell itself still sorts
        expect(click(engine, a.cell).handled).toBe(true);
        expect(model.state.sortColumns).toEqual([
            { columnKey: "a", direction: "ascending" },
        ]);
    });

    it("resizes a group's columns together", () => {
        const { resizable, pointer, widthOf, engine, commit } = setup();
        const g = resizable(2, "g");
        commit();
        pointer(g.resizer, "pointerdown", 300);
        expect(engine.get("column-resize")).toEqual({
            columnKey: "g",
            width: 200,
        });
        pointer(g.resizer, "pointermove", 450);
        frame();
        // 75 each, "c" stopping at 150 and "d" taking the rest
        expect(widthOf("c")).toBe(150);
        expect(widthOf("d")).toBe(200);
        expect(engine.get("column-resize")).toEqual({
            columnKey: "g",
            width: 350,
        });
        pointer(g.resizer, "pointerup", 450);
    });

    it("is only this grid's: not a nested grid's resizer, not a grid with no resizable column", () => {
        const { a, pointer, engine } = setup();
        // a grid nested in the header cell, with a resizer of the same key
        const holder = document.createElement("div");
        a.cell.append(holder);
        const inner = createDataGridEngine(
            createDataGridModel<Row>({
                columns: [{ key: "a", width: 100 }],
                rows: [],
            }),
        );
        inner.adapter.attach(holder);
        const nested = document.createElement("div");
        nested.setAttribute(COLUMN_RESIZER_ATTRIBUTE, "a");
        holder.append(nested);
        pointer(nested, "pointerdown", 300);
        expect(engine.get("column-resize")).toBeNull();
        expect(inner.get("column-resize")).toBeNull();

        const fixed = setup([{ key: "a", width: 100 }]);
        pointer(fixed.a.resizer, "pointerdown", 300);
        expect(fixed.engine.get("column-resize")).toBeNull();
        expect(fixed.view().columnResize).toBeNull();
    });

    it("ends at a detach, its frame cancelled", () => {
        const { a, pointer, engine, detach } = setup();
        pointer(a.resizer, "pointerdown", 300);
        pointer(a.resizer, "pointermove", 320);
        expect(frames.size).toBe(1);
        detach();
        expect(frames.size).toBe(0);
        expect(engine.get("column-resize")).toBeNull();
    });
});

describe("a double click on a resizer", () => {
    it("fits the column to its content, and a group's columns to theirs (Epic #80, A4)", () => {
        const { a, resizable, clickOn, widthOf, model, commit, grid } = setup();
        const g = resizable(2, "g");
        // "a"'s header cell holds 90 pixels, its cell 170; "c"'s cell 60, "d"'s 400
        fakeContentWidth(a.cell, 90);
        for (const [columnIndex, content] of [
            [0, 170],
            [2, 60],
            [3, 400],
        ] as const) {
            fakeContentWidth(cellElement(grid, 0, columnIndex), content);
        }
        commit();
        model.run("column-widths.set", {
            columnWidths: { a: 180, c: 60, d: 60 },
        });
        // the first click of the two is a click
        expect(clickOn(a.resizer)).toBe(true);
        expect(widthOf("a")).toBe(180);
        expect(clickOn(a.resizer, 2)).toBe(true);
        expect(widthOf("a")).toBe(170);
        // each column within its limits: "d" stops at 250
        clickOn(g.resizer, 2);
        expect(model.get("column-widths")).toEqual({ a: 170, c: 60, d: 250 });
        expect(model.state.sortColumns).toEqual([]);
    });
});

describe("the keys on a resizer", () => {
    /** a grid whose header cell "a" is in interaction, its resizer focused */
    function focused() {
        const mounted = setup();
        const { engine, a } = mounted;
        keydown(engine, a.cell, "F2");
        expect(document.activeElement).toBe(a.resizer);
        const key = (name: string, init: KeyboardEventInit = {}) =>
            keydown(engine, a.resizer, name, init);
        return { ...mounted, key };
    }

    it("resize by 10 with the arrows, 50 with Shift, to the limits with Home and End", () => {
        const { key, widthOf } = focused();
        expect(key("ArrowRight").handled).toBe(true);
        expect(widthOf("a")).toBe(110);
        key("ArrowRight", { shiftKey: true });
        expect(widthOf("a")).toBe(160);
        key("ArrowLeft");
        expect(widthOf("a")).toBe(150);
        key("ArrowLeft", { shiftKey: true });
        expect(widthOf("a")).toBe(100);
        key("Home");
        expect(widthOf("a")).toBe(50);
        const end = key("End");
        expect(end.event.defaultPrevented).toBe(true);
        expect(widthOf("a")).toBe(200);
    });

    it("never page the container: the other page keys do nothing on a resizer", () => {
        const { key, widthOf } = focused();
        for (const [name, init] of [
            ["ArrowUp", {}],
            ["ArrowDown", {}],
            ["PageDown", {}],
            [" ", {}],
            [" ", { shiftKey: true }],
            ["End", { ctrlKey: true }],
        ] as const) {
            const { handled, event } = key(name, init);
            expect(handled, name).toBe(true);
            expect(event.defaultPrevented, name).toBe(true);
        }
        expect(widthOf("a")).toBe(100);
    });

    it("go with End to the maximum they report: without one, the view's width", () => {
        const { engine, resizable, widthOf, model, view } = setup();
        const b = resizable(1, "b");
        keydown(engine, b.cell, "F2");
        model.run("column-widths.set", { columnWidths: { b: 300 } });
        keydown(engine, b.resizer, "End");
        expect(widthOf("b")).toBe(600);
        const cell = model.state.header.cellByKey("b");
        if (!cell) throw new Error("no cell b");
        expect(
            columnResizerPart(view(), cell).attributes["aria-valuemax"],
        ).toBe(600);
    });

    it("leave the consumer's cancelled keys alone, and Escape leaves interaction, the width kept", () => {
        const { key, widthOf, engine, a } = focused();
        const event = keyEvent(a.resizer, "ArrowRight");
        event.preventDefault();
        expect(engine.adapter.keydown(event)).toBe(false);
        expect(widthOf("a")).toBe(100);
        key("ArrowRight");
        key("Escape");
        expect(engine.get("interaction")).toBeNull();
        expect(widthOf("a")).toBe(110);
    });
});

describe("a resize under scroll scaling", () => {
    it("keeps the view on its first column when a column left of it changes", () => {
        const columns = Array.from({ length: 2_000 }, (_, i) => ({
            key: `c${i}`,
            width: 100,
            resizable: true,
        }));
        const { model, engine, commit } = mountEngine(
            { columns, rowCount: 10 },
            { width: 500, maxScrollSize: 50_000, clamp: true },
        );
        expect(engine.get("scroll-scaled").columns).toBe(true);
        engine.run("scroll-to", { left: 100_000 });
        commit();
        const before = engine.get("column-window").visible;
        expect(before.start).toBe(1_000);
        model.run("column-widths.resize", { columnKey: "c0", width: 160 });
        commit();
        // the same column first, the view moved by the 60 pixels added
        expect(engine.get("scroll-position").left).toBe(100_060);
        expect(engine.get("column-window").visible.start).toBe(1_000);
        model.run("column-widths.resize", { columnKey: "c1", width: 40 });
        commit();
        expect(engine.get("scroll-position").left).toBe(100_000);
        expect(engine.get("column-window").visible.start).toBe(1_000);
        // a resize right of the view's first column moves nothing
        model.run("column-widths.resize", { columnKey: "c1500", width: 300 });
        commit();
        expect(engine.get("scroll-position").left).toBe(100_000);
    });
});

describe("the parts", () => {
    it("tell a resizer's state and its separator ARIA", () => {
        const state = stateOf({ columns: COLUMNS });
        const view = viewOf(state, {
            columnResize: { columnKey: "a", width: 100 },
        });
        const cellOf = (key: string) => {
            const cell = state.header.rows
                .flat()
                .find((entry) => entry.key === key);
            if (!cell) throw new Error(`no cell ${key}`);
            return cell;
        };
        expect(columnResizerPart(view, cellOf("a"))).toEqual({
            state: {
                columnKey: "a",
                resizable: true,
                resizing: true,
                width: 100,
                minWidth: 50,
                maxWidth: 200,
            },
            tabIndex: 0,
            attributes: {
                role: "separator",
                "aria-orientation": "vertical",
                "aria-valuenow": 100,
                "aria-valuemin": 50,
                "aria-valuemax": 200,
                [COLUMN_RESIZER_ATTRIBUTE]: "a",
            },
        });
        // no maximum: the wider of its width and the view's (300) for ARIA, none in its state
        const b = columnResizerPart(view, cellOf("b"));
        expect(b.attributes["aria-valuemax"]).toBe(300);
        expect(b.state).toMatchObject({ resizing: false, maxWidth: undefined });
        const wide = viewOf(state, { viewportWidth: 50 });
        expect(
            columnResizerPart(wide, cellOf("b")).attributes["aria-valuemax"],
        ).toBe(columnResizerPart(wide, cellOf("b")).state.width);
        // a group: its columns together
        expect(columnResizerPart(view, cellOf("g")).attributes).toMatchObject({
            "aria-valuenow": 200,
            "aria-valuemin": 80,
            "aria-valuemax": 400,
            [COLUMN_RESIZER_ATTRIBUTE]: "g",
        });
        expect(columnResizerPart(view, cellOf("e")).state.resizable).toBe(
            false,
        );
        expect(headerCellPart(view, cellOf("a")).state).toMatchObject({
            resizable: true,
            resizing: true,
        });
        expect(headerCellPart(view, cellOf("g")).state).toMatchObject({
            resizable: true,
            resizing: false,
        });
        expect(headerCellPart(view, cellOf("e")).state.resizable).toBe(false);
    });
});
