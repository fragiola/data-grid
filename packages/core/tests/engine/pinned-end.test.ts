// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    COLUMN_RESIZER_ATTRIBUTE,
    type Column,
    type ColumnOrGroup,
    cellPart,
    columnLeft,
    columnResizerPart,
    createDataGridModel,
    headerCellPart,
    renderedWidth,
    rowDetailBox,
    rowDisplay,
    rowLeft,
} from "../../src";
import { pinnedEndShift } from "../../src/engine/geometry";
import { columnsError } from "../../src/header/header";
import { siblingOrder } from "../../src/model/order";
import {
    cellElement,
    fakeContentWidth,
    keydown,
    mountEngine,
    pointer,
    type Row,
    stubAnimationFrames,
} from "./harness";

// Pinned columns at the end (Epic #85, E1.1): the trailing `pinned: "end"` columns are always
// rendered, last; the column window covers the view between the two pinned parts; their cells are
// sticky in their row's flow at an inset the engine writes (the view's end, or where the columns
// end in a narrower grid); a cell brought into view lands between the parts; a move stays in its
// part.

const column = (
    key: string,
    pinned?: "start" | "end",
    extra: Partial<Column<Row>> = {},
): Column<Row> => ({
    key,
    width: 100,
    ...(pinned ? { pinned } : {}),
    ...extra,
});

/** 2 columns pinned at the start, 46 that scroll, 2 pinned at the end: 100px each */
const COLUMNS: Column<Row>[] = Array.from({ length: 50 }, (_, i) =>
    column(`c${i}`, i < 2 ? "start" : i >= 48 ? "end" : undefined),
);

function setup(
    options: {
        columns?: ColumnOrGroup<Row>[];
        width?: number;
        maxScrollSize?: number;
    } = {},
) {
    const mounted = mountEngine(
        { columns: options.columns ?? COLUMNS, rowCount: 1_000 },
        {
            overscan: { rows: 2, columns: 1 },
            maxScrollSize: options.maxScrollSize,
            width: options.width ?? 700,
            height: 230,
            clamp: true,
            layers: ["body"],
        },
    );
    const { engine, viewport, body, commit } = mounted;
    const scrollLeft = (left: number) => {
        viewport.scrollLeft = left;
        viewport.dispatchEvent(new Event("scroll"));
        commit();
    };
    /** a pinned cell's element, as an adapter registers it (it carries its column) */
    const pinnedCell = (columnIndex: number) => {
        const element = document.createElement("div");
        element.setAttribute("data-column-index", String(columnIndex));
        body.append(element);
        engine.adapter.registerLayer("pinned", element);
        return element;
    };
    return { ...mounted, scrollLeft, pinnedCell };
}

/** The x a layer's transform moves it by. */
function layerX(layer: HTMLElement): number {
    const match = /translate3d\(([-\d.e]+)px/.exec(layer.style.transform);
    if (!match) throw new Error(`no transform: ${layer.style.transform}`);
    return Number(match[1]);
}

function inset(cell: HTMLElement): number {
    if (!cell.style.left.endsWith("px")) throw new Error("no inset");
    return Number.parseFloat(cell.style.left);
}

/**
 * Where the browser shows a pinned cell, from the view's start, as sticky resolves it: at the
 * scroll plus its inset in layout, unless that is before its place in the row's flow or past the
 * row's end (sticky keeps it inside its row), then moved by its layer's transform.
 */
function shownAt(
    view: ReturnType<ReturnType<typeof setup>["view"]>,
    columnIndex: number,
    scroll: number,
    cellInset: number,
    x: number,
) {
    const start = rowLeft(view) + columnLeft(view, columnIndex);
    const end =
        rowLeft(view) +
        renderedWidth(view) -
        view.columnAxis.sizeOf(columnIndex);
    const layout = Math.min(Math.max(scroll + cellInset, start), end);
    return layout + x - scroll;
}

describe("validation", () => {
    it("takes columns pinned at the end last, a group pinned whole, and both parts", () => {
        expect(columnsError(COLUMNS)).toBeNull();
        expect(
            columnsError([
                column("a"),
                {
                    key: "end",
                    children: [column("b", "end"), column("c", "end")],
                },
            ]),
        ).toBeNull();
        expect(columnsError([column("a", "start"), column("b", "end")])).toBe(
            null,
        );
    });

    it("refuses an unpinned column after one pinned at the end, a start after an end, and a group mixing parts", () => {
        expect(columnsError([column("a", "end"), column("b")])).toMatch(
            /pinned at the end: those come last/,
        );
        expect(
            columnsError([column("a", "end"), column("b", "start")]),
        ).toMatch(/pinned columns come first/);
        expect(
            columnsError([
                { key: "g", children: [column("a"), column("b", "end")] },
            ]),
        ).toMatch(/mixes pinned and unpinned/);
        expect(
            columnsError([
                {
                    key: "g",
                    children: [column("a", "start"), column("b", "end")],
                },
            ]),
        ).toMatch(/mixes columns pinned at the start and at the end/);
        const model = createDataGridModel<Row>({ columns: COLUMNS });
        const result = model.run("columns.set", {
            columns: [column("a", "end"), column("b")],
        });
        expect(!result.ok && result.error.code).toBe("invalid_payload");
    });

    it("orders each part apart: the ones pinned at the end trail whatever the order says", () => {
        const order = siblingOrder(["z", "a", "y"]);
        const list = [
            column("a"),
            column("b"),
            column("y", "end"),
            column("z", "end"),
        ];
        expect(order?.(list).map((entry) => entry.key)).toEqual([
            "a",
            "b",
            "z",
            "y",
        ]);
    });
});

describe("the view", () => {
    it("renders the columns pinned at the end last, wherever the view is, and says how wide they are", () => {
        const { view, scrollLeft } = setup();
        expect(view().pinnedEndColumnCount).toBe(2);
        expect(view().pinnedEndWidth).toBe(200);
        expect(view().columns.slice(-2)).toEqual([48, 49]);
        scrollLeft(2_000);
        expect(view().columns.slice(0, 2)).toEqual([0, 1]);
        expect(view().columns.slice(-2)).toEqual([48, 49]);
        expect(new Set(view().columns).size).toBe(view().columns.length);
    });

    it("covers the view between the pinned parts with the column window", () => {
        const { engine, scrollLeft } = setup();
        // 700px wide, 200px pinned each side: columns 2, 3 and 4 fill the 300px between
        expect(engine.get("column-window").visible).toEqual({
            start: 2,
            end: 5,
        });
        scrollLeft(1_000);
        expect(engine.get("column-window").visible).toEqual({
            start: 12,
            end: 15,
        });
        // at the end, the overscan never reaches into the columns pinned at the end
        scrollLeft(5_000 - 700);
        const window = engine.get("column-window");
        expect(window.visible).toEqual({ start: 45, end: 48 });
        expect(window.rendered.end).toBe(48);
    });

    it("puts the header cells of the columns pinned at the end last in each header row", () => {
        const { view, scrollLeft } = setup({
            columns: [
                ...Array.from({ length: 40 }, (_, i) => column(`c${i}`)),
                {
                    key: "totals",
                    children: [column("x", "end"), column("y", "end")],
                },
            ],
        });
        scrollLeft(1_500);
        const [groups, leaves] = view().headerRows;
        expect(groups?.cells.at(-1)?.key).toBe("totals");
        expect(leaves?.cells.slice(-2).map((cell) => cell.key)).toEqual([
            "x",
            "y",
        ]);
    });

    it("tells a cell and a header cell pinned at the end, the first one its part's edge", () => {
        const { view } = setup();
        expect(
            cellPart(view(), { rowIndex: 0, columnIndex: 48, loaded: true })
                .state,
        ).toMatchObject({ pinned: true, pinnedEdge: true, pinnedSide: "end" });
        expect(
            cellPart(view(), { rowIndex: 0, columnIndex: 49, loaded: true })
                .state,
        ).toMatchObject({
            pinned: true,
            pinnedEdge: false,
            pinnedSide: "end",
        });
        expect(
            cellPart(view(), { rowIndex: 0, columnIndex: 1, loaded: true })
                .state,
        ).toMatchObject({ pinnedEdge: true, pinnedSide: "start" });
        expect(
            cellPart(view(), { rowIndex: 0, columnIndex: 2, loaded: true })
                .state,
        ).toMatchObject({ pinned: false, pinnedSide: undefined });
        const cell = view().header.cellAt(-1, 48);
        if (!cell) throw new Error("no header cell");
        expect(headerCellPart(view(), cell).state).toMatchObject({
            pinnedSide: "end",
            pinnedEdge: true,
        });
    });

    it("scrolls with the rest while both parts together are as wide as the view", () => {
        const { view, engine } = setup({ width: 400 });
        expect(view().pinnedColumnCount).toBe(0);
        expect(view().pinnedEndColumnCount).toBe(0);
        expect(view().columns).not.toContain(49);
        expect(engine.get("column-window").visible.start).toBe(0);
    });
});

describe("placement", () => {
    it("writes their insets at the view's end, and nothing while scrolling inside the window", () => {
        const { view, body, scroll, scrollLeft, pinnedCell } = setup();
        const cells = [pinnedCell(48), pinnedCell(49)];
        const check = () => {
            for (const [i, cell] of cells.entries()) {
                expect(
                    shownAt(
                        view(),
                        48 + i,
                        scroll.left,
                        inset(cell),
                        layerX(body),
                    ),
                    `column ${48 + i} at ${scroll.left}`,
                ).toBe(500 + i * 100);
            }
        };
        check();
        // the columns end at 5,000: the ones pinned at the end show 4,300 before their offsets
        expect(inset(cells[0] as HTMLElement)).toBe(
            4_800 - layerX(body) + 700 - 5_000,
        );
        const before = view();
        for (const left of [10, 50, 60, 0]) {
            scrollLeft(left);
            expect(view()).toBe(before);
            check();
        }
        for (const left of [2_345, 4_300]) {
            scrollLeft(left);
            check();
        }
    });

    it("keeps them inside their row through a scroll not rendered yet, both ways", () => {
        const { view, body, scrollLeft, pinnedCell } = setup();
        const cells = [pinnedCell(48), pinnedCell(49)];
        scrollLeft(2_000);
        const x = layerX(body);
        for (const delta of [-300, -150, 150, 300]) {
            for (const [i, cell] of cells.entries()) {
                expect(
                    shownAt(view(), 48 + i, 2_000 + delta, inset(cell), x),
                    `column ${48 + i}, ${delta}`,
                ).toBe(500 + i * 100);
            }
        }
    });

    it("shows them where the columns end in a grid narrower than the view", () => {
        const columns = Array.from({ length: 5 }, (_, i) =>
            column(`c${i}`, i >= 3 ? "end" : undefined),
        );
        const { view, body, pinnedCell } = setup({ columns, width: 800 });
        expect(pinnedEndShift(view().columnAxis, 800)).toBe(0);
        const cell = pinnedCell(4);
        expect(shownAt(view(), 4, 0, inset(cell), layerX(body))).toBe(400);
    });

    it("lays the rows out to hold both parts, and a detail before them all", () => {
        const { view, model } = setup();
        // 400px pinned, columns 2 to 6 rendered (400px): the row starts 800px before its layer
        expect(view().renderedColumns).toEqual({ start: 2, end: 6 });
        expect(rowLeft(view())).toBe(-800);
        expect(rowDisplay(view())).toBe("flex");
        // in the row's flow, the columns pinned at the end come after the ones at the start
        expect(columnLeft(view(), 48)).toBe(200);
        expect(columnLeft(view(), 49)).toBe(300);
        // to the last rendered column that scrolls, then room for the end part and as far again
        expect(renderedWidth(view())).toBe(800 - 200 + 600 + 200 + 400);
        model.run("expanded-rows.set", { rowKeys: [0] });
        expect(rowDetailBox(view(), 0)?.start).toBe(-400);
    });

    it("rewrites their insets when the view's width changes", () => {
        const { view, body, size, resize, commit, pinnedCell, scroll } =
            setup();
        const cell = pinnedCell(49);
        size.width = 900;
        resize();
        commit();
        expect(
            shownAt(view(), 49, scroll.left, inset(cell), layerX(body)),
        ).toBe(800);
    });

    it("stays at the view's end under scaled column scroll", () => {
        const wide: Column<Row>[] = Array.from({ length: 1_000 }, (_, i) =>
            column(`c${i}`, i >= 998 ? "end" : undefined),
        );
        const { view, scroll, scrollLeft, pinnedCell, body, engine } = setup({
            columns: wide,
            maxScrollSize: 20_000,
        });
        expect(engine.get("scroll-scaled").columns).toBe(true);
        const cells = [pinnedCell(998), pinnedCell(999)];
        for (const left of [0, 9_000, 19_300]) {
            scrollLeft(left);
            for (const [i, cell] of cells.entries()) {
                expect(Math.abs(inset(cell))).toBeLessThanOrEqual(20_000);
                expect(
                    shownAt(
                        view(),
                        998 + i,
                        scroll.left,
                        inset(cell),
                        layerX(body),
                    ),
                ).toBeCloseTo(500 + i * 100, 6);
            }
        }
    });
});

describe("scrolling and keys", () => {
    it("brings a cell into view between the pinned parts", () => {
        const { engine, commit } = setup();
        engine.run("scroll-to-cell", { columnIndex: 20 });
        commit();
        // its end at the end part's start: 2,100 − (700 − 200)
        expect(engine.get("scroll-position").left).toBe(1_600);
        engine.run("scroll-to-cell", { columnIndex: 2 });
        commit();
        expect(engine.get("scroll-position").left).toBe(0);
        // a pinned one is always in view
        engine.run("scroll-to-cell", { columnIndex: 49 });
        commit();
        expect(engine.get("scroll-position").left).toBe(0);
        // the last one that scrolls, at the view's end: the scroll's end
        engine.run("scroll-to-cell", { columnIndex: 47 });
        commit();
        expect(engine.get("scroll-position").left).toBe(4_300);
    });

    it("moves into the columns pinned at the end without scrolling, and back", () => {
        const { engine, model, grid, commit } = setup();
        model.run("active-position.set", { rowIndex: 3, columnIndex: 47 });
        commit();
        expect(engine.get("scroll-position").left).toBe(4_300);
        const target = document.createElement("div");
        target.dataset.rowIndex = "3";
        target.dataset.columnIndex = "47";
        grid.append(target);
        keydown(engine, target, "ArrowRight");
        commit();
        expect(model.get("active-position")).toEqual({
            rowIndex: 3,
            columnIndex: 48,
        });
        expect(engine.get("scroll-position").left).toBe(4_300);
        keydown(engine, target, "Home");
        commit();
        expect(engine.get("scroll-position").left).toBe(4_300);
        expect(model.get("active-position")?.columnIndex).toBe(0);
    });

    it("moves a column only among the ones pinned at the end", () => {
        const reorderable = COLUMNS.map((entry) => ({
            ...entry,
            reorderable: true,
        }));
        const model = createDataGridModel<Row>({ columns: reorderable });
        expect(
            model.run("column-order.move", {
                columnKey: "c49",
                targetKey: "c48",
                side: "before",
            }).ok,
        ).toBe(true);
        expect(model.state.columns.slice(-2).map((entry) => entry.key)).toEqual(
            ["c49", "c48"],
        );
        const refused = model.run("column-order.move", {
            columnKey: "c48",
            targetKey: "c47",
            side: "before",
        });
        expect(!refused.ok && refused.error.message).toMatch(
            /pinned at the end ones only/,
        );
        expect(
            model.run("column-order.move", {
                columnKey: "c47",
                targetKey: "c49",
                side: "after",
            }).ok,
        ).toBe(false);
        // beside the first one past the edge, on its near side, is still its own part
        expect(
            model.run("column-order.move", {
                columnKey: "c2",
                targetKey: "c49",
                side: "before",
            }).ok,
        ).toBe(true);
        expect(model.state.columns.at(-3)?.key).toBe("c2");
    });
});

describe("widths", () => {
    it("flex, fit and resize a column pinned at the end like any other", () => {
        const grid = document.createElement("div");
        // "z" pinned at the end, its content 150px wide: its header cell, its first row's cell
        const header = cellElement(grid, -1, 3);
        const body = cellElement(grid, 0, 3);
        fakeContentWidth(header, 60);
        fakeContentWidth(body, 150);
        const { view, model, engine } = mountEngine(
            {
                columns: [
                    column("a", "start"),
                    column("b", undefined, { flex: 1 }),
                    column("c"),
                    column("z", "end", { resizable: true, flex: 1 }),
                ],
                rowCount: 10,
            },
            { grid, width: 600 },
        );
        // the 400px the others leave, shared: the end part ends at the view's end
        expect(view().columnAxis.sizeOf(3)).toBe(200);
        expect(view().pinnedEndWidth).toBe(200);
        expect(view().columnAxis.totalSize).toBe(600);
        engine.run("fit-columns", { columnKeys: ["z"] });
        expect(model.get("column-widths")).toEqual({ z: 150 });
        expect(view().pinnedEndWidth).toBe(150);
        expect(view().columnAxis.sizeOf(1)).toBe(250);
        model.run("column-widths.resize", { columnKey: "z", width: 200 });
        expect(view().pinnedEndWidth).toBe(200);
        // "b" flexes into what is left
        expect(view().columnAxis.sizeOf(1)).toBe(200);
    });
});

describe("every column pinned", () => {
    for (const [name, columns] of [
        ["at the end", ["end", "end", "end"]],
        ["at both ends", ["start", "start", "end", "end"]],
    ] as const) {
        it(`lays every column out where it is, ${name}`, () => {
            const { view, body, pinnedCell } = setup({
                columns: columns.map((pinned, i) => column(`c${i}`, pinned)),
            });
            expect(view().pinnedColumnCount + view().pinnedEndColumnCount).toBe(
                columns.length,
            );
            const cells = columns.map((_, i) => pinnedCell(i));
            for (const [i, cell] of cells.entries()) {
                expect(
                    shownAt(view(), i, 0, inset(cell), layerX(body)),
                    `column ${i}`,
                ).toBe(i * 100);
            }
        });
    }
});

describe("resizing a column pinned at the end", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    /** "z" pinned at the end, resizable, its header cell holding a resizer */
    function resizing(direction?: "rtl") {
        const { frame } = stubAnimationFrames();
        const grid = document.createElement("div");
        const cell = cellElement(
            grid,
            -1,
            3,
            `<div tabindex="0" ${COLUMN_RESIZER_ATTRIBUTE}="z"></div>`,
        );
        const resizer = cell.firstElementChild as HTMLElement;
        resizer.setPointerCapture = vi.fn();
        const mounted = mountEngine(
            {
                columns: [
                    column("a"),
                    column("b"),
                    column("c"),
                    column("z", "end", { resizable: true }),
                ],
                rowCount: 10,
                ...(direction ? { direction } : {}),
            },
            { grid, width: 300 },
        );
        const widthOf = () =>
            mounted.model.get("column-width-by", { columnKey: "z" });
        return { ...mounted, frame, cell, resizer, widthOf };
    }

    it("moves its start edge: it grows toward the start, the pointer's way", () => {
        const { engine, view, frame, resizer, widthOf } = resizing();
        const header = view().header.cellAt(-1, 3);
        if (!header) throw new Error("no header cell");
        expect(columnResizerPart(view(), header).state.edge).toBe("start");
        const a = view().header.cellAt(-1, 0);
        if (!a) throw new Error("no header cell");
        expect(columnResizerPart(view(), a).state.edge).toBe("end");
        pointer(engine, resizer, "pointerdown", 200);
        pointer(engine, resizer, "pointermove", 170);
        frame();
        expect(widthOf()).toBe(130);
        pointer(engine, resizer, "pointerup", 220);
        expect(widthOf()).toBe(80);
    });

    it("grows with the arrow toward the start, and mirrored right to left", () => {
        for (const direction of [undefined, "rtl"] as const) {
            const { engine, cell, resizer, widthOf } = resizing(direction);
            keydown(engine, cell, "F2");
            expect(document.activeElement).toBe(resizer);
            keydown(engine, resizer, direction ? "ArrowRight" : "ArrowLeft");
            expect(widthOf()).toBe(110);
            keydown(engine, resizer, direction ? "ArrowLeft" : "ArrowRight");
            expect(widthOf()).toBe(100);
            document.body.innerHTML = "";
        }
    });
});
