// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    type Column,
    createDataGridEngine,
    createDataGridModel,
    type DataGridEngine,
    type DataGridModel,
    type EngineEventMap,
} from "../../src";

// The engine against a viewport jsdom cannot lay out: its client size, its scroll offsets
// (clamped to the scrollable range of the view the engine reports) and ResizeObserver are faked.

interface Row {
    id: number;
}

const COLUMNS: Column<Row>[] = Array.from({ length: 50 }, (_, i) => ({
    key: `c${i}`,
    width: 100,
}));

let resize: (() => void) | null = null;

class FakeResizeObserver {
    constructor(callback: () => void) {
        resize = callback;
    }
    observe() {}
    disconnect() {
        resize = null;
    }
}

afterEach(() => {
    document.body.innerHTML = "";
    resize = null;
});

function setup(
    options: {
        rows?: number;
        rowHeight?: number | ((index: number) => number);
        width?: number;
        height?: number;
        columns?: Column<Row>[];
        maxScrollSize?: number;
    } = {},
) {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const model = createDataGridModel<Row>({
        columns: options.columns ?? COLUMNS,
        rowCount: options.rows ?? 1_000,
        getRow: (index) => ({ id: index }),
        rowHeight: options.rowHeight ?? 20,
        headerRowHeight: 30,
    });
    const engine = createDataGridEngine(model, {
        overscan: { rows: 3, columns: 1 },
        maxScrollSize: options.maxScrollSize,
    });
    const size = { width: options.width ?? 500, height: options.height ?? 230 };
    const scroll = { top: 0, left: 0 };
    const element = document.createElement("div");
    const view = () => engine.adapter.getView();
    Object.defineProperties(element, {
        clientWidth: { get: () => size.width },
        clientHeight: { get: () => size.height },
        scrollTop: {
            get: () => scroll.top,
            set: (value: number) => {
                const max = view().headerHeight + view().height - size.height;
                scroll.top = Math.min(Math.max(value, 0), Math.max(max, 0));
            },
        },
        scrollLeft: {
            get: () => scroll.left,
            set: (value: number) => {
                const max = view().width - size.width;
                scroll.left = Math.min(Math.max(value, 0), Math.max(max, 0));
            },
        },
    });
    document.body.append(element);
    const grid = document.createElement("div");
    const header = document.createElement("div");
    const body = document.createElement("div");
    body.dataset.layer = "body";
    element.append(grid);
    grid.append(header, body);
    const detach = engine.adapter.attach(element);
    engine.adapter.registerLayer("grid", grid);
    engine.adapter.registerLayer("header", header);
    engine.adapter.registerLayer("body", body);
    engine.adapter.commit(view());
    /** a native scroll the engine did not make (the thumb, a fling) */
    const scrollTo = (top: number, left = scroll.left) => {
        element.scrollTop = top;
        element.scrollLeft = left;
        element.dispatchEvent(new Event("scroll"));
    };
    /**
     * The adapter rendering the view it was told about: draws its cells (keeping the ones still
     * rendered, as React keeps keyed elements) and commits it.
     */
    const cells = new Map<string, HTMLElement>();
    const render = () => {
        const current = view();
        const wanted = new Set<string>();
        for (const rowIndex of current.rows) {
            for (const columnIndex of current.columns) {
                const id = `${rowIndex}:${columnIndex}`;
                wanted.add(id);
                if (!cells.has(id)) {
                    const cell = document.createElement("div");
                    cell.dataset.rowIndex = String(rowIndex);
                    cell.dataset.columnIndex = String(columnIndex);
                    cell.tabIndex = -1;
                    cells.set(id, cell);
                    body.append(cell);
                }
            }
        }
        for (const [id, cell] of cells) {
            if (!wanted.has(id)) {
                cell.remove();
                cells.delete(id);
            }
        }
        engine.adapter.commit(current);
    };
    return {
        model,
        engine,
        element,
        grid,
        header,
        body,
        size,
        scroll,
        view,
        scrollTo,
        render,
        detach,
    };
}

function events<K extends keyof EngineEventMap>(
    engine: DataGridEngine<Row>,
    event: K,
) {
    const seen: EngineEventMap[K][] = [];
    engine.subscribe(event, (value) => seen.push(value));
    return seen;
}

/** A keydown as the adapter gets it: from an element inside the grid (the body layer). */
function keyEvent(name: string, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent("keydown", {
        key: name,
        cancelable: true,
        ...init,
    });
    const target = document.querySelector('[data-layer="body"]');
    Object.defineProperty(event, "target", {
        value: target,
        configurable: true,
    });
    return event;
}

function key(
    element: Element,
    name: string,
    init: KeyboardEventInit = {},
): KeyboardEvent {
    const event = new KeyboardEvent("keydown", {
        key: name,
        bubbles: true,
        cancelable: true,
        ...init,
    });
    element.dispatchEvent(event);
    return event;
}

describe("windows", () => {
    it("measure the viewport below the header", () => {
        const { engine, view } = setup();
        // 230px tall, 30px of header: 200px of body, 10 rows of 20px
        expect(engine.get("viewport-size")).toEqual({
            width: 500,
            height: 230,
            bodyHeight: 200,
        });
        expect(engine.get("row-window")).toEqual({
            visible: { start: 0, end: 10 },
            rendered: { start: 0, end: 13 },
        });
        expect(engine.get("column-window")).toEqual({
            visible: { start: 0, end: 5 },
            rendered: { start: 0, end: 6 },
        });
        expect(view().rows).toEqual(Array.from({ length: 13 }, (_, i) => i));
        expect(view().height).toBe(20_000);
        expect(view().width).toBe(5_000);
    });

    it("report a change only when a range changes, and render only when the rendered one does", () => {
        const { engine, scrollTo, view, body } = setup();
        const rows = events(engine, "row-window");
        const renders = vi.fn();
        engine.adapter.subscribe(renders);
        const first = view();
        scrollTo(0); // where it is: nothing changes
        expect(rows).toHaveLength(0);
        scrollTo(40); // two rows down: still inside the overscan
        expect(rows).toHaveLength(1);
        expect(rows[0]?.visible).toEqual({ start: 2, end: 12 });
        expect(renders).not.toHaveBeenCalled();
        expect(view()).toBe(first);
        // and the layer is where the content is, without a render
        expect(body.style.transform).toBe("translate3d(0px, 0px, 0px)");
        scrollTo(200); // ten rows down: out of the rendered range
        expect(renders).toHaveBeenCalledTimes(1);
        expect(view().renderedRows).toEqual({ start: 7, end: 23 });
        expect(rows).toHaveLength(2);
    });

    it("follow a resize", () => {
        const { engine, size } = setup();
        size.height = 430;
        resize?.();
        expect(engine.get("row-window").visible).toEqual({ start: 0, end: 20 });
    });

    it("tell when the view's last rows near the end, once per row count", () => {
        const { engine, model, scrollTo, render } = setup({ rows: 100 });
        const reached = events(engine, "rows-end-reached");
        scrollTo(1_000); // rows 50–60: far from the end
        expect(reached).toHaveLength(0);
        scrollTo(1_600); // rows 80–90: within 10 of 100
        expect(reached).toEqual([{ rowCount: 100 }]);
        scrollTo(1_700);
        expect(reached).toHaveLength(1);
        // the app appends rows: the end moves away, and the next approach fires again
        model.run("data.set", {
            rowCount: 200,
            getRow: (index) => ({ id: index }),
        });
        render();
        expect(reached).toHaveLength(1);
        scrollTo(3_600);
        expect(reached).toEqual([{ rowCount: 100 }, { rowCount: 200 }]);
    });

    it("keeps the scroll position when rows are appended, and renders their overscan", () => {
        const { engine, model, scrollTo, render, scroll } = setup({
            rows: 100,
        });
        scrollTo(1_800); // the bottom: rows 90–100
        model.run("data.set", {
            rowCount: 150,
            getRow: (index) => ({ id: index }),
        });
        render();
        expect(scroll.top).toBe(1_800);
        expect(engine.get("row-window")).toEqual({
            visible: { start: 90, end: 100 },
            rendered: { start: 87, end: 103 },
        });
    });
});

describe("the layers", () => {
    it("are translated for the committed view's bases, only when it changes", () => {
        const { header, body, scrollTo, render } = setup();
        scrollTo(400, 1_000);
        // the view moved out of its rendered range, but the old one is still on screen
        expect(body.style.transform).toBe("translate3d(0px, 0px, 0px)");
        render();
        // rows from 17 (340px), columns from 9 (900px)
        expect(body.style.transform).toBe("translate3d(900px, 340px, 0px)");
        expect(header.style.transform).toBe("translate3d(900px, 0px, 0px)");
        const set = vi.spyOn(body.style, "transform", "set");
        scrollTo(400, 1_000);
        expect(set).not.toHaveBeenCalled();
    });
});

describe("attaching", () => {
    it("is idempotent, and a StrictMode re-attach leaves one set of listeners", () => {
        const { engine, element, detach, scrollTo } = setup();
        const rows = events(engine, "row-window");
        expect(engine.adapter.attach(element)).toBe(detach);
        detach();
        detach();
        engine.adapter.attach(element);
        scrollTo(400);
        expect(rows).toHaveLength(1);
    });

    it("stops listening once detached", () => {
        const { engine, detach, scrollTo } = setup();
        const rows = events(engine, "row-window");
        detach();
        scrollTo(400);
        expect(rows).toHaveLength(0);
    });
});

describe("scroll scaling", () => {
    const ROWS = 100_000_000;

    it("caps the sizer and reaches the last of 100M rows by the scrollbar", () => {
        const { engine, view, scrollTo, element } = setup({ rows: ROWS });
        expect(engine.get("scroll-scaled")).toEqual({
            rows: true,
            columns: false,
        });
        expect(view().height).toBe(10_000_000);
        scrollTo(element.scrollHeight || 10_000_000);
        expect(engine.get("row-window").visible.end).toBe(ROWS);
    });

    it("scrolls a cell into view from anywhere: row 99,999,999", () => {
        const { engine, element, render } = setup({ rows: ROWS });
        engine.run("scroll-to-cell", { rowIndex: ROWS - 1 });
        render();
        const { visible } = engine.get("row-window");
        expect(visible.end).toBe(ROWS);
        expect(engine.get("scroll-position").top).toBe(ROWS * 20 - 200);
        expect(element.scrollTop).toBeGreaterThan(9_999_000);
    });

    it("moves the content by exactly the wheel's delta", () => {
        const { engine, element } = setup({ rows: ROWS });
        engine.run("scroll-to", { top: 1_000_000_000 });
        const before = engine.get("scroll-position").top;
        const event = new WheelEvent("wheel", {
            deltaY: 20,
            cancelable: true,
            bubbles: true,
        });
        element.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(engine.get("scroll-position").top - before).toBe(20);
        // the scroll event the move causes keeps the exact offset
        element.dispatchEvent(new Event("scroll"));
        expect(engine.get("scroll-position").top - before).toBe(20);
    });

    it("leaves the wheel to the browser when nothing is scaled", () => {
        const { element } = setup();
        const event = new WheelEvent("wheel", { deltaY: 20, cancelable: true });
        element.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
    });

    it("translates the layer by physical − virtual, so the virtual offset's rows are in view", () => {
        const { engine, body, render, element } = setup({ rows: ROWS });
        engine.run("scroll-to", { top: 1_000_000_000 });
        render();
        const { rendered } = engine.get("row-window");
        const base = rendered.start * 20;
        expect(body.style.transform).toBe(
            `translate3d(0px, ${element.scrollTop - 1_000_000_000 + base}px, 0px)`,
        );
    });
});

describe("the keyboard", () => {
    function active(model: DataGridModel<Row>) {
        return model.get("active-position");
    }

    it("maps every navigation key onto a move", () => {
        const { model, engine, element } = setup();
        model.run("active-position.set", { rowIndex: 50, columnIndex: 10 });
        const keydown = (name: string, init: KeyboardEventInit = {}) =>
            engine.adapter.keydown(keyEvent(name, init));
        const at = () => [active(model)?.rowIndex, active(model)?.columnIndex];
        expect(keydown("ArrowDown")).toBe(true);
        expect(at()).toEqual([51, 10]);
        keydown("ArrowUp");
        expect(at()).toEqual([50, 10]);
        keydown("ArrowRight");
        expect(at()).toEqual([50, 11]);
        keydown("ArrowLeft");
        expect(at()).toEqual([50, 10]);
        keydown("Home");
        expect(at()).toEqual([50, 0]);
        keydown("End");
        expect(at()).toEqual([50, 49]);
        // a page is the rows in view, less one
        keydown("PageDown");
        expect(at()).toEqual([59, 49]);
        keydown("PageUp");
        expect(at()).toEqual([50, 49]);
        keydown("Home", { ctrlKey: true });
        expect(at()).toEqual([-1, 0]);
        keydown("End", { metaKey: true });
        expect(at()).toEqual([999, 49]);
        expect(keydown("a")).toBe(false);
        expect(keydown("Tab")).toBe(false);
        void element;
    });

    it("prevents the default of a key it handles, and skips keys already handled or typed in a field", () => {
        const { model, engine } = setup();
        model.run("active-position.set", { rowIndex: 5, columnIndex: 5 });
        const handled = keyEvent("ArrowDown");
        engine.adapter.keydown(handled);
        expect(handled.defaultPrevented).toBe(true);

        const cancelled = keyEvent("ArrowDown");
        cancelled.preventDefault();
        expect(engine.adapter.keydown(cancelled)).toBe(false);

        const input = document.createElement("input");
        document.body.append(input);
        const typed = keyEvent("ArrowLeft");
        Object.defineProperty(typed, "target", { value: input });
        expect(engine.adapter.keydown(typed)).toBe(false);
        expect(active(model)).toEqual({ rowIndex: 6, columnIndex: 5 });
    });

    it("starts at the first cell in view when nothing is active", () => {
        const { model, engine, scrollTo } = setup();
        scrollTo(400, 300);
        engine.adapter.keydown(keyEvent("ArrowDown"));
        expect(active(model)).toEqual({ rowIndex: 20, columnIndex: 3 });
    });

    it("scrolls the active cell into view and focuses it once rendered", () => {
        const { model, engine, element, render } = setup();
        render();
        const first = element.querySelector<HTMLElement>(
            '[data-row-index="0"][data-column-index="0"]',
        );
        first?.focus();
        expect(active(model)).toEqual({ rowIndex: 0, columnIndex: 0 });
        for (let i = 0; i < 15; i++) {
            engine.adapter.keydown(keyEvent("ArrowDown"));
            render();
        }
        expect(active(model)).toEqual({ rowIndex: 15, columnIndex: 0 });
        // row 15 at the bottom of the 10-row body: rows 6–15 in view
        expect(engine.get("row-window").visible).toEqual({ start: 6, end: 16 });
        expect(document.activeElement?.getAttribute("data-row-index")).toBe(
            "15",
        );
    });

    it("keeps the active row and column rendered when they scroll out of the window", () => {
        const { model, view, scrollTo } = setup();
        model.run("active-position.set", { rowIndex: 2, columnIndex: 1 });
        scrollTo(10_000, 3_000);
        expect(view().rows[0]).toBe(2);
        expect(view().rows.slice(1, 3)).toEqual([497, 498]);
        expect(view().columns[0]).toBe(1);
    });

    it("lets middleware refuse a move; the key is still consumed", () => {
        const { model, engine } = setup();
        model.run("active-position.set", { rowIndex: 5, columnIndex: 5 });
        model.use((ctx, next) =>
            ctx.command === "active-position.move"
                ? { ok: false, error: { code: "vetoed", message: "no" } }
                : next(),
        );
        const event = keyEvent("ArrowDown");
        expect(engine.adapter.keydown(event)).toBe(true);
        expect(active(model)).toEqual({ rowIndex: 5, columnIndex: 5 });
    });
});

describe("focus", () => {
    it("activates a cell that takes focus (a click, a Tab)", () => {
        const { model, element, render } = setup();
        render();
        element
            .querySelector<HTMLElement>(
                '[data-row-index="3"][data-column-index="2"]',
            )
            ?.focus();
        expect(model.get("active-position")).toEqual({
            rowIndex: 3,
            columnIndex: 2,
        });
    });

    it("moves focus into the first cell in view when the grid itself takes it", () => {
        const { model, grid, render } = setup();
        render();
        grid.tabIndex = 0;
        grid.focus();
        expect(model.get("active-position")).toEqual({
            rowIndex: 0,
            columnIndex: 0,
        });
        render();
        expect(document.activeElement?.getAttribute("data-row-index")).toBe(
            "0",
        );
    });
});

describe("regressions", () => {
    it("leaves focus on a control inside a cell that becomes active", () => {
        const { model, element, render } = setup();
        render();
        const cell = element.querySelector<HTMLElement>(
            '[data-row-index="4"][data-column-index="1"]',
        );
        const button = document.createElement("button");
        cell?.append(button);
        button.focus();
        expect(model.get("active-position")).toEqual({
            rowIndex: 4,
            columnIndex: 1,
        });
        render();
        expect(document.activeElement).toBe(button);
    });

    it("scrolls to the active cell even when it moves before the grown sizer is rendered", () => {
        const { engine, model, scrollTo, render } = setup({ rows: 100 });
        scrollTo(1_800);
        model.run("data.set", {
            rowCount: 300,
            getRow: (index) => ({ id: index }),
        });
        model.run("active-position.set", { rowIndex: 250, columnIndex: 0 });
        render();
        const { visible } = engine.get("row-window");
        expect(visible.start).toBeLessThanOrEqual(250);
        expect(visible.end).toBeGreaterThan(250);
    });

    it("reads a scroll already set when it attaches, instead of resetting it", () => {
        const { engine, element, detach, render } = setup();
        detach();
        element.scrollTop = 400;
        engine.adapter.attach(element);
        render();
        expect(engine.get("scroll-position").top).toBe(400);
        expect(element.scrollTop).toBe(400);
    });

    it("keeps writing the layers after a re-attach that renders the same view", () => {
        const { engine, element, detach, body, scrollTo, render } = setup();
        render();
        detach();
        engine.adapter.attach(element);
        scrollTo(400);
        render();
        expect(body.style.transform).toBe("translate3d(0px, 340px, 0px)");
    });
});

describe("the viewport taking focus", () => {
    it("hands focus to the active cell, or the first in view", () => {
        const { model, element, render } = setup();
        render();
        element.tabIndex = 0;
        element.focus();
        expect(model.get("active-position")).toEqual({
            rowIndex: 0,
            columnIndex: 0,
        });
        render();
        expect(document.activeElement?.getAttribute("data-row-index")).toBe(
            "0",
        );
        model.run("active-position.set", { rowIndex: 3, columnIndex: 2 });
        render();
        element.focus();
        expect(document.activeElement?.getAttribute("data-row-index")).toBe(
            "3",
        );
    });
});

describe("focus that should not activate", () => {
    it("ignores a click on the viewport's empty space", () => {
        const { model, element, render } = setup();
        render();
        element.tabIndex = -1;
        element.dispatchEvent(new Event("pointerdown", { bubbles: true }));
        element.focus();
        expect(model.get("active-position")).toBeNull();
        document.dispatchEvent(new Event("pointerup"));
    });

    it("leaves no focus pending when the first cell is refused", () => {
        const { model, element, render, grid } = setup();
        const input = document.createElement("input");
        document.body.append(input);
        render();
        const remove = model.use((ctx, next) =>
            ctx.command === "active-position.set"
                ? { ok: false, error: { code: "vetoed", message: "no" } }
                : next(),
        );
        grid.tabIndex = 0;
        grid.focus();
        remove();
        input.focus();
        // a later change from code does not pull focus out of the field
        model.run("active-position.set", { rowIndex: 1, columnIndex: 1 });
        render();
        expect(document.activeElement).toBe(input);
        void element;
    });
});

describe("epic review regressions", () => {
    it("scrolls to the initial active cell, and to a cell asked for before attaching", () => {
        vi.stubGlobal("ResizeObserver", FakeResizeObserver);
        const model = createDataGridModel<Row>({
            columns: COLUMNS,
            rowCount: 1_000,
            getRow: (index) => ({ id: index }),
            rowHeight: 20,
            headerRowHeight: 30,
            activePosition: { rowIndex: 500, columnIndex: 0 },
        });
        const engine = createDataGridEngine(model);
        const element = document.createElement("div");
        let top = 0;
        Object.defineProperties(element, {
            clientWidth: { get: () => 500 },
            clientHeight: { get: () => 230 },
            scrollTop: {
                get: () => top,
                set: (v: number) => {
                    top = v;
                },
            },
            scrollLeft: { get: () => 0, set: () => {} },
        });
        document.body.append(element);
        engine.adapter.attach(element);
        engine.adapter.commit(engine.adapter.getView());
        const { visible } = engine.get("row-window");
        expect(visible.start).toBeLessThanOrEqual(500);
        expect(visible.end).toBeGreaterThan(500);

        const other = createDataGridEngine(
            createDataGridModel<Row>({
                columns: COLUMNS,
                rowCount: 1_000,
                getRow: (index) => ({ id: index }),
                rowHeight: 20,
            }),
        );
        other.run("scroll-to-cell", { rowIndex: 800 });
        top = 0;
        other.adapter.attach(element);
        other.adapter.commit(other.adapter.getView());
        expect(other.get("row-window").visible.end).toBeGreaterThan(800);
    });

    it("forgets a press the browser cancelled (a touch that became a scroll)", () => {
        const { model, element, render } = setup();
        render();
        element.dispatchEvent(new Event("pointerdown", { bubbles: true }));
        document.dispatchEvent(new Event("pointercancel"));
        element.tabIndex = -1;
        element.focus();
        expect(model.get("active-position")).toEqual({
            rowIndex: 0,
            columnIndex: 0,
        });
    });

    it("never pulls focus back from a field outside the grid", () => {
        const { model, engine, render } = setup();
        render();
        const outside = document.createElement("input");
        document.body.append(outside);
        // a cell the app does not render (no header cells here): its focus stays pending
        model.run("active-position.set", { rowIndex: 0, columnIndex: 0 });
        engine.adapter.keydown(keyEvent("Home", { ctrlKey: true }));
        outside.focus();
        render();
        expect(document.activeElement).toBe(outside);
    });

    it("pages with Space by exactly the body's height under scaling", () => {
        const { engine } = setup({ rows: 100_000_000 });
        engine.run("scroll-to", { top: 1_000_000_000 });
        const event = keyEvent(" ");
        expect(engine.adapter.keydown(event)).toBe(true);
        expect(event.defaultPrevented).toBe(true);
        expect(engine.get("scroll-position").top).toBe(1_000_000_200);
    });
});

describe("events and keys", () => {
    it("never leaves keydown to a global listener: keys reach it through the adapter", () => {
        const { model, element } = setup();
        model.run("active-position.set", { rowIndex: 1, columnIndex: 1 });
        key(element, "ArrowDown");
        expect(model.get("active-position")).toEqual({
            rowIndex: 1,
            columnIndex: 1,
        });
    });
});
