// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    type CellRange,
    type Column,
    cellPart,
    type DataGridModelOptions,
    FILL_HANDLE_ATTRIBUTE,
    type FillDrag,
    fillHandlePart,
    type RangeFill,
} from "../../src";
import { repeatedFill } from "../../src/fill";
import {
    cellElement,
    click,
    keydown,
    type MountOptions,
    mountEngine,
    pointer,
    type Row,
    stubAnimationFrames,
} from "./harness";

// The fill handle (Epic #88, E4.4): a press on the handle the app renders at the range's corner
// (or the active cell's) drags a fill down or to the end, the target from the axes once a frame
// (the edges scrolling); the release tells one `range-fill` and the range grows to it; Escape,
// a cancelled pointer or a lost capture tell nothing. The grid writes no data; `repeatedFill`
// (`@fragiola/data-grid/fill`) repeats the source.

let frames: Map<number, FrameRequestCallback>;
let frame: () => void;

beforeEach(() => {
    ({ frames, frame } = stubAnimationFrames());
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// 20px rows under a 30px header in a 400 × 260 viewport, 100px columns: cell (r, c) at x 100c,
// y 30 + 20r in the view
const COLUMNS: Column<Row>[] = Array.from({ length: 8 }, (_, index) => ({
    key: `c${index}`,
    width: 100,
    editable: true,
}));
const xOf = (columnIndex: number) => 100 * columnIndex + 50;
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
        { grid, fillable: true, ...options },
    );
    const { engine } = mounted;
    const fills: RangeFill[] = [];
    engine.subscribe("range-fill", (filled) => fills.push(filled));
    const states: (FillDrag | null)[] = [];
    engine.subscribe("fill", (state) => states.push(state));
    /** a cell holding a fill handle, as an app renders it */
    const handleIn = (rowIndex: number, columnIndex: number) => {
        const cell = cellElement(grid, rowIndex, columnIndex);
        const handle = document.createElement("span");
        handle.setAttribute(FILL_HANDLE_ATTRIBUTE, String(rowIndex));
        cell.append(handle);
        return handle;
    };
    const press = (
        target: Element,
        type: string,
        x: number,
        y: number,
        init: PointerEventInit = {},
    ) => pointer(engine, target, type, x, { clientY: y, ...init });
    return { ...mounted, grid, fills, states, handleIn, press };
}

describe("a fill's drag", () => {
    it("fills down from the range, marking the target, telling the release once and growing the range", () => {
        const { handleIn, press, fills, view, model, states } = setup({
            activePosition: at(1, 1),
            selectedRange: range([1, 1], [2, 2]),
        });
        const handle = handleIn(2, 2);
        const down = press(handle, "pointerdown", xOf(2), yOf(2));
        // a drag at once: no focus, no text selection
        expect(down.defaultPrevented).toBe(true);
        expect(states.at(-1)).toEqual({
            source: range([1, 1], [2, 2]),
            target: null,
        });
        press(handle, "pointermove", xOf(2), yOf(5));
        frame();
        expect(view().fill).toEqual({
            source: range([1, 1], [2, 2]),
            target: range([3, 1], [5, 2]),
        });
        const part = (rowIndex: number, columnIndex: number) =>
            cellPart(view(), { ...at(rowIndex, columnIndex), loaded: true })
                .state.fillTarget;
        expect(part(4, 1)).toBe(true);
        expect(part(2, 1)).toBe(false);
        expect(part(4, 3)).toBe(false);
        expect(fills).toEqual([]);
        press(handle, "pointerup", xOf(2), yOf(6));
        expect(fills).toEqual([
            { source: range([1, 1], [2, 2]), target: range([3, 1], [6, 2]) },
        ]);
        expect(view().fill).toBeNull();
        // source and target together, the anchor (the active cell) kept
        expect(model.state.selectedRange).toEqual(range([1, 1], [6, 2]));
        expect(model.state.activePosition).toEqual(at(1, 1));
    });

    it("fills to the end when the pointer went farther across, from the active cell without a range", () => {
        const { handleIn, press, fills, model } = setup({
            activePosition: at(3, 1),
        });
        const handle = handleIn(3, 1);
        press(handle, "pointerdown", xOf(1), yOf(3));
        press(handle, "pointermove", xOf(3), yOf(4));
        frame();
        press(handle, "pointerup", xOf(3), yOf(4));
        expect(fills).toEqual([
            { source: range([3, 1], [3, 1]), target: range([3, 2], [3, 3]) },
        ]);
        expect(model.state.selectedRange).toEqual(range([3, 1], [3, 3]));
    });

    it("keeps the active cell's corner of the source: a range dragged upward fills down to its new bottom", () => {
        // the range's anchor (the active cell) at its bottom
        const { handleIn, press, fills, model } = setup({
            activePosition: at(4, 1),
            selectedRange: range([4, 1], [2, 2]),
        });
        const handle = handleIn(4, 2);
        press(handle, "pointerdown", xOf(2), yOf(4));
        press(handle, "pointermove", xOf(2), yOf(6));
        frame();
        press(handle, "pointerup", xOf(2), yOf(6));
        expect(fills).toEqual([
            { source: range([2, 1], [4, 2]), target: range([5, 1], [6, 2]) },
        ]);
        // source and target together, anchored at the bottom: the active cell moves there
        expect(model.state.selectedRange).toEqual(range([6, 1], [2, 2]));
        expect(model.state.activePosition).toEqual(at(6, 1));
    });

    it("keeps an anchor at the source's end: across it moves to the new end, down it stays", () => {
        const { handleIn, press, fills, model } = setup({
            activePosition: at(2, 2),
            selectedRange: range([2, 2], [4, 1]),
        });
        let handle = handleIn(4, 2);
        press(handle, "pointerdown", xOf(2), yOf(4));
        press(handle, "pointermove", xOf(3), yOf(4));
        frame();
        press(handle, "pointerup", xOf(3), yOf(4));
        expect(fills.at(-1)).toEqual({
            source: range([2, 1], [4, 2]),
            target: range([2, 3], [4, 3]),
        });
        expect(model.state.selectedRange).toEqual(range([2, 3], [4, 1]));
        expect(model.state.activePosition).toEqual(at(2, 3));
        // down from there: the anchor at the top and the end stays where it is
        handle = handleIn(4, 3);
        press(handle, "pointerdown", xOf(3), yOf(4));
        press(handle, "pointermove", xOf(3), yOf(6));
        frame();
        press(handle, "pointerup", xOf(3), yOf(6));
        expect(fills.at(-1)).toEqual({
            source: range([2, 1], [4, 3]),
            target: range([5, 1], [6, 3]),
        });
        expect(model.state.selectedRange).toEqual(range([2, 3], [6, 1]));
        expect(model.state.activePosition).toEqual(at(2, 3));
    });

    it("widens its source to the spans it cuts: across starts past them, down covers their columns", () => {
        const columns: Column<Row>[] = COLUMNS.map((column, index) =>
            index === 1
                ? {
                      ...column,
                      colSpan: ({ type, rowIndex }) =>
                          type === "row" && rowIndex % 2 === 0 ? 2 : undefined,
                  }
                : column,
        );
        const { handleIn, press, fills, model } = setup({
            columns,
            activePosition: at(2, 1),
        });
        // the active cell spans c1 and c2: a fill down is as wide
        let handle = handleIn(2, 1);
        press(handle, "pointerdown", xOf(1), yOf(2));
        press(handle, "pointermove", xOf(1), yOf(3));
        frame();
        press(handle, "pointerup", xOf(1), yOf(3));
        expect(fills.at(-1)).toEqual({
            source: range([2, 1], [2, 2]),
            target: range([3, 1], [3, 2]),
        });
        // across, the pointer over the span's last column is over the source: past it, c3
        model.run("selected-range.clear", {});
        model.run("active-position.set", at(4, 1));
        handle = handleIn(4, 1);
        press(handle, "pointerdown", xOf(1), yOf(4));
        press(handle, "pointermove", xOf(2), yOf(4));
        frame();
        press(handle, "pointerup", xOf(2), yOf(4));
        expect(fills).toHaveLength(1);
        press(handle, "pointerdown", xOf(1), yOf(4));
        press(handle, "pointermove", xOf(3), yOf(4));
        frame();
        press(handle, "pointerup", xOf(3), yOf(4));
        expect(fills.at(-1)).toEqual({
            source: range([4, 1], [4, 2]),
            target: range([4, 3], [4, 3]),
        });
        // a range cutting a span on one of its rows: every row's cells widen to it, and an
        // active cell between the edges then takes the first side
        model.run("active-position.set", at(3, 2));
        model.run("selected-range.set", range([3, 2], [4, 3]));
        handle = handleIn(4, 3);
        press(handle, "pointerdown", xOf(3), yOf(4));
        press(handle, "pointermove", xOf(3), yOf(5));
        frame();
        press(handle, "pointerup", xOf(3), yOf(5));
        expect(fills.at(-1)).toEqual({
            source: range([3, 1], [4, 3]),
            target: range([5, 1], [5, 3]),
        });
        expect(model.state.selectedRange).toEqual(range([3, 1], [5, 3]));
        expect(model.state.activePosition).toEqual(at(3, 1));
    });

    it("ends, filling nothing, when an edit opens or the selection changes during it", () => {
        const { handleIn, press, fills, model, view, states } = setup({
            activePosition: at(1, 1),
            selectedRange: range([1, 1], [2, 2]),
        });
        const handle = handleIn(2, 2);
        press(handle, "pointerdown", xOf(2), yOf(2));
        press(handle, "pointermove", xOf(2), yOf(5));
        frame();
        // the same cell under the pointer again: no new state
        const told = states.length;
        press(handle, "pointermove", xOf(2) + 10, yOf(5) + 5);
        frame();
        expect(states).toHaveLength(told);
        model.run("editing-cell.set", at(1, 1));
        expect(view().fill).toBeNull();
        press(handle, "pointerup", xOf(2), yOf(5));
        expect(fills).toEqual([]);
        model.run("editing-cell.clear", {});
        // the press's source and anchor: a selection changing (a key, the app) ends the drag
        press(handle, "pointerdown", xOf(2), yOf(2));
        press(handle, "pointermove", xOf(2), yOf(5));
        frame();
        expect(view().fill?.target).not.toBeNull();
        model.run("selected-range.set", range([1, 1], [3, 3]));
        expect(view().fill).toBeNull();
        press(handle, "pointerup", xOf(2), yOf(5));
        expect(fills).toEqual([]);
        expect(model.state.selectedRange).toEqual(range([1, 1], [3, 3]));
    });

    it("tells nothing over the source or above it, and on Escape, a cancel or a lost capture", () => {
        const { handleIn, press, fills, engine, view } = setup({
            activePosition: at(3, 1),
        });
        const handle = handleIn(3, 1);
        press(handle, "pointerdown", xOf(1), yOf(3));
        press(handle, "pointermove", xOf(0), yOf(1));
        frame();
        expect(view().fill?.target).toBeNull();
        press(handle, "pointerup", xOf(0), yOf(1));
        press(handle, "pointerdown", xOf(1), yOf(3));
        press(handle, "pointermove", xOf(1), yOf(6));
        frame();
        expect(view().fill?.target).not.toBeNull();
        expect(keydown(engine, handle, "Escape").handled).toBe(true);
        expect(view().fill).toBeNull();
        press(handle, "pointerup", xOf(1), yOf(6));
        press(handle, "pointerdown", xOf(1), yOf(3));
        press(handle, "pointermove", xOf(1), yOf(6));
        press(handle, "pointercancel", xOf(1), yOf(6));
        expect(fills).toEqual([]);
        expect(view().fill).toBeNull();
    });

    it("scrolls near the body's edge, a frame at a time, the target from the axes", () => {
        const { handleIn, press, fills, engine } = setup({
            activePosition: at(1, 1),
        });
        const handle = handleIn(1, 1);
        press(handle, "pointerdown", xOf(1), yOf(1));
        press(handle, "pointermove", xOf(1), 300);
        for (let i = 0; i < 50 && frames.size > 0; i++) frame();
        const top = engine.get("scroll-position").top;
        expect(top).toBeGreaterThan(0);
        press(handle, "pointerup", xOf(1), 300);
        expect(fills).toHaveLength(1);
        // the last body row in view, scrolled
        expect(fills[0]?.target.focus.rowIndex).toBe(
            Math.floor((top + 229) / 20),
        );
        expect(frames.size).toBe(0);
    });

    it("is no range's drag, no edit and no click: its press and its click are its own", () => {
        const { handleIn, press, engine, model } = setup({
            activePosition: at(1, 1),
        });
        const handle = handleIn(1, 1);
        press(handle, "pointerdown", xOf(1), yOf(1));
        press(handle, "pointerup", xOf(1), yOf(1));
        // a double click on it edits nothing
        click(engine, handle, { detail: 2 });
        expect(model.state.editingCell).toBeNull();
        expect(model.state.selectedRange).toBeNull();
    });

    it("needs the option: without it, a press on a handle is a plain press", () => {
        const { handleIn, engine, states } = setup(
            { activePosition: at(1, 1) },
            { fillable: false },
        );
        const handle = handleIn(1, 1);
        const event = new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            button: 0,
            buttons: 1,
            pointerId: 1,
        });
        handle.dispatchEvent(event);
        engine.adapter.pointerdown(event);
        expect(event.defaultPrevented).toBe(false);
        expect(states).toEqual([]);
    });
});

describe("the fill's parts", () => {
    it("show the handle at the range's last cell, else the active cell's, never while editing", () => {
        const { view, model } = setup({
            activePosition: at(2, 1),
            selectedRange: range([2, 1], [4, 3]),
        });
        const visible = (rowIndex: number, columnIndex: number) =>
            fillHandlePart(view(), at(rowIndex, columnIndex)).state.visible;
        expect(visible(4, 3)).toBe(true);
        expect(visible(2, 1)).toBe(false);
        expect(fillHandlePart(view(), at(4, 3)).attributes).toEqual({
            [FILL_HANDLE_ATTRIBUTE]: 4,
        });
        expect(fillHandlePart(view(), at(2, 1)).attributes).toBeUndefined();
        model.run("selected-range.clear", {});
        expect(visible(2, 1)).toBe(true);
        model.run("editing-cell.set", at(2, 1));
        expect(visible(2, 1)).toBe(false);
    });

    it("leave a grid that does not fill unchanged", () => {
        const { view } = setup(
            { activePosition: at(2, 1) },
            { fillable: false },
        );
        expect(fillHandlePart(view(), at(2, 1)).state.visible).toBe(false);
        expect(
            cellPart(view(), { ...at(2, 1), loaded: true }).state.fillTarget,
        ).toBeUndefined();
    });
});

describe("repeatedFill", () => {
    it("repeats the source's rows down and its columns across, starting again after the last", () => {
        const valueAt = ({
            rowIndex,
            columnIndex,
        }: {
            rowIndex: number;
            columnIndex: number;
        }) => `${rowIndex}:${columnIndex}`;
        expect(
            repeatedFill(
                {
                    source: range([1, 1], [2, 2]),
                    target: range([3, 1], [5, 2]),
                },
                valueAt,
            ).map(
                (cell) =>
                    `${cell.rowIndex},${cell.columnIndex}=${String(cell.value)}`,
            ),
        ).toEqual([
            "3,1=1:1",
            "3,2=1:2",
            "4,1=2:1",
            "4,2=2:2",
            "5,1=1:1",
            "5,2=1:2",
        ]);
        expect(
            repeatedFill(
                {
                    source: range([0, 0], [0, 1]),
                    target: range([0, 2], [0, 4]),
                },
                valueAt,
            ).map((cell) => cell.value),
        ).toEqual(["0:0", "0:1", "0:0"]);
    });
});
