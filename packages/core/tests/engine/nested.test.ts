// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    type Column,
    createDataGridEngine,
    createDataGridModel,
} from "../../src";

// A grid nested in a cell of another one is its own grid (#17): each engine looks only at its own
// cells, keys and focus, and the outer grid sees focus inside the inner one as focus inside the
// cell that holds it.

interface Row {
    id: number;
}

class FakeResizeObserver {
    observe() {}
    disconnect() {}
}

afterEach(() => {
    document.body.innerHTML = "";
});

const COLUMNS: Column<Row>[] = [
    { key: "a", width: 100 },
    { key: "b", width: 100 },
];

/** An engine on a viewport jsdom cannot lay out: a fixed client size, scroll offsets kept. */
function grid(parent: Element, rowCount = 5) {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const model = createDataGridModel<Row>({
        columns: COLUMNS,
        rowCount,
        getRow: (id) => ({ id }),
        rowHeight: 20,
        headerRowHeight: 20,
    });
    const engine = createDataGridEngine(model);
    const viewport = document.createElement("div");
    let top = 0;
    let left = 0;
    Object.defineProperties(viewport, {
        clientWidth: { get: () => 200 },
        clientHeight: { get: () => 120 },
        scrollTop: {
            get: () => top,
            set: (value: number) => {
                top = value;
            },
        },
        scrollLeft: {
            get: () => left,
            set: (value: number) => {
                left = value;
            },
        },
    });
    parent.append(viewport);
    engine.adapter.attach(viewport);
    /** A cell element of this grid, appended in the given order. */
    const cell = (rowIndex: number, columnIndex: number) => {
        const element = document.createElement("div");
        element.dataset.rowIndex = String(rowIndex);
        element.dataset.columnIndex = String(columnIndex);
        element.tabIndex = -1;
        viewport.append(element);
        return element;
    };
    return { model, engine, viewport, cell };
}

function keyFrom(target: Element, key: string): KeyboardEvent {
    const event = new KeyboardEvent("keydown", {
        key,
        cancelable: true,
        bubbles: true,
    });
    Object.defineProperty(event, "target", { value: target });
    return event;
}

/** An outer grid whose cell (0, 1) holds an inner grid, appended before the outer cell (0, 0). */
function nested() {
    const outer = grid(document.body);
    const holder = outer.cell(0, 1);
    const sameIndexes = outer.cell(0, 0);
    const inner = grid(holder);
    const innerCell = inner.cell(0, 0);
    const innerOther = inner.cell(1, 1);
    for (const engine of [outer.engine, inner.engine]) {
        engine.adapter.commit(engine.adapter.getView());
    }
    return { outer, inner, holder, sameIndexes, innerCell, innerOther };
}

describe("nested grids", () => {
    it("activate the outer cell holding the inner grid, and the inner cell in the inner grid", () => {
        const { outer, inner, innerOther } = nested();
        innerOther.focus();
        expect(inner.model.get("active-position")).toEqual({
            rowIndex: 1,
            columnIndex: 1,
        });
        expect(outer.model.get("active-position")).toEqual({
            rowIndex: 0,
            columnIndex: 1,
        });
    });

    it("leave a key from inside the inner grid to the inner grid", () => {
        const { outer, inner, innerCell } = nested();
        innerCell.focus();
        const before = outer.model.get("active-position");
        // the inner grid handles it first (React bubbles through the inner root)
        expect(
            inner.engine.adapter.keydown(keyFrom(innerCell, "ArrowDown")),
        ).toBe(true);
        expect(inner.model.get("active-position")).toEqual({
            rowIndex: 1,
            columnIndex: 0,
        });
        // a key the inner grid did not take is still not the outer grid's
        const unhandled = keyFrom(innerCell, "ArrowRight");
        expect(outer.engine.adapter.keydown(unhandled)).toBe(false);
        expect(unhandled.defaultPrevented).toBe(false);
        expect(outer.model.get("active-position")).toEqual(before);
    });

    it("focus the outer grid's own cell, never the inner one at the same indexes", () => {
        const { outer, holder, sameIndexes } = nested();
        holder.focus();
        // ArrowLeft from (0, 1) to (0, 0): the inner grid has a (0, 0) cell earlier in the page
        outer.engine.adapter.keydown(keyFrom(holder, "ArrowLeft"));
        outer.engine.adapter.commit(outer.engine.adapter.getView());
        expect(outer.model.get("active-position")).toEqual({
            rowIndex: 0,
            columnIndex: 0,
        });
        expect(document.activeElement).toBe(sameIndexes);
    });

    it("keep focus inside the inner grid when the outer cell holding it becomes active", () => {
        // two inner grids: the first, earlier in the page, has a cell at the holder's indexes
        const outer = grid(document.body);
        const first = grid(outer.cell(0, 0));
        const decoy = first.cell(0, 1);
        const holder = outer.cell(0, 1);
        const inner = grid(holder);
        const innerCell = inner.cell(1, 0);
        for (const engine of [outer.engine, first.engine, inner.engine]) {
            engine.adapter.commit(engine.adapter.getView());
        }
        innerCell.focus();
        expect(outer.model.get("active-position")).toEqual({
            rowIndex: 0,
            columnIndex: 1,
        });
        outer.engine.adapter.commit(outer.engine.adapter.getView());
        // focus stays in the inner grid: not pulled to the decoy at (0, 1) in the first grid
        expect(document.activeElement).toBe(innerCell);
        expect(document.activeElement).not.toBe(decoy);
    });

    it("leave a wheel over the inner grid to it, even when the outer grid is scaled", () => {
        // a million rows of 20px: the outer grid scales its scroll, and handles the wheel itself
        const outer = grid(document.body, 1_000_000);
        const own = outer.cell(1, 0);
        const inner = grid(outer.cell(0, 1));
        const innerCell = inner.cell(0, 0);
        for (const engine of [outer.engine, inner.engine]) {
            engine.adapter.commit(engine.adapter.getView());
        }
        const wheel = (target: Element) => {
            const event = new WheelEvent("wheel", {
                deltaY: 100,
                bubbles: true,
                cancelable: true,
            });
            target.dispatchEvent(event);
            return event;
        };
        expect(wheel(innerCell).defaultPrevented).toBe(false);
        expect(outer.viewport.scrollTop).toBe(0);
        // over its own cells, the outer grid takes the wheel
        expect(wheel(own).defaultPrevented).toBe(true);
        expect(outer.viewport.scrollTop).toBeGreaterThan(0);
    });
});
