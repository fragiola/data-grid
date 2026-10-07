// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
    type Column,
    createDataGridEngine,
    createDataGridModel,
} from "../../src";
import {
    cellElement,
    fakeResizeObserver,
    fakeViewport,
    keyEvent as keyFrom,
    type Row,
} from "./harness";

// A grid nested in a cell of another one is its own grid (#17): each engine looks only at its own
// cells, keys and focus, and the outer grid sees focus inside the inner one as focus inside the
// cell that holds it.

const COLUMNS: Column<Row>[] = [
    { key: "a", width: 100 },
    { key: "b", width: 100 },
];

/** An engine on a viewport jsdom cannot lay out: a fixed client size, scroll offsets kept. */
function grid(parent: Element, rowCount = 5) {
    fakeResizeObserver();
    const model = createDataGridModel<Row>({
        columns: COLUMNS,
        rowCount,
        getRow: (id) => ({ id }),
        rowHeight: 20,
        headerRowHeight: 20,
    });
    const engine = createDataGridEngine(model);
    const { element: viewport } = fakeViewport({ width: 200, height: 120 });
    parent.append(viewport);
    engine.adapter.attach(viewport);
    /** A cell element of this grid, appended in the given order. */
    const cell = (rowIndex: number, columnIndex: number) =>
        cellElement(viewport, rowIndex, columnIndex);
    return { model, engine, viewport, cell };
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
        // the inner grid has more to scroll (its end is Epic #89's: chained to the outer grid)
        inner.viewport.style.overflowY = "auto";
        Object.defineProperty(inner.viewport, "scrollHeight", {
            get: () => 200,
        });
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

describe("a nested grid's tab stop (Epic #89, E5.2)", () => {
    const tabbable = (engine: ReturnType<typeof grid>["engine"]) =>
        engine.adapter.getView().tabbable;
    /** The adapter commits the view a command made: the nested grids are told then. */
    const commit = (engine: ReturnType<typeof grid>["engine"]) =>
        engine.adapter.commit(engine.adapter.getView());

    it("is its holder's: in the tab order while the outer active cell holds it, or focus is in it", () => {
        const { outer, inner, sameIndexes, innerCell } = nested();
        // a grid on its own is always a tab stop
        expect(tabbable(outer.engine)).toBe(true);
        // nested, its holder not active: not in the tab order
        expect(tabbable(inner.engine)).toBe(false);
        outer.model.run("active-position.set", { rowIndex: 0, columnIndex: 1 });
        commit(outer.engine);
        expect(tabbable(inner.engine)).toBe(true);
        outer.model.run("active-position.set", { rowIndex: 0, columnIndex: 0 });
        commit(outer.engine);
        expect(tabbable(inner.engine)).toBe(false);
        // focus inside it keeps it, whatever the outer grid's active cell (a controlled parent)
        outer.model.use((ctx, next) =>
            ctx.command === "active-position.set"
                ? { ok: false, error: { code: "vetoed", message: "no" } }
                : next(),
        );
        innerCell.focus();
        expect(tabbable(inner.engine)).toBe(true);
        sameIndexes.focus();
        expect(tabbable(inner.engine)).toBe(false);
    });

    it("follows the row at the active index: a sort moving its holder away leaves it no stop", () => {
        const { outer, inner, holder } = nested();
        outer.model.run("active-position.set", { rowIndex: 0, columnIndex: 1 });
        commit(outer.engine);
        expect(tabbable(inner.engine)).toBe(true);
        // the app sorts its rows: the active cell stays at (0, 1), its holder's row is now row 3
        outer.model.run("data.set", {
            rowCount: 5,
            getRow: (index: number) => ({ id: 4 - index }),
        });
        holder.setAttribute("data-row-index", "3");
        commit(outer.engine);
        expect(outer.model.get("active-position")).toEqual({
            rowIndex: 0,
            columnIndex: 1,
        });
        expect(tabbable(inner.engine)).toBe(false);
    });

    it("finds its holder attached after it (refs attach child first), in a detail by its row", () => {
        fakeResizeObserver();
        const { element: outerViewport } = fakeViewport({
            width: 200,
            height: 120,
        });
        document.body.append(outerViewport);
        // a row's detail: a row index, no column
        const row = document.createElement("div");
        row.setAttribute("data-row-index", "2");
        outerViewport.append(row);
        const inner = grid(row);
        commit(inner.engine);
        expect(tabbable(inner.engine)).toBe(true);
        const model = createDataGridModel<Row>({
            columns: COLUMNS,
            rowCount: 5,
            getRow: (id) => ({ id }),
            rowHeight: 20,
        });
        const engine = createDataGridEngine(model);
        engine.adapter.attach(outerViewport);
        expect(tabbable(inner.engine)).toBe(false);
        model.run("active-position.set", { rowIndex: 2, columnIndex: 1 });
        commit(engine);
        expect(tabbable(inner.engine)).toBe(true);
        model.run("active-position.set", { rowIndex: 3, columnIndex: 1 });
        commit(engine);
        expect(tabbable(inner.engine)).toBe(false);
    });

    it("takes the nearest grid for its holder, a middle one attached after it and the outermost", () => {
        const outer = grid(document.body);
        const outerHolder = outer.cell(0, 1);
        // the middle grid's viewport is in the page before it attaches; the deepest grid attaches
        // first (its cells' refs), then the middle one
        fakeResizeObserver();
        const { element: middleViewport } = fakeViewport({
            width: 200,
            height: 120,
        });
        outerHolder.append(middleViewport);
        const middleHolder = cellElement(middleViewport, 1, 0);
        const deep = grid(middleHolder);
        const middleModel = createDataGridModel<Row>({
            columns: COLUMNS,
            rowCount: 5,
            getRow: (id) => ({ id }),
            rowHeight: 20,
        });
        const middle = createDataGridEngine(middleModel);
        middle.adapter.attach(middleViewport);
        // the outer grid's active cell holds the middle grid, not the deepest one's holder
        outer.model.run("active-position.set", { rowIndex: 0, columnIndex: 1 });
        commit(outer.engine);
        expect(tabbable(middle)).toBe(true);
        expect(tabbable(deep.engine)).toBe(false);
        middleModel.run("active-position.set", { rowIndex: 1, columnIndex: 0 });
        commit(middle);
        expect(tabbable(deep.engine)).toBe(true);
    });

    it("keeps its tab stop through the window losing focus (focus stays in it)", () => {
        const { outer, inner, innerCell } = nested();
        // the outer active cell never follows: only focus inside keeps the inner tab stop
        outer.model.use((ctx, next) =>
            ctx.command === "active-position.set"
                ? { ok: false, error: { code: "vetoed", message: "no" } }
                : next(),
        );
        innerCell.focus();
        expect(tabbable(inner.engine)).toBe(true);
        // alt-tab, the devtools: a focusout to nowhere while the document has no focus
        const hasFocus = vi.spyOn(document, "hasFocus").mockReturnValue(false);
        innerCell.dispatchEvent(
            new FocusEvent("focusout", { bubbles: true, relatedTarget: null }),
        );
        expect(tabbable(inner.engine)).toBe(true);
        hasFocus.mockRestore();
    });

    it("is hosted by the next grid out, or is its own, once its host detaches", () => {
        const { outer, inner, sameIndexes } = nested();
        outer.model.run("active-position.set", { rowIndex: 0, columnIndex: 0 });
        commit(outer.engine);
        expect(tabbable(inner.engine)).toBe(false);
        // the outer grid goes: the inner one is a grid on its own, no longer told by it
        outer.engine.destroy();
        expect(tabbable(inner.engine)).toBe(true);
        sameIndexes.remove();
        // and three deep: the middle one detaching hands the deepest one to the outermost
        const top = grid(document.body);
        const middle = grid(top.cell(0, 1));
        const deep = grid(middle.cell(1, 0));
        top.model.run("active-position.set", { rowIndex: 0, columnIndex: 0 });
        commit(top.engine);
        middle.model.run("active-position.set", {
            rowIndex: 1,
            columnIndex: 0,
        });
        commit(middle.engine);
        expect(tabbable(deep.engine)).toBe(true);
        middle.engine.destroy();
        // the outermost's active cell does not hold it: no tab stop, whatever the middle's was
        expect(tabbable(deep.engine)).toBe(false);
    });

    it("keeps its own tab stop outside any row or cell of its holder (an empty state)", () => {
        const outer = grid(document.body);
        const area = document.createElement("div");
        outer.viewport.append(area);
        const inner = grid(area);
        commit(inner.engine);
        expect(tabbable(inner.engine)).toBe(true);
    });

    it("keeps a tab stop of its own with `ownTabStop`", () => {
        const { inner } = nested();
        expect(tabbable(inner.engine)).toBe(false);
        inner.engine.adapter.setOptions({ ownTabStop: true });
        expect(tabbable(inner.engine)).toBe(true);
        inner.engine.adapter.setOptions({});
        expect(tabbable(inner.engine)).toBe(false);
    });
});

describe("a wheel chained from a nested grid under the outer grid's scaling (Epic #89, E5.2)", () => {
    /** An outer grid of 10M rows (scaled) whose cell (0, 1) holds a 5-row inner grid. */
    function scaled() {
        const outer = grid(document.body, 10_000_000);
        const holder = outer.cell(0, 1);
        const inner = grid(holder);
        const innerCell = inner.cell(0, 0);
        for (const engine of [outer.engine, inner.engine]) {
            engine.adapter.commit(engine.adapter.getView());
        }
        // the inner viewport scrolls its 120px of 200px of content (jsdom lays nothing out)
        inner.viewport.style.overflowY = "auto";
        Object.defineProperty(inner.viewport, "scrollHeight", {
            get: () => 200,
        });
        const wheel = (deltaY: number) => {
            const event = new WheelEvent("wheel", {
                deltaY,
                bubbles: true,
                cancelable: true,
            });
            innerCell.dispatchEvent(event);
            return event.defaultPrevented;
        };
        const scrollTo = (top: number) => {
            inner.viewport.scrollTop = top;
        };
        return { outer, inner, wheel, scrollTo };
    }

    it("is the inner grid's while it can scroll that way", () => {
        const { outer, wheel } = scaled();
        expect(outer.engine.get("scroll-scaled").rows).toBe(true);
        expect(wheel(30)).toBe(false);
        expect(outer.engine.get("scroll-position").top).toBe(0);
    });

    it("moves the outer grid by exactly its delta at the inner grid's end, not a scaled jump", () => {
        const { outer, wheel, scrollTo } = scaled();
        // at the inner grid's end: the outer grid takes it, exactly
        scrollTo(80);
        expect(wheel(30)).toBe(true);
        expect(outer.engine.get("scroll-position").top).toBe(30);
        // back up, the inner grid can scroll again: its own
        expect(wheel(-30)).toBe(false);
        expect(outer.engine.get("scroll-position").top).toBe(30);
        // at its start, up: the outer grid's
        scrollTo(0);
        expect(wheel(-20)).toBe(true);
        expect(outer.engine.get("scroll-position").top).toBe(10);
    });

    it("leaves the wheel to an inner grid that never chains it (`overscroll-behavior`)", () => {
        const { inner, wheel, scrollTo } = scaled();
        inner.viewport.style.setProperty("overscroll-behavior-y", "contain");
        scrollTo(80);
        expect(wheel(30)).toBe(false);
    });
});

describe("a wheel over scrolling content in the grid's own cells, under scaling (Epic #89, E5.2)", () => {
    /** A panel in the outer grid's cell (1, 0): it scrolls `x`, `y` or both, 100 × 50 of 300 × 200. */
    function panelIn(axes: { x?: boolean; y?: boolean }) {
        const outer = grid(document.body, 10_000_000);
        const panel = document.createElement("div");
        outer.cell(1, 0).append(panel);
        outer.engine.adapter.commit(outer.engine.adapter.getView());
        if (axes.x) panel.style.overflowX = "auto";
        if (axes.y) panel.style.overflowY = "auto";
        const scroll = { top: 0, left: 0 };
        Object.defineProperties(panel, {
            clientWidth: { get: () => 100 },
            clientHeight: { get: () => 50 },
            scrollWidth: { get: () => 300 },
            scrollHeight: { get: () => 200 },
            scrollTop: {
                get: () => scroll.top,
                set: (value: number) => {
                    scroll.top = value;
                },
            },
            scrollLeft: {
                get: () => scroll.left,
                set: (value: number) => {
                    scroll.left = value;
                },
            },
        });
        let time = 0;
        const wheel = (deltaX: number, deltaY: number) => {
            // a pause between each: a new gesture, its styles read again
            time += 1_000;
            const event = new WheelEvent("wheel", {
                deltaX,
                deltaY,
                bubbles: true,
                cancelable: true,
            });
            Object.defineProperty(event, "timeStamp", { value: time });
            panel.dispatchEvent(event);
            return event.defaultPrevented;
        };
        const top = () => outer.engine.get("scroll-position").top;
        return { panel, scroll, wheel, top };
    }

    it("leaves a panel in a cell to scroll itself, and takes the wheel at its end", () => {
        const { wheel, scroll, top } = panelIn({ y: true });
        expect(wheel(0, 30)).toBe(false);
        expect(top()).toBe(0);
        scroll.top = 150;
        expect(wheel(0, 30)).toBe(true);
        expect(top()).toBe(30);
    });

    it("decides each axis apart: a diagonal wheel's part the panel cannot take goes to the grid", () => {
        // the panel scrolls sideways only: the vertical part moves the scaled rows, exactly
        const { wheel, scroll, top } = panelIn({ x: true });
        expect(wheel(40, 20)).toBe(true);
        expect(scroll.left).toBe(40);
        expect(scroll.top).toBe(0);
        expect(top()).toBe(20);
        // both its parts the panel's: the browser's
        const both = panelIn({ x: true, y: true });
        expect(both.wheel(40, 20)).toBe(false);
        expect(both.top()).toBe(0);
    });
});
