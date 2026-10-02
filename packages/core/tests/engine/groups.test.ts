// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    ariaHeaderCellSpans,
    ariaRowCount,
    ariaRowIndex,
    type Column,
    type ColumnOrGroup,
    createDataGridEngine,
    createDataGridModel,
    headerCellBox,
} from "../../src";

// The engine with column groups (Epic #13): N header rows, the header cells a column window needs
// (a group cut by it included), and the keyboard across header rows without scrolling a group
// already in view out of it.

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

const column = (key: string): Column<Row> => ({ key, width: 100 });
const letters = (from: string, count: number) =>
    Array.from({ length: count }, (_, i) =>
        column(String.fromCharCode(from.charCodeAt(0) + i)),
    );

// "id" spans both header rows; P holds columns 1–10, Q columns 11–20 (100px each)
const COLUMNS: ColumnOrGroup<Row>[] = [
    column("id"),
    { key: "P", children: letters("a", 10) },
    { key: "Q", children: letters("k", 10) },
];

function setup(columns: ColumnOrGroup<Row>[] = COLUMNS) {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const model = createDataGridModel<Row>({
        columns,
        rowCount: 1_000,
        getRow: (id) => ({ id }),
        rowHeight: 20,
        headerRowHeight: 30,
    });
    const engine = createDataGridEngine(model, {
        overscan: { rows: 2, columns: 1 },
    });
    const view = () => engine.adapter.getView();
    const scroll = { top: 0, left: 0 };
    const viewport = document.createElement("div");
    Object.defineProperties(viewport, {
        clientWidth: { get: () => 300 },
        clientHeight: { get: () => 260 },
        scrollTop: {
            get: () => scroll.top,
            set: (value: number) => {
                scroll.top = Math.max(0, value);
            },
        },
        scrollLeft: {
            get: () => scroll.left,
            set: (value: number) => {
                scroll.left = Math.min(Math.max(0, value), view().width - 300);
            },
        },
    });
    const grid = document.createElement("div");
    viewport.append(grid);
    document.body.append(viewport);
    engine.adapter.attach(viewport);
    engine.adapter.registerLayer("grid", grid);
    engine.adapter.commit(view());
    const scrollLeft = (left: number) => {
        viewport.scrollLeft = left;
        viewport.dispatchEvent(new Event("scroll"));
        engine.adapter.commit(view());
    };
    const key = (name: string) => {
        const event = new KeyboardEvent("keydown", {
            key: name,
            cancelable: true,
        });
        Object.defineProperty(event, "target", { value: grid });
        engine.adapter.keydown(event);
        engine.adapter.commit(view());
    };
    const headerKeys = () =>
        view().headerRows.map((row) => row.cells.map((cell) => cell.key));
    /** a header cell's element, as an adapter renders it: at its top row and first column */
    const headerCell = (rowIndex: number, columnIndex: number) => {
        const element = document.createElement("div");
        element.dataset.rowIndex = String(rowIndex);
        element.dataset.columnIndex = String(columnIndex);
        element.tabIndex = -1;
        grid.append(element);
        return element;
    };
    return {
        model,
        engine,
        view,
        scroll,
        scrollLeft,
        key,
        headerKeys,
        headerCell,
    };
}

describe("header rows", () => {
    it("makes the header as tall as its rows, and counts them in ARIA", () => {
        const { view, engine } = setup();
        expect(view().headerRowCount).toBe(2);
        expect(view().headerHeight).toBe(60);
        expect(view().headerRows.map((row) => row.rowIndex)).toEqual([-2, -1]);
        expect(ariaRowCount(view())).toBe(1_002);
        expect(ariaRowIndex(view(), -2)).toBe(1);
        expect(ariaRowIndex(view(), -1)).toBe(2);
        expect(ariaRowIndex(view(), 0)).toBe(3);
        // the body starts below both header rows: 200px of it, 10 rows
        expect(engine.get("viewport-size").bodyHeight).toBe(200);
        expect(engine.get("row-window").visible).toEqual({ start: 0, end: 10 });
    });

    it("renders the header cells of the column window, a group cut by it included", () => {
        const { headerKeys, scrollLeft, view } = setup();
        // columns 0–2 in view, 3 rendered: P is cut on the right; "id" spans from the top row
        expect(view().renderedColumns).toEqual({ start: 0, end: 4 });
        expect(headerKeys()).toEqual([
            ["id", "P"],
            ["a", "b", "c"],
        ]);
        // columns 9–12 in view: P cut on the left, Q on the right
        scrollLeft(950);
        expect(view().renderedColumns).toEqual({ start: 8, end: 14 });
        expect(headerKeys()).toEqual([
            ["P", "Q"],
            ["h", "i", "j", "k", "l", "m"],
        ]);
    });

    it("places a group from its first column, as wide as its columns", () => {
        const { scrollLeft, view } = setup();
        scrollLeft(950);
        const [p, q] = view().headerRows[0]?.cells ?? [];
        if (!p || !q) throw new Error("no group cells");
        // the layer starts at column 8 (800px): P starts at 100px, 700px before it
        expect(headerCellBox(view(), p)).toEqual({
            top: 0,
            left: -700,
            width: 1_000,
            height: 30,
        });
        expect(headerCellBox(view(), q)).toEqual({
            top: 0,
            left: 300,
            width: 1_000,
            height: 30,
        });
        expect(ariaHeaderCellSpans(p)).toEqual({ "aria-colspan": 10 });
        const id = view().header.cellAt(-1, 0);
        if (!id) throw new Error("no id cell");
        expect(ariaHeaderCellSpans(id)).toEqual({ "aria-rowspan": 2 });
        expect(ariaHeaderCellSpans(view().header.cellAt(-1, 1) ?? id)).toEqual(
            {},
        );
    });
});

describe("header rows and the rendered window", () => {
    it("keeps the same header rows while the column window does not move", () => {
        const { engine, view } = setup();
        const before = view();
        engine.run("scroll-to", { top: 2_000 });
        engine.adapter.commit(view());
        // the rows moved, the columns did not: a new view, the same header rows
        expect(view()).not.toBe(before);
        expect(view().headerRows).toBe(before.headerRows);
    });

    it("cuts a group's box to the rendered columns when the columns' scroll is scaled", () => {
        // 200,000 columns of 100px under one group: 20M px, past the scaling cap
        const wide: ColumnOrGroup<Row>[] = [
            {
                key: "all",
                children: letters("a", 1).concat(
                    Array.from({ length: 199_999 }, (_, i) => column(`c${i}`)),
                ),
            },
        ];
        const { view } = setup(wide);
        const group = view().headerRows[0]?.cells[0];
        if (!group) throw new Error("no group cell");
        const box = headerCellBox(view(), group);
        // the rendered columns: 0 to 3 (the view's 3, one of overscan)
        expect(view().renderedColumns).toEqual({ start: 0, end: 4 });
        expect(box).toEqual({ top: 0, left: 0, width: 400, height: 30 });
    });
});

describe("the keyboard across header rows", () => {
    it("focuses a column spanning header rows by its element, and keeps the row it was reached on", () => {
        const { model, view, engine, key, headerCell } = setup();
        // "id" spans rows -2 and -1: one element, at its top row
        const id = headerCell(-2, 0);
        const a = headerCell(-1, 1);
        a.focus();
        expect(model.get("active-position")).toEqual({
            rowIndex: -1,
            columnIndex: 1,
        });
        key("ArrowLeft");
        engine.adapter.commit(view());
        expect(model.get("active-position")).toEqual({
            rowIndex: -1,
            columnIndex: 0,
        });
        expect(document.activeElement).toBe(id);
        // its focus does not move the active cell to its top row
        expect(model.get("active-position")).toEqual({
            rowIndex: -1,
            columnIndex: 0,
        });
        key("ArrowRight");
        expect(model.get("active-position")).toEqual({
            rowIndex: -1,
            columnIndex: 1,
        });
    });

    it("goes up from a column to its group and down to its first column in view, without scrolling", () => {
        const { model, engine, view, scroll, scrollLeft, key } = setup();
        scrollLeft(500);
        model.run("active-position.set", { rowIndex: -1, columnIndex: 6 });
        engine.adapter.commit(view());
        expect(scroll.left).toBe(500);
        key("ArrowUp");
        expect(model.get("active-position")).toEqual({
            rowIndex: -2,
            columnIndex: 1,
        });
        // P is in view: nothing scrolls to its first column
        expect(scroll.left).toBe(500);
        key("ArrowDown");
        expect(model.get("active-position")).toEqual({
            rowIndex: -1,
            columnIndex: 5,
        });
        expect(scroll.left).toBe(500);
    });

    it("scrolls a group out of view in by its nearest column", () => {
        const { model, engine, view, scroll, scrollLeft } = setup();
        scrollLeft(1_500);
        model.run("active-position.set", { rowIndex: -2, columnIndex: 1 });
        // the scroll applies once the adapter commits the view
        engine.adapter.commit(view());
        // P ends at column 10 (1000–1100px): that column comes into view, not column 1
        expect(scroll.left).toBe(1_000);
    });

    it("renders no extra column for an active group the window reaches", () => {
        const { model, scrollLeft, view } = setup();
        scrollLeft(500);
        model.run("active-position.set", { rowIndex: -2, columnIndex: 1 });
        expect(view().columns).not.toContain(1);
        expect(view().headerRows[0]?.cells.map((cell) => cell.key)).toContain(
            "P",
        );
    });
});
