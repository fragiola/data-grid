// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    COLUMN_RESIZER_ATTRIBUTE,
    type Column,
    type ColumnOrGroup,
    createDataGridEngine,
    createDataGridModel,
    inlineStart,
} from "../../src";
import {
    cellElement,
    keydown,
    mountEngine,
    pointer,
    type Row,
    stubAnimationFrames,
} from "./harness";

// Right to left (Epic #85, E1.1): the grid's start is the right edge. The engine works in inline
// offsets as it does left to right and mirrors only where it meets the DOM: the negative
// `scrollLeft` it reads and sets, the layers' transform, the side of the insets it writes, the
// pointer's x and the arrows. Indexes, windows and ARIA do not change.

const column = (
    key: string,
    extra: Partial<Column<Row>> = {},
): Column<Row> => ({ key, width: 100, ...extra });

/** "p" pinned at the start, "z" at the end, 48 columns of 100px between */
const COLUMNS: Column<Row>[] = [
    column("p", { pinned: "start" }),
    ...Array.from({ length: 48 }, (_, i) =>
        column(`c${i}`, { resizable: true, reorderable: true }),
    ),
    column("z", { pinned: "end" }),
];

let frame: () => void;

beforeEach(() => {
    ({ frame } = stubAnimationFrames());
});

afterEach(() => {
    vi.unstubAllGlobals();
});

function setup(
    options: {
        columns?: ColumnOrGroup<Row>[];
        direction?: "ltr" | "rtl";
        maxScrollSize?: number;
    } = {},
) {
    const grid = document.createElement("div");
    const mounted = mountEngine(
        {
            columns: options.columns ?? COLUMNS,
            rowCount: 1_000,
            direction: options.direction ?? "rtl",
        },
        {
            grid,
            overscan: { rows: 2, columns: 1 },
            maxScrollSize: options.maxScrollSize,
            width: 600,
            height: 230,
            clamp: true,
            layers: ["body"],
        },
    );
    const { engine, viewport, body, commit } = mounted;
    /** a native scroll to the physical `scrollLeft` (negative right to left) */
    const scrollLeft = (left: number) => {
        viewport.scrollLeft = left;
        viewport.dispatchEvent(new Event("scroll"));
        commit();
    };
    const pinnedCell = (columnIndex: number) => {
        const element = document.createElement("div");
        element.setAttribute("data-column-index", String(columnIndex));
        body.append(element);
        engine.adapter.registerLayer("pinned", element);
        return element;
    };
    return { ...mounted, grid, scrollLeft, pinnedCell };
}

/** The physical x a layer's transform moves it by. */
function translateX(layer: HTMLElement): number {
    const match = /translate3d\(([-\d.e]+)px/.exec(layer.style.transform);
    if (!match) throw new Error(`no transform: ${layer.style.transform}`);
    return Number(match[1]);
}

describe("the model", () => {
    it("keeps the direction given: none by default (the page's), an option, a command", () => {
        expect(createDataGridModel<Row>().get("direction")).toBeUndefined();
        const model = createDataGridModel<Row>({ direction: "rtl" });
        expect(model.get("direction")).toBe("rtl");
        const before = model.state;
        expect(model.run("direction.set", { direction: "rtl" }).ok).toBe(true);
        expect(model.state).toBe(before);
        expect(model.run("direction.set", { direction: "ltr" })).toEqual({
            ok: true,
            value: "ltr",
        });
        // null gives it back to the page
        expect(model.run("direction.set", { direction: null })).toEqual({
            ok: true,
            value: undefined,
        });
        expect(model.get("direction")).toBeUndefined();
        // an invalid one is refused
        const refused = model.run("direction.set", {
            // @ts-expect-error: not a direction
            direction: "up",
        });
        expect(!refused.ok && refused.error.code).toBe("invalid_payload");
        expect(inlineStart("ltr")).toBe("left");
        expect(inlineStart("rtl")).toBe("right");
    });
});

describe("the scroll", () => {
    it("reads a negative scrollLeft as the scroll from the start, and mirrors the layers", () => {
        const { engine, view, body, scrollLeft } = setup();
        scrollLeft(-1_000);
        expect(engine.get("scroll-position").left).toBe(1_000);
        // the view between the pinned columns: from 1,000 + 100 to 1,000 + 500
        expect(engine.get("column-window").visible).toEqual({
            start: 11,
            end: 15,
        });
        // the layers move toward the start, the left right to left
        expect(translateX(body)).toBe(-view().columnBase);
        // a move the browser clamps stays at the end
        scrollLeft(-999_999);
        expect(engine.get("scroll-position").left).toBe(5_000 - 600);
        scrollLeft(500);
        expect(engine.get("scroll-position").left).toBe(0);
    });

    it("sets a negative scrollLeft to bring a cell into view", () => {
        const { engine, scroll, commit } = setup();
        engine.run("scroll-to-cell", { columnIndex: 20 });
        commit();
        // its end at the end part's start: 2,100 − (600 − 100)
        expect(engine.get("scroll-position").left).toBe(1_600);
        expect(scroll.left).toBe(-1_600);
        engine.run("scroll-to", { left: 300 });
        commit();
        expect(scroll.left).toBe(-300);
    });

    it("writes the pinned cells' insets on their right, as left to right on their left", () => {
        const ltr = setup({ direction: "ltr" });
        ltr.scrollLeft(1_234);
        const ltrCells = [ltr.pinnedCell(0), ltr.pinnedCell(49)];
        document.body.innerHTML = "";
        const { scrollLeft, pinnedCell } = setup();
        scrollLeft(-1_234);
        const cells = [pinnedCell(0), pinnedCell(49)];
        for (const [i, cell] of cells.entries()) {
            expect(cell.style.left).toBe("");
            expect(cell.style.right).toBe(ltrCells[i]?.style.left);
            expect(cell.style.right).toMatch(/px$/);
        }
    });

    it("moves by the wheel's delta under scaling, a move to the right toward the start", () => {
        const wide = Array.from({ length: 1_000 }, (_, i) => column(`c${i}`));
        const { engine, viewport, scroll, scrollLeft, commit } = setup({
            columns: wide,
            maxScrollSize: 20_000,
        });
        expect(engine.get("scroll-scaled").columns).toBe(true);
        scrollLeft(-10_000);
        const before = engine.get("scroll-position").left;
        viewport.dispatchEvent(
            new WheelEvent("wheel", { deltaX: 30, cancelable: true }),
        );
        commit();
        expect(engine.get("scroll-position").left).toBe(before - 30);
        expect(scroll.left).toBeLessThan(0);
        viewport.dispatchEvent(
            new WheelEvent("wheel", { deltaX: -50, cancelable: true }),
        );
        commit();
        expect(engine.get("scroll-position").left).toBe(before + 20);
        // the scrollbar's end is the dataset's end
        scrollLeft(-999_999);
        expect(engine.get("scroll-position").left).toBe(100_000 - 600);
    });

    it("mirrors a grid whose direction changes, at the same scroll from the start", () => {
        const { model, engine, body, scroll, commit, scrollLeft, pinnedCell } =
            setup({ direction: "ltr" });
        const cell = pinnedCell(0);
        scrollLeft(1_000);
        const inset = cell.style.left;
        const x = translateX(body);
        model.run("direction.set", { direction: "rtl" });
        commit();
        expect(scroll.left).toBe(-1_000);
        expect(engine.get("scroll-position").left).toBe(1_000);
        expect(cell.style.left).toBe("");
        expect(cell.style.right).toBe(inset);
        expect(translateX(body)).toBe(-x);
    });
});

describe("the keys", () => {
    it("move to the next column with ArrowLeft and the previous with ArrowRight; Home and End stay logical", () => {
        const { model, engine, grid } = setup();
        model.run("active-position.set", { rowIndex: 2, columnIndex: 5 });
        const target = cellElement(grid, 2, 5);
        keydown(engine, target, "ArrowLeft");
        expect(model.get("active-position")?.columnIndex).toBe(6);
        keydown(engine, target, "ArrowRight");
        keydown(engine, target, "ArrowRight");
        expect(model.get("active-position")?.columnIndex).toBe(4);
        keydown(engine, target, "End");
        expect(model.get("active-position")?.columnIndex).toBe(49);
        keydown(engine, target, "Home");
        expect(model.get("active-position")?.columnIndex).toBe(0);
    });

    it("move a reorderable header cell after the next sibling with Ctrl+Shift+ArrowLeft", () => {
        const { model, engine, grid } = setup();
        model.run("active-position.set", { rowIndex: -1, columnIndex: 2 });
        const target = cellElement(grid, -1, 2);
        keydown(engine, target, "ArrowLeft", {
            ctrlKey: true,
            shiftKey: true,
        });
        expect(model.state.columns[3]?.key).toBe("c1");
        // the active cell followed its column: its element is at its new index
        keydown(engine, cellElement(grid, -1, 3), "ArrowRight", {
            ctrlKey: true,
            shiftKey: true,
        });
        expect(model.state.columns[2]?.key).toBe("c1");
    });

    it("grow a column with ArrowLeft on its resizer, whose handle is at its left edge", () => {
        const grid = document.createElement("div");
        const cell = cellElement(
            grid,
            -1,
            1,
            `<div role="separator" tabindex="0" ${COLUMN_RESIZER_ATTRIBUTE}="c0"></div>`,
        );
        const resizer = cell.firstElementChild as HTMLElement;
        const { engine, model } = mountEngine(
            { columns: COLUMNS, rowCount: 10, direction: "rtl" },
            { grid, width: 600 },
        );
        keydown(engine, cell, "F2");
        expect(document.activeElement).toBe(resizer);
        keydown(engine, resizer, "ArrowLeft");
        expect(model.get("column-width-by", { columnKey: "c0" })).toBe(110);
        keydown(engine, resizer, "ArrowRight", { shiftKey: true });
        expect(model.get("column-width-by", { columnKey: "c0" })).toBe(60);
    });
});

describe("the drags", () => {
    it("grow a column dragged toward the end: to the left", () => {
        const grid = document.createElement("div");
        const cell = cellElement(
            grid,
            -1,
            1,
            `<div ${COLUMN_RESIZER_ATTRIBUTE}="c0"></div>`,
        );
        const resizer = cell.firstElementChild as HTMLElement;
        resizer.setPointerCapture = vi.fn();
        const { engine, model } = mountEngine(
            { columns: COLUMNS, rowCount: 10, direction: "rtl" },
            { grid, width: 600 },
        );
        pointer(engine, resizer, "pointerdown", 400);
        pointer(engine, resizer, "pointermove", 370);
        frame();
        expect(model.get("column-width-by", { columnKey: "c0" })).toBe(130);
        pointer(engine, resizer, "pointerup", 420);
        expect(model.get("column-width-by", { columnKey: "c0" })).toBe(80);
    });

    it("drop a header cell on the side of the pointer, counted from the right edge", () => {
        const grid = document.createElement("div");
        const header = cellElement(grid, -1, 1);
        header.setPointerCapture = vi.fn();
        const { engine, model } = mountEngine(
            { columns: COLUMNS, rowCount: 10, direction: "rtl" },
            { grid, width: 600 },
        );
        // the view is 600px wide from x 0 (jsdom lays nothing out): an inline x is 600 − clientX.
        // "c0" (100 to 200 from the right) dragged to 380 from the right: past "c2"'s middle
        pointer(engine, header, "pointerdown", 450);
        pointer(engine, header, "pointermove", 440);
        pointer(engine, header, "pointermove", 220);
        frame();
        expect(engine.get("column-reorder")).toEqual({
            columnKey: "c0",
            targetKey: "c2",
            side: "after",
        });
        pointer(engine, header, "pointerup", 220);
        expect(
            model.state.columns.slice(1, 4).map((entry) => entry.key),
        ).toEqual(["c1", "c2", "c0"]);
    });

    it("scroll toward the end near the view's left edge", () => {
        const grid = document.createElement("div");
        const header = cellElement(grid, -1, 1);
        header.setPointerCapture = vi.fn();
        const { engine, scroll, commit } = mountEngine(
            { columns: COLUMNS, rowCount: 10, direction: "rtl" },
            { grid, width: 600, clamp: true },
        );
        pointer(engine, header, "pointerdown", 450);
        pointer(engine, header, "pointermove", 440);
        // 10px from the scrolling columns' end edge, the left one (the end part is 100px)
        pointer(engine, header, "pointermove", 110);
        frame();
        commit();
        expect(engine.get("scroll-position").left).toBeGreaterThan(0);
        expect(scroll.left).toBeLessThan(0);
    });
});

describe("the page's direction", () => {
    /** a grid without a direction of its own, under a page laid out right to left */
    function underRtlPage() {
        const page = document.createElement("div");
        page.style.direction = "rtl";
        document.body.append(page);
        const grid = document.createElement("div");
        const mounted = mountEngine(
            { columns: COLUMNS, rowCount: 1_000 },
            { grid, width: 600, clamp: true, layers: ["body"] },
        );
        page.append(mounted.viewport);
        return mounted;
    }

    it("is the one a grid without a direction of its own takes, read from its viewport", () => {
        const page = document.createElement("div");
        page.style.direction = "rtl";
        document.body.append(page);
        const viewport = document.createElement("div");
        page.append(viewport);
        const grid = document.createElement("div");
        viewport.append(grid);
        const model = createDataGridModel<Row>({
            columns: COLUMNS,
            rowCount: 100,
            getRow: (id) => ({ id }),
        });
        const engine = createDataGridEngine(model);
        const commit = () => engine.adapter.commit(engine.adapter.getView());
        engine.adapter.attach(viewport);
        expect(engine.adapter.getView().direction).toBe("rtl");
        // the engine writes no `dir`: the adapter renders the given one
        expect(viewport.hasAttribute("dir")).toBe(false);
        expect(engine.adapter.getView().givenDirection).toBeUndefined();
        // one given wins, at the commit that renders it (its `dir`)
        model.run("direction.set", { direction: "ltr" });
        expect(engine.adapter.getView().givenDirection).toBe("ltr");
        expect(viewport.hasAttribute("dir")).toBe(false);
        viewport.setAttribute("dir", "ltr");
        commit();
        expect(engine.adapter.getView().direction).toBe("ltr");
        // taken back: the page's again, read at the commit after the adapter removed its `dir`
        model.run("direction.set", { direction: null });
        expect(engine.adapter.getView().givenDirection).toBeUndefined();
        expect(engine.adapter.getView().direction).toBe("ltr");
        viewport.removeAttribute("dir");
        commit();
        expect(engine.adapter.getView().direction).toBe("rtl");
    });

    it("follows the page when it changes, at the next attach", () => {
        const { engine, viewport, resize, commit, detach } = underRtlPage();
        // attached before it was moved under the page: left to right, until it attaches again
        expect(engine.adapter.getView().direction).toBe("ltr");
        resize();
        commit();
        expect(engine.adapter.getView().direction).toBe("ltr");
        detach();
        engine.adapter.attach(viewport);
        commit();
        expect(engine.adapter.getView().direction).toBe("rtl");
        viewport.scrollLeft = -700;
        viewport.dispatchEvent(new Event("scroll"));
        expect(engine.get("scroll-position").left).toBe(700);
    });

    it("is read on attach and when a given direction is taken back, never per command or resize", () => {
        const { model, resize, commit } = mountEngine(
            { columns: COLUMNS, rowCount: 1_000 },
            { width: 600, layers: ["body"] },
        );
        const reads = vi.spyOn(window, "getComputedStyle");
        // commands in view (no scroll to clamp), a resize: nothing read
        model.run("active-position.set", { rowIndex: 3, columnIndex: 4 });
        model.run("column-widths.resize", { columnKey: "c0", width: 150 });
        commit();
        resize();
        commit();
        expect(reads).not.toHaveBeenCalled();
        model.run("direction.set", { direction: "rtl" });
        commit();
        // (the fake viewport reads its own direction to set a scroll)
        reads.mockClear();
        model.run("direction.set", { direction: null });
        expect(reads).not.toHaveBeenCalled();
        commit();
        expect(reads).toHaveBeenCalled();
        reads.mockRestore();
    });

    it("mirrors the transforms and the insets together, at the commit rendering the direction", () => {
        const { model, body, scrollLeft, pinnedCell, commit } = setup({
            direction: "ltr",
        });
        const cell = pinnedCell(0);
        scrollLeft(1_000);
        const x = translateX(body);
        const inset = cell.style.left;
        model.run("direction.set", { direction: "rtl" });
        // nothing is written for it before the commit that renders its `dir`
        expect(translateX(body)).toBe(x);
        expect(cell.style.left).toBe(inset);
        // at that commit, in one task: everything written is for the new side
        commit();
        expect(translateX(body)).toBe(-x);
        expect(cell.style.left).toBe("");
        expect(cell.style.right).toBe(inset);
    });
});
