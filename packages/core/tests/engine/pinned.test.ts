// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    type Column,
    type ColumnOrGroup,
    columnLeft,
    columnsError,
    createDataGridEngine,
    createDataGridModel,
    headerCellBox,
    rowLeft,
} from "../../src";

// Pinned columns at the start (Epic #31, P1–P7): the leading `pinned: "start"` columns are always
// rendered, the column window covers the view right of them, the engine keeps their cells at the
// view's start (a `pinned` element's transform, unscaled and scaled), and bringing a cell into
// view leaves it right of them.

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
    /** a pinned cell's element, as an adapter registers it */
    const pinnedCell = () => {
        const element = document.createElement("div");
        body.append(element);
        engine.adapter.registerLayer("pinned", element);
        return element;
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
        commit,
        body,
        pinnedCell,
    };
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
    it("moves a pinned cell back by what its layer scrolled, without a new view", () => {
        const { view, scrollLeft, pinnedCell, body } = setup();
        const cell = pinnedCell();
        // the rendered columns start at column 2 (200px): the layer is moved right by that much
        expect(cell.style.transform).toBe("translate3d(-200px, 0px, 0px)");
        const before = view();
        scrollLeft(50);
        // inside the overscan: the same view, only the engine's writes moved
        expect(view()).toBe(before);
        expect(cell.style.transform).toBe("translate3d(-150px, 0px, 0px)");
        // where the browser shows column 1: its left in the layer, moved by the layer and by its
        // own transform, less the scroll: its offset from the view's start
        const layerX = Number(
            /translate3d\(([-\d.]+)px/.exec(body.style.transform)?.[1],
        );
        const ownX = Number(
            /translate3d\(([-\d.]+)px/.exec(cell.style.transform)?.[1],
        );
        // a pinned cell sits at its own offset after the row's start, which is the pinned
        // columns' width before the layer
        expect(rowLeft(view())).toBe(-200);
        expect(columnLeft(view(), 1)).toBe(300);
        expect(
            rowLeft(view()) + columnLeft(view(), 1) + layerX + ownX - 50,
        ).toBe(100);
        // and a column that scrolls, where it always was
        const scrolling = columnLeft(view(), 3);
        expect(rowLeft(view()) + scrolling + layerX - 50).toBe(300 - 50);
        // a cell registered later starts where the others are
        expect(pinnedCell().style.transform).toBe(
            "translate3d(-150px, 0px, 0px)",
        );
    });

    it("stays at the view's start under scaled column scroll", () => {
        // 1,000 columns of 100px under a cap of 20,000px: scaled
        const wide: Column<Row>[] = Array.from({ length: 1_000 }, (_, i) =>
            column(`c${i}`, i < 2),
        );
        const { view, scrollLeft, pinnedCell, body } = setup({
            columns: wide,
            maxScrollSize: 20_000,
        });
        const cell = pinnedCell();
        for (const left of [0, 7_777, 19_500]) {
            scrollLeft(left);
            const layerX = Number(
                /translate3d\(([-\d.]+)px/.exec(body.style.transform)?.[1],
            );
            const ownX = Number(
                /translate3d\(([-\d.]+)px/.exec(cell.style.transform)?.[1],
            );
            // no number near the browser's limits: the base follows the view
            expect(Math.abs(ownX)).toBeLessThan(10_000);
            for (const columnIndex of [0, 1]) {
                // where the browser shows it: in the layer, moved by both, less the scroll
                expect(
                    rowLeft(view()) +
                        columnLeft(view(), columnIndex) +
                        layerX +
                        ownX -
                        left,
                ).toBeCloseTo(columnIndex * 100, 5);
            }
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
    it("keeps no transform of the engine's", () => {
        const { engine, scrollLeft, body } = setup();
        const element = document.createElement("div");
        body.append(element);
        const release = engine.adapter.registerLayer("pinned", element);
        scrollLeft(50);
        expect(element.style.transform).not.toBe("");
        release();
        expect(element.style.transform).toBe("");
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
