// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    type Column,
    type ColumnOrGroup,
    columnLeft,
    createDataGridEngine,
    createDataGridModel,
    headerCellBox,
    renderedWidth,
    rowDisplay,
    rowLeft,
} from "../../src";
import { pinnedInset } from "../../src/engine/geometry";
import { columnsError } from "../../src/header/header";

// Pinned columns at the start (Epic #31, P1–P7; Epic #38): the leading `pinned: "start"` columns
// are always rendered, the column window covers the view right of them, their cells are sticky in
// their row's flow at the inset the engine writes (written only when the layers' offset moves,
// unscaled and scaled), and bringing a cell into view leaves it right of them.

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
});

const column = (key: string, pinned = false): Column<Row> => ({
    key,
    width: 100,
    ...(pinned ? { pinned: "start" as const } : {}),
});

/** 2 pinned columns, then 48 that scroll: 100px each */
const COLUMNS: Column<Row>[] = Array.from({ length: 50 }, (_, i) =>
    column(`c${i}`, i < 2),
);

function setup(
    options: {
        columns?: ColumnOrGroup<Row>[];
        width?: number;
        maxScrollSize?: number;
    } = {},
) {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const model = createDataGridModel<Row>({
        columns: options.columns ?? COLUMNS,
        rowCount: 1_000,
        getRow: (id) => ({ id }),
        rowHeight: 20,
        headerRowHeight: 30,
    });
    const engine = createDataGridEngine(model, {
        overscan: { rows: 2, columns: 1 },
        maxScrollSize: options.maxScrollSize,
    });
    const view = () => engine.adapter.getView();
    const size = { width: options.width ?? 500, height: 230 };
    const scroll = { top: 0, left: 0 };
    const viewport = document.createElement("div");
    Object.defineProperties(viewport, {
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
    const grid = document.createElement("div");
    const body = document.createElement("div");
    viewport.append(grid);
    grid.append(body);
    document.body.append(viewport);
    engine.adapter.attach(viewport);
    engine.adapter.registerLayer("grid", grid);
    engine.adapter.registerLayer("body", body);
    engine.adapter.commit(view());
    const commit = () => engine.adapter.commit(view());
    const scrollLeft = (left: number) => {
        viewport.scrollLeft = left;
        viewport.dispatchEvent(new Event("scroll"));
        commit();
    };
    /** a pinned cell's element, as an adapter registers it (it carries its column) */
    const pinnedCell = (columnIndex = 0) => {
        const element = document.createElement("div");
        element.setAttribute("data-column-index", String(columnIndex));
        body.append(element);
        engine.adapter.registerLayer("pinned", element);
        return element;
    };
    const wheel = (deltaX: number) => {
        viewport.dispatchEvent(
            new WheelEvent("wheel", { deltaX, cancelable: true }),
        );
        commit();
    };
    return {
        model,
        engine,
        view,
        size,
        resize: () => {
            resize?.();
            commit();
        },
        scroll,
        scrollLeft,
        wheel,
        commit,
        body,
        pinnedCell,
    };
}

/** The x a layer's transform moves it by. */
function layerX(layer: HTMLElement): number {
    const match = /translate3d\(([-\d.e]+)px/.exec(layer.style.transform);
    if (!match) throw new Error(`no transform: ${layer.style.transform}`);
    return Number(match[1]);
}

/** A pinned cell's sticky inset, as the engine wrote it. */
function inset(cell: HTMLElement): number {
    if (!cell.style.left.endsWith("px")) throw new Error("no inset");
    return Number.parseFloat(cell.style.left);
}

/** Records the writes to elements' inline style until `takeRecords`. */
function styleWrites(...elements: HTMLElement[]) {
    const observer = new MutationObserver(() => {});
    for (const element of elements) {
        observer.observe(element, { attributeFilter: ["style"] });
    }
    return observer;
}

describe("validation", () => {
    it("takes pinned columns first, and a group pinned whole", () => {
        expect(columnsError(COLUMNS)).toBeNull();
        expect(
            columnsError([
                {
                    key: "who",
                    children: [column("a", true), column("b", true)],
                },
                column("c"),
            ]),
        ).toBeNull();
    });

    it("refuses a pinned column after one that is not, a group mixing both, and an unknown pin", () => {
        expect(columnsError([column("a"), column("b", true)])).toMatch(
            /pinned columns come first/,
        );
        expect(
            columnsError([
                { key: "who", children: [column("a", true), column("b")] },
            ]),
        ).toMatch(/mixes pinned and unpinned/);
        expect(columnsError([{ key: "a", width: 10, pinned: "end" }])).toMatch(
            /invalid pin/,
        );
        const model = createDataGridModel<Row>({ columns: COLUMNS });
        const result = model.run("columns.set", {
            columns: [column("a"), column("b", true)],
        });
        expect(!result.ok && result.error.code).toBe("invalid_payload");
    });
});

describe("the view", () => {
    it("renders the pinned columns first, wherever the view is, and says how wide they are", () => {
        const { view, scrollLeft } = setup();
        expect(view().pinnedColumnCount).toBe(2);
        expect(view().pinnedWidth).toBe(200);
        scrollLeft(2_000);
        expect(view().columns.slice(0, 2)).toEqual([0, 1]);
        expect(view().columns[2]).toBeGreaterThan(2);
        expect(new Set(view().columns).size).toBe(view().columns.length);
    });

    it("covers the view right of the pinned columns with the column window", () => {
        const { engine, scrollLeft } = setup();
        // 500px wide, 200px pinned: columns 2, 3 and 4 fill the rest
        expect(engine.get("column-window").visible).toEqual({
            start: 2,
            end: 5,
        });
        // the overscan never reaches into the pinned columns
        expect(engine.get("column-window").rendered.start).toBe(2);
        scrollLeft(1_000);
        // from 1,000 + 200 to 1,000 + 500
        expect(engine.get("column-window").visible).toEqual({
            start: 12,
            end: 15,
        });
    });

    it("lays the pinned columns out in a grid without groups, and with a pinned group", () => {
        const { view, scrollLeft } = setup({
            columns: [
                {
                    key: "who",
                    children: [column("a", true), column("b", true)],
                },
                ...Array.from({ length: 40 }, (_, i) => column(`c${i}`)),
            ],
        });
        scrollLeft(2_500);
        const [groups, leaves] = view().headerRows;
        expect(groups?.cells[0]?.key).toBe("who");
        expect(leaves?.cells.slice(0, 2).map((cell) => cell.key)).toEqual([
            "a",
            "b",
        ]);
    });
});

describe("placement", () => {
    /**
     * Where the browser shows a pinned cell, from the view's start, as sticky resolves it: at the
     * scroll plus its inset in layout, unless that is before its place in the row's flow or past
     * the row's end (sticky keeps it inside its row), then moved by its layer's transform.
     */
    function shownAt(
        view: ReturnType<ReturnType<typeof setup>["view"]>,
        columnIndex: number,
        scroll: number,
        cellInset: number,
        x: number,
    ) {
        const offset = view.columnAxis.offsetOf(columnIndex);
        const start = rowLeft(view) + offset;
        const end =
            rowLeft(view) +
            renderedWidth(view) -
            view.columnAxis.sizeOf(columnIndex);
        const layout = Math.min(Math.max(scroll + cellInset, start), end);
        return layout + x - scroll;
    }

    it("writes a pinned cell's sticky inset: its offset less the layers' x", () => {
        const { view, body, pinnedCell } = setup();
        const a = pinnedCell(0);
        const b = pinnedCell(1);
        // the rendered columns start at column 2 (200px): the layers are moved right by that much
        expect(layerX(body)).toBe(200);
        expect(a.style.left).toBe("-200px");
        expect(b.style.left).toBe("-100px");
        expect(pinnedInset(view().columnAxis, 1, 200)).toBe(-100);
        // no transform of the engine's on a pinned cell any more
        expect(a.style.transform).toBe("");
    });

    it("writes nothing for pinned cells while scrolling inside the rendered window", () => {
        const { view, body, scrollLeft, pinnedCell } = setup();
        const cells = [pinnedCell(0), pinnedCell(1)];
        const before = view();
        const writes = styleWrites(body, ...cells);
        for (const left of [10, 50, 99.5, 60, 0]) {
            scrollLeft(left);
            // inside the overscan: the same view, and not a write to a pinned cell or a layer
            expect(view()).toBe(before);
            expect(writes.takeRecords()).toEqual([]);
            for (const [columnIndex, cell] of cells.entries()) {
                expect(
                    shownAt(
                        view(),
                        columnIndex,
                        left,
                        inset(cell),
                        layerX(body),
                    ),
                ).toBe(columnIndex * 100);
            }
        }
        writes.disconnect();
    });

    it("rewrites them with a new column window, where they still show", () => {
        const { view, body, scrollLeft, pinnedCell } = setup();
        const cells = [pinnedCell(0), pinnedCell(1)];
        const before = view();
        scrollLeft(2_345);
        expect(view()).not.toBe(before);
        expect(layerX(body)).toBe(view().columnBase);
        for (const [columnIndex, cell] of cells.entries()) {
            expect(inset(cell)).toBe(columnIndex * 100 - view().columnBase);
            expect(
                shownAt(view(), columnIndex, 2_345, inset(cell), layerX(body)),
            ).toBe(columnIndex * 100);
        }
        // a cell registered later starts where the others are
        expect(pinnedCell(1).style.left).toBe(cells[1]?.style.left);
    });

    it("keeps them inside their row through a scroll the engine has not rendered yet, both ways", () => {
        const { engine, view, size, body, scrollLeft, pinnedCell } = setup();
        const cells = [pinnedCell(0), pinnedCell(1)];
        scrollLeft(2_000);
        // scrolled back to the rendered window's start: the next step left renders a new window,
        // the least room there is on the left
        scrollLeft(1_950);
        const { visible, rendered } = engine.get("column-window");
        expect(visible.start).toBe(rendered.start);
        // the browser scrolls, the scroll event (and the engine) comes a frame later: the insets
        // and the layers stay as written, sticky follows the scroll. The area that scrolls is
        // 300px wide: a larger step shows no cell of the window anyway
        const x = layerX(body);
        const room = size.width - 200;
        for (const delta of [-room, -150, 150, room]) {
            for (const [columnIndex, cell] of cells.entries()) {
                expect(
                    shownAt(view(), columnIndex, 1_950 + delta, inset(cell), x),
                    `column ${columnIndex}, ${delta}`,
                ).toBe(columnIndex * 100);
            }
        }
    });

    it("lays the rows out to hold them: their width and the rendered columns' before the layer, as a flex container", () => {
        const { view } = setup();
        // 200px pinned, columns 2 to 6 rendered (400px): the row starts 600px before its layer
        expect(view().renderedColumns).toEqual({ start: 2, end: 6 });
        expect(rowLeft(view())).toBe(-600);
        expect(rowDisplay(view())).toBe("flex");
        // a pinned column at its place in the row's flow, one that scrolls from the base
        expect(columnLeft(view(), 1)).toBe(100);
        expect(columnLeft(view(), 3)).toBe(300 - 200 + 600);
        // from the row's start to the last rendered column's end
        expect(renderedWidth(view())).toBe(600 - 200 + 600);
    });

    it("stays at the view's start under scaled column scroll, written with the engine's own moves", () => {
        // 1,000 columns of 100px under a cap of 20,000px: scaled
        const wide: Column<Row>[] = Array.from({ length: 1_000 }, (_, i) =>
            column(`c${i}`, i < 2),
        );
        const { view, scroll, scrollLeft, wheel, pinnedCell, body } = setup({
            columns: wide,
            maxScrollSize: 20_000,
        });
        const cells = [pinnedCell(0), pinnedCell(1)];
        const check = () => {
            for (const [columnIndex, cell] of cells.entries()) {
                // no number near the browser's limits: within the physical scroll
                expect(Math.abs(inset(cell))).toBeLessThanOrEqual(20_000);
                expect(
                    shownAt(
                        view(),
                        columnIndex,
                        scroll.left,
                        inset(cell),
                        layerX(body),
                    ),
                ).toBeCloseTo(columnIndex * 100, 5);
            }
        };
        for (const left of [0, 7_777, 19_500]) {
            scrollLeft(left);
            check();
        }
        scrollLeft(7_777);
        // the wheel: the engine moves the virtual offset exactly and sets the scroll itself; the
        // layers' x moves with it, and the insets are written in the same task, before any frame
        for (const delta of [40, 40, -25, 3]) {
            wheel(delta);
            check();
        }
    });
});

describe("bringing a cell into view", () => {
    it("leaves it right of the pinned columns, from either side", () => {
        const { engine, scroll, commit } = setup();
        engine.run("scroll-to-cell", { columnIndex: 30 });
        commit();
        // column 30 ends at 3,100: the view's right edge
        expect(scroll.left).toBe(2_600);
        engine.run("scroll-to-cell", { columnIndex: 20 });
        commit();
        // column 20 starts at 2,000: right after the 200 pinned pixels
        expect(scroll.left).toBe(1_800);
        engine.run("scroll-to-cell", { columnIndex: 2 });
        commit();
        expect(scroll.left).toBe(0);
    });

    it("moves nothing for a column already in view, under scaled scroll too", () => {
        const wide: Column<Row>[] = Array.from({ length: 1_000 }, (_, i) =>
            column(`c${i}`, i < 2),
        );
        const { engine, scroll, scrollLeft, commit } = setup({
            columns: wide,
            maxScrollSize: 20_000,
        });
        scrollLeft(7_777);
        const visible = engine.get("column-window").visible;
        const before = scroll.left;
        engine.run("scroll-to-cell", { columnIndex: visible.start + 1 });
        commit();
        expect(scroll.left).toBe(before);
    });

    it("never scrolls sideways for a pinned column", () => {
        const { engine, scroll, scrollLeft, commit } = setup();
        scrollLeft(1_500);
        engine.run("scroll-to-cell", { columnIndex: 1 });
        commit();
        expect(scroll.left).toBe(1_500);
    });

    it("moves across the pinned edge with the keyboard, the target never under the pinned columns", () => {
        const { model, scroll, scrollLeft, commit } = setup();
        scrollLeft(1_500);
        model.run("active-position.set", { rowIndex: 3, columnIndex: 1 });
        commit();
        expect(scroll.left).toBe(1_500);
        model.run("active-position.move", { direction: "right" });
        commit();
        // column 2 starts at 200: the view's start, right of the pinned columns
        expect(scroll.left).toBe(0);
        model.run("active-position.move", { direction: "row-end" });
        commit();
        expect(scroll.left).toBe(5_000 - 500);
        model.run("active-position.move", { direction: "row-start" });
        commit();
        // column 0 is pinned: in view wherever the scroll is
        expect(scroll.left).toBe(4_500);
    });
});

describe("a view too narrow for the pinned columns", () => {
    it("lets them scroll with the rest until it is wider again", () => {
        // 200px of pinned columns in a 150px view: nothing would be left to scroll
        const { engine, view, size, resize } = setup({ width: 150 });
        expect(view().pinnedColumnCount).toBe(0);
        expect(view().pinnedWidth).toBe(0);
        expect(engine.get("column-window").visible.start).toBe(0);
        size.width = 500;
        resize();
        expect(view().pinnedColumnCount).toBe(2);
        expect(engine.get("column-window").visible).toEqual({
            start: 2,
            end: 5,
        });
    });
});

describe("a pinned cell let go", () => {
    it("keeps no inset of the engine's, and is not written any more", () => {
        const { engine, scrollLeft, body } = setup();
        const element = document.createElement("div");
        element.setAttribute("data-column-index", "0");
        body.append(element);
        const release = engine.adapter.registerLayer("pinned", element);
        expect(element.style.left).toBe("-200px");
        release();
        expect(element.style.left).toBe("");
        // a new column window: its adapter places it now
        scrollLeft(2_500);
        expect(element.style.left).toBe("");
    });
});

describe("scaled header cells", () => {
    it("keeps a pinned group whole", () => {
        const { view, scrollLeft } = setup({
            columns: [
                {
                    key: "who",
                    children: [column("a", true), column("b", true)],
                },
                ...Array.from({ length: 1_000 }, (_, i) => column(`c${i}`)),
            ],
            maxScrollSize: 20_000,
        });
        scrollLeft(10_000);
        const group = view().headerRows[0]?.cells[0];
        if (!group) throw new Error("no group");
        expect(group.key).toBe("who");
        expect(headerCellBox(view(), group).width).toBe(200);
    });
});
