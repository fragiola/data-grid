// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    ariaRowCount,
    ariaRowDetail,
    ariaRowIndex,
    type Column,
    createDataGridEngine,
    createDataGridModel,
    type RowKey,
    rowCellsHeight,
    rowDetailBox,
    rowExpanded,
    rowTop,
} from "../../src";

// Expanded rows and their details (Epic #41, M1–M4): a detail adds to its row's size in the row
// axis, a row expanding above the view keeps the view where it is, the keys move between rows'
// cells only, and a detail's content owns its keys.

interface Row {
    id: number;
}

let resize: (() => void) | null = null;

class FakeResizeObserver {
    constructor(callback: () => void) {
        resize = callback;
    }
    observe() {}
    disconnect() {}
}

afterEach(() => {
    document.body.innerHTML = "";
    resize = null;
});

const COLUMNS: Column<Row>[] = Array.from({ length: 5 }, (_, i) => ({
    key: `c${i}`,
    width: 100,
}));

function setup(
    options: {
        rows?: number;
        maxScrollSize?: number;
        detailHeight?: number | ((row: Row, rowIndex: number) => number);
        expandedRowKeys?: readonly RowKey[];
        getRow?: (index: number) => Row | undefined;
    } = {},
) {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const model = createDataGridModel<Row>({
        columns: COLUMNS,
        rowCount: options.rows ?? 1_000,
        getRow: options.getRow ?? ((index) => ({ id: index })),
        rowKey: (row) => row.id,
        rowHeight: 20,
        headerRowHeight: 30,
        detailHeight: options.detailHeight ?? 100,
        expandedRowKeys: options.expandedRowKeys,
    });
    const engine = createDataGridEngine(model, {
        overscan: { rows: 2, columns: 1 },
        maxScrollSize: options.maxScrollSize,
    });
    const size = { width: 500, height: 230 };
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
                scroll.left = Math.max(value, 0);
            },
        },
    });
    document.body.append(element);
    const grid = document.createElement("div");
    const body = document.createElement("div");
    element.append(grid);
    grid.append(body);
    engine.adapter.attach(element);
    engine.adapter.registerLayer("grid", grid);
    engine.adapter.registerLayer("body", body);
    /** The adapter rendering the view: a row element per row, its cells, its detail. */
    const render = () => {
        const current = view();
        body.replaceChildren(
            ...current.rows.map((rowIndex) => {
                const row = document.createElement("div");
                row.dataset.rowIndex = String(rowIndex);
                for (const columnIndex of current.columns) {
                    const cell = document.createElement("div");
                    cell.dataset.rowIndex = String(rowIndex);
                    cell.dataset.columnIndex = String(columnIndex);
                    cell.tabIndex = -1;
                    row.append(cell);
                }
                if (rowExpanded(current, rowIndex)) {
                    const detail = document.createElement("div");
                    detail.dataset.gridPart = "row-detail";
                    detail.dataset.rowIndex = String(rowIndex);
                    const button = document.createElement("button");
                    detail.append(button);
                    row.append(detail);
                }
                return row;
            }),
        );
        engine.adapter.commit(current);
    };
    render();
    const top = () => engine.get("scroll-position").top;
    const keydown = (key: string, target: Element = body) => {
        const event = new KeyboardEvent("keydown", { key, cancelable: true });
        Object.defineProperty(event, "target", { value: target });
        const handled = engine.adapter.keydown(event);
        render();
        return handled;
    };
    return { model, engine, element, body, size, view, render, top, keydown };
}

describe("details in the row axis", () => {
    it("add nothing while no row is expanded", () => {
        const { model, view, render } = setup();
        expect(view().rowAxis.fixed).toBe(true);
        expect(view().expandedRows).toEqual([]);
        const before = view().rowAxis;
        model.run("expanded-rows.toggle", { rowIndex: 3 });
        model.run("expanded-rows.toggle", { rowIndex: 3 });
        render();
        expect(view().rowAxis.totalSize).toBe(before.totalSize);
        expect(view().rowAxis.fixed).toBe(true);
    });

    it("add an expanded row's detail below its cells", () => {
        const { model, view, render } = setup();
        model.run("expanded-rows.toggle", { rowIndex: 2 });
        render();
        const current = view();
        expect(current.expandedRows).toEqual([2]);
        expect(rowExpanded(current, 2)).toBe(true);
        expect(rowExpanded(current, 3)).toBe(false);
        expect(current.rowAxis.totalSize).toBe(1_000 * 20 + 100);
        expect(rowTop(current, 2)).toBe(40);
        expect(current.rowAxis.sizeOf(2)).toBe(120);
        expect(rowCellsHeight(current, 2)).toBe(20);
        expect(rowTop(current, 3)).toBe(160);
        expect(rowDetailBox(current, 2)).toEqual({
            top: 20,
            start: 0,
            width: 500,
            height: 100,
        });
        expect(rowDetailBox(current, 3)).toBeNull();
    });

    it("take a detail's height from its row", () => {
        const { model, view } = setup({
            detailHeight: (row) => 50 + row.id,
            expandedRowKeys: [1, 4],
        });
        expect(rowDetailBox(view(), 1)?.height).toBe(51);
        expect(rowDetailBox(view(), 4)?.height).toBe(54);
        model.run("sizes.set", { detailHeight: 10 });
        expect(rowDetailBox(view(), 4)?.height).toBe(10);
        expect(view().rowAxis.totalSize).toBe(1_000 * 20 + 20);
    });

    it("count under scroll scaling, and a row past a detail is reached exactly", () => {
        const { model, engine, view, render, top } = setup({
            rows: 1_000_000,
            maxScrollSize: 1_000_000,
        });
        model.run("expanded-rows.toggle", { rowKey: 500_000 });
        render();
        expect(engine.get("scroll-scaled").rows).toBe(true);
        expect(view().rowAxis.offsetOf(500_001)).toBe(500_001 * 20 + 100);
        engine.run("scroll-to-cell", { rowIndex: 500_001, align: "start" });
        render();
        expect(top()).toBe(500_001 * 20 + 100);
        expect(engine.get("row-window").visible.start).toBe(500_001);
        engine.run("scroll-to-cell", { rowIndex: 500_000, align: "start" });
        render();
        expect(top()).toBe(500_000 * 20);
        expect(view().rows).toContain(500_000);
        expect(rowTop(view(), 500_001) - rowTop(view(), 500_000)).toBe(120);
    });
});

describe("anchoring", () => {
    it("keeps the view where it is when a row above it expands or collapses", () => {
        const { model, engine, render, top } = setup();
        engine.run("scroll-to", { top: 2_005 });
        render();
        expect(engine.get("row-window").visible.start).toBe(100);
        model.run("expanded-rows.toggle", { rowIndex: 10 });
        render();
        expect(top()).toBe(2_105);
        expect(engine.get("row-window").visible.start).toBe(100);
        model.run("expanded-rows.toggle", { rowIndex: 10 });
        render();
        expect(top()).toBe(2_005);
        // in the view or below it: nothing above moves
        model.run("expanded-rows.toggle", { rowIndex: 100 });
        model.run("expanded-rows.toggle", { rowIndex: 104 });
        render();
        expect(top()).toBe(2_005);
    });

    it("keeps it when the details above and below change by as much", () => {
        const { model, engine, render, top, element } = setup({
            detailHeight: 200,
            expandedRowKeys: [10, 300],
        });
        engine.run("scroll-to", { top: 2_305 });
        render();
        const total = engine.adapter.getView().rowAxis.totalSize;
        // one command: the detail above grows by 100, the one below shrinks by 100
        model.run("sizes.set", {
            detailHeight: (row) => (row.id === 10 ? 300 : 100),
        });
        render();
        expect(engine.adapter.getView().rowAxis.totalSize).toBe(total);
        expect(top()).toBe(2_405);
        expect(element.scrollTop).toBe(2_405);
    });

    it("keeps it under scroll scaling too", () => {
        const { model, engine, render, top } = setup({
            rows: 1_000_000,
            maxScrollSize: 1_000_000,
        });
        engine.run("scroll-to", { top: 600_000 * 20 + 7 });
        render();
        model.run("expanded-rows.set", { rowKeys: [10, 599_999, 700_000] });
        render();
        expect(top()).toBe(600_000 * 20 + 7 + 200);
        expect(engine.get("row-window").visible.start).toBe(600_000);
    });

    it("keeps it when an expanded row arrives above the view", () => {
        const cache = new Map<number, Row>();
        const { model, engine, render, top } = setup({
            getRow: (index) => cache.get(index),
            expandedRowKeys: [5],
        });
        engine.run("scroll-to", { top: 4_000 });
        render();
        cache.set(5, { id: 5 });
        model.run("rows.changed", { start: 0, end: 10 });
        render();
        expect(top()).toBe(4_100);
    });
});

describe("keys and focus with details", () => {
    it("the arrows move between rows' cells, never into a detail", () => {
        const { model, keydown, top } = setup({ detailHeight: 300 });
        model.run("expanded-rows.toggle", { rowIndex: 2 });
        model.run("active-position.set", { rowIndex: 2, columnIndex: 0 });
        expect(keydown("ArrowDown")).toBe(true);
        expect(model.get("active-position")).toEqual({
            rowIndex: 3,
            columnIndex: 0,
        });
        // row 3's cells, past the detail, are brought into view: their end at the view's end
        expect(top()).toBe(380 - 200);
        keydown("ArrowUp");
        expect(model.get("active-position")).toEqual({
            rowIndex: 2,
            columnIndex: 0,
        });
        expect(top()).toBe(40);
    });

    it("a move onto an expanded row shows its cells, not its detail's end", () => {
        const { model, keydown, top } = setup();
        model.run("expanded-rows.toggle", { rowIndex: 5 });
        model.run("active-position.set", { rowIndex: 4, columnIndex: 0 });
        keydown("ArrowDown");
        expect(model.get("active-position")?.rowIndex).toBe(5);
        expect(top()).toBe(0);
    });

    it("a key or a focus inside a detail is not the grid's", () => {
        const { model, body, keydown, render } = setup();
        model.run("expanded-rows.toggle", { rowIndex: 1 });
        model.run("active-position.set", { rowIndex: 0, columnIndex: 0 });
        render();
        const button = body.querySelector(
            '[data-grid-part="row-detail"] button',
        );
        expect(button).not.toBeNull();
        if (!button) return;
        expect(keydown("ArrowDown", button)).toBe(false);
        button.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        expect(model.get("active-position")).toEqual({
            rowIndex: 0,
            columnIndex: 0,
        });
    });

    it("a key on a focusable detail itself is not the grid's", () => {
        const { model, engine, body, keydown, render } = setup();
        model.run("expanded-rows.toggle", { rowIndex: 1 });
        model.run("active-position.set", { rowIndex: 0, columnIndex: 0 });
        render();
        const detail = body.querySelector<HTMLElement>(
            '[data-grid-part="row-detail"]',
        );
        if (!detail) throw new Error("no detail");
        detail.tabIndex = 0;
        engine.adapter.registerLayer("detail", detail);
        expect(keydown("ArrowDown", detail)).toBe(false);
        expect(model.get("active-position")?.rowIndex).toBe(0);
    });

    it("tabbing into the grid passes over a row whose cells scrolled away", () => {
        const { model, engine, element, render } = setup({ detailHeight: 300 });
        model.run("expanded-rows.toggle", { rowIndex: 0 });
        // row 0's cells above the view, its detail and row 1 in it
        engine.run("scroll-to", { top: 150 });
        render();
        const { visible } = engine.get("row-window");
        expect(visible.start).toBe(0);
        expect(visible.end).toBeGreaterThan(1);
        element.dispatchEvent(new FocusEvent("focusin"));
        expect(model.get("active-position")).toEqual({
            rowIndex: 1,
            columnIndex: 0,
        });
    });

    it("tabbing into a view the detail fills keeps its row: the next one is not in view", () => {
        const { model, engine, element, render } = setup({ detailHeight: 300 });
        model.run("expanded-rows.toggle", { rowIndex: 0 });
        engine.run("scroll-to", { top: 50 });
        render();
        element.dispatchEvent(new FocusEvent("focusin"));
        expect(model.get("active-position")?.rowIndex).toBe(0);
    });
});

describe("details and ARIA", () => {
    it("change no row count or index: a detail is a cell of its row", () => {
        const { model, view, render } = setup();
        const count = ariaRowCount(view());
        model.run("expanded-rows.toggle", { rowIndex: 2 });
        render();
        expect(ariaRowCount(view())).toBe(count);
        expect(ariaRowIndex(view(), 3)).toBe(5);
        expect(ariaRowDetail(view())).toEqual({
            "aria-colindex": 1,
            "aria-colspan": 5,
        });
    });
});

describe("rendering with details", () => {
    it("renders nothing when rows off screen change, a detail's height a function", () => {
        const { model, engine, render } = setup({
            detailHeight: (row) => 50 + row.id,
            expandedRowKeys: [1],
        });
        render();
        const listener = vi.fn();
        engine.adapter.subscribe(listener);
        model.run("rows.changed", { start: 500, end: 600 });
        expect(listener).not.toHaveBeenCalled();
        model.run("rows.changed", { start: 1, end: 2 });
        expect(listener).toHaveBeenCalled();
    });

    it("renders again on a resize only while a row is expanded", () => {
        const { model, engine, size, view } = setup();
        const listener = vi.fn();
        engine.adapter.subscribe(listener);
        size.width = 450;
        resize?.();
        expect(listener).not.toHaveBeenCalled();
        model.run("expanded-rows.toggle", { rowIndex: 1 });
        listener.mockClear();
        size.width = 400;
        resize?.();
        expect(listener).toHaveBeenCalled();
        expect(rowDetailBox(view(), 1)?.width).toBe(400);
        // an expanded row off screen: a resize renders nothing
        model.run("expanded-rows.set", { rowKeys: [900] });
        listener.mockClear();
        size.width = 380;
        resize?.();
        expect(listener).not.toHaveBeenCalled();
    });
});
