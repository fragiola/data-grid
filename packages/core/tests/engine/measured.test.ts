// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    type Column,
    createDataGridModel,
    rowCellsHeight,
    rowDetailBox,
    rowExpanded,
    rowTop,
} from "../../src";
import { createAxis } from "../../src/axis/axis";
import { MeasuredHeights } from "../../src/engine/measure";
import {
    isObserved,
    mountEngine,
    type Row,
    resizeElements,
    stubAnimationFrames,
} from "./harness";

// Measured heights (Epic #86, E2.2): rows and details as tall as their content. The engine reads
// a rendered row's or detail's height once at its commit, then takes what its observer (from the
// viewport's window, from the next frame on) tells; the row axis holds them over the estimate,
// by index with the row's key, and the view stays on what it shows.

const columnsOf = (count: number): Column<Row>[] =>
    Array.from({ length: count }, (_, i) => ({ key: `c${i}`, width: 100 }));

/** A row's height in these tests: 20, 30 or 40 by its key. */
const contentHeight = (id: number) => 20 + (id % 3) * 10;

let frames: ReturnType<typeof stubAnimationFrames>;

beforeEach(() => {
    frames = stubAnimationFrames();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

/** Fakes an element's border-box height, and counts the reads. */
function fakeHeight(element: HTMLElement, height: () => number) {
    const reads = { count: 0 };
    element.getBoundingClientRect = () => {
        reads.count += 1;
        return DOMRect.fromRect({ width: 400, height: height() });
    };
    return reads;
}

function setup(
    options: {
        rows?: number;
        /** how many columns, 100px each (default 4) */
        columns?: number;
        ids?: readonly number[];
        maxScrollSize?: number;
        rowHeight?: "auto" | number;
        detailHeight?: "auto" | number;
        expandedRowKeys?: readonly number[];
        /** a row's height: by default `contentHeight` of its key */
        heightOf?: (id: number) => number;
        /** a detail's height (default 100) */
        detailOf?: (id: number) => number;
    } = {},
) {
    let ids = options.ids ?? null;
    const rowAt = (index: number) => ({ id: ids?.[index] ?? index });
    const mounted = mountEngine(
        {
            columns: columnsOf(options.columns ?? 4),
            rowCount: ids?.length ?? options.rows ?? 1_000,
            getRow: rowAt,
            rowKey: (row) => row.id,
            rowHeight: options.rowHeight ?? "auto",
            estimatedRowHeight: 30,
            detailHeight: options.detailHeight ?? 100,
            estimatedDetailHeight: 50,
            expandedRowKeys: options.expandedRowKeys,
        },
        {
            overscan: { rows: 2, columns: 1 },
            maxScrollSize: options.maxScrollSize,
            width: 500,
            height: 230,
            clamp: true,
            layers: ["body"],
        },
    );
    const { model, engine, body, view } = mounted;
    const heightOf = options.heightOf ?? contentHeight;
    const detailOf = options.detailOf ?? (() => 100);
    /** the rendered elements by key, kept across renders (an adapter keyed by `rowKey`) */
    const elements = new Map<
        number,
        {
            row: HTMLElement;
            detail: HTMLElement | null;
            reads: { count: number };
            unregister: () => void;
        }
    >();
    /** The adapter rendering the view: a row element per row (and its detail), registered. */
    const render = () => {
        const current = view();
        const measured = current.measuredRows;
        const shown = new Set<number>();
        const rows = current.rows.map((rowIndex) => {
            const { id } = rowAt(rowIndex);
            shown.add(id);
            let entry = elements.get(id);
            if (!entry) {
                const row = document.createElement("div");
                const reads = fakeHeight(row, () => {
                    const detail = entry?.detail;
                    return (
                        heightOf(id) +
                        (detail?.isConnected
                            ? detail.getBoundingClientRect().height
                            : 0)
                    );
                });
                entry = {
                    row,
                    detail: null,
                    reads,
                    unregister: measured
                        ? engine.adapter.registerLayer("row", row)
                        : () => {},
                };
                elements.set(id, entry);
            }
            entry.row.dataset.rowIndex = String(rowIndex);
            const expanded = rowExpanded(current, rowIndex);
            if (expanded && !entry.detail) {
                const detail = document.createElement("div");
                detail.dataset.gridPart = "row-detail";
                fakeHeight(detail, () => detailOf(id));
                entry.detail = detail;
                const unregisterDetail = engine.adapter.registerLayer(
                    "detail",
                    detail,
                );
                const unregisterRow = entry.unregister;
                entry.unregister = () => {
                    unregisterRow();
                    unregisterDetail();
                };
                entry.row.append(detail);
            }
            if (entry.detail) entry.detail.dataset.rowIndex = String(rowIndex);
            return entry.row;
        });
        for (const [id, entry] of elements) {
            if (shown.has(id)) continue;
            entry.unregister();
            elements.delete(id);
        }
        body.replaceChildren(...rows);
        engine.adapter.commit(current);
    };
    /** renders until the view settles (an adapter renders each new view) */
    const settle = () => {
        for (let pass = 0; pass < 10; pass++) {
            const before = view();
            render();
            if (view() === before) return;
        }
        throw new Error("the view never settled");
    };
    settle();
    const top = () => engine.get("scroll-position").top;
    const setIds = (next: readonly number[]) => {
        ids = next;
        model.run("data.set", { rowCount: next.length, getRow: rowAt });
        settle();
    };
    /** other rows behind the same `getRow`, the app to tell with `rows.changed` */
    const replaceIds = (next: readonly number[]) => {
        ids = next;
    };
    return { ...mounted, render, settle, top, elements, setIds, replaceIds };
}

describe("measured rows", () => {
    it("lays rows out at the estimate, then at the heights read at the commit", () => {
        const { view } = setup();
        const current = view();
        expect(current.measuredRows).toBe(true);
        for (const rowIndex of current.rows) {
            expect(current.rowAxis.sizeOf(rowIndex)).toBe(
                contentHeight(rowIndex),
            );
        }
        expect(rowTop(current, 3)).toBe(20 + 30 + 40);
        // a row never rendered: the estimate
        expect(current.rowAxis.sizeOf(500)).toBe(30);
        expect(current.rowAxis.totalSize).toBe(
            current.rows.reduce(
                (total, rowIndex) => total + contentHeight(rowIndex) - 30,
                1_000 * 30,
            ),
        );
    });

    it("reads an element once, then takes what its observer tells", () => {
        const heights = new Map<number, number>();
        const { view, elements, render, settle } = setup({
            heightOf: (id) => heights.get(id) ?? 20,
        });
        const first = elements.get(1);
        expect(first?.reads.count).toBe(1);
        render();
        expect(first?.reads.count).toBe(1);
        // observed from the next frame on, from the viewport's window
        expect(isObserved(first?.row ?? document.body)).toBe(false);
        frames.frame();
        expect(isObserved(first?.row ?? document.body)).toBe(true);
        heights.set(1, 75);
        resizeElements(new Map([[first?.row ?? document.body, 75]]));
        settle();
        expect(view().rowAxis.sizeOf(1)).toBe(75);
        expect(rowTop(view(), 2)).toBe(20 + 75);
        expect(first?.reads.count).toBe(1);
    });

    it("reads an element again once registered again, and every one once measuring restarts", () => {
        const { model, engine, elements, render, settle } = setup();
        const first = elements.get(1);
        if (!first) throw new Error("row 1 is not rendered");
        expect(first.reads.count).toBe(1);
        // unregistered (a remount): what was read of it is forgotten
        first.unregister();
        first.unregister = engine.adapter.registerLayer("row", first.row);
        render();
        expect(first.reads.count).toBe(2);
        model.run("sizes.set", { rowHeight: 20 });
        model.run("sizes.set", { rowHeight: "auto" });
        settle();
        expect(first.reads.count).toBe(3);
    });

    it("reads nothing at the commit of a view already replaced (widths changed meanwhile)", () => {
        const { model, engine, view } = setup();
        const stale = view();
        model.run("sizes.set", { headerRowHeight: 40 });
        expect(view()).not.toBe(stale);
        const row = document.createElement("div");
        row.dataset.rowIndex = "2";
        const reads = fakeHeight(row, () => 50);
        engine.adapter.registerLayer("row", row);
        engine.adapter.commit(stale);
        expect(reads.count).toBe(0);
        engine.adapter.commit(view());
        expect(reads.count).toBe(1);
    });

    it("keeps the view inside the rows when the rows it shows shrink at the end", () => {
        const { engine, view, settle, top } = setup({
            rows: 60,
            heightOf: () => 12,
        });
        engine.run("scroll-to", { top: 1_000_000 });
        settle();
        const { bodyHeight } = engine.get("viewport-size");
        expect(top()).toBeGreaterThanOrEqual(0);
        expect(top()).toBeLessThanOrEqual(
            Math.max(0, view().rowAxis.totalSize - bodyHeight),
        );
        expect(engine.get("row-window").visible.end).toBe(60);
    });

    it("keeps a row measured 0 (hidden) at the height it had", () => {
        const heights = new Map<number, number>();
        const { view, elements, settle } = setup({
            heightOf: (id) => heights.get(id) ?? 20,
        });
        frames.frame();
        resizeElements(new Map([[elements.get(1)?.row ?? document.body, 0]]));
        settle();
        expect(view().rowAxis.sizeOf(1)).toBe(20);
    });

    it("keeps the first row in view whose height stayed where it was", () => {
        const { engine, view, settle, top } = setup({ heightOf: () => 60 });
        // the rows in view are measured, the rows above them not yet
        engine.run("scroll-to", { top: 30 * 100 + 10 });
        settle();
        const anchor = engine.get("row-window").visible.start;
        const offset = () => view().rowAxis.offsetOf(anchor) - top();
        const before = offset();
        // rows above it, measured at last: 60 tall, not 30
        engine.run("scroll-to", { top: top() - 100 });
        settle();
        const kept = engine.get("row-window").visible.end > anchor;
        expect(kept).toBe(true);
        expect(offset()).toBe(before + 100);
    });

    it("keeps the view anchored under scroll scaling", () => {
        const { engine, view, settle, top } = setup({
            rows: 1_000_000,
            maxScrollSize: 1_000_000,
            heightOf: () => 45,
        });
        expect(engine.get("scroll-scaled").rows).toBe(true);
        engine.run("scroll-to", { top: 30 * 500_000 });
        settle();
        const anchor = engine.get("row-window").visible.start + 1;
        const offset = () => view().rowAxis.offsetOf(anchor) - top();
        const before = offset();
        engine.run("scroll-to", { top: top() - 120 });
        settle();
        expect(offset()).toBe(before + 120);
        expect(engine.get("scroll-scaled").rows).toBe(true);
    });

    it("scrolls a cell it was asked to scroll to into view at its measured height", () => {
        const { engine, view, settle, top } = setup({ heightOf: () => 90 });
        engine.run("scroll-to-cell", { rowIndex: 300 });
        settle();
        const current = view();
        const end =
            current.rowAxis.offsetOf(300) + rowCellsHeight(current, 300);
        expect(current.rowAxis.sizeOf(300)).toBe(90);
        expect(end).toBeLessThanOrEqual(
            top() + engine.get("viewport-size").bodyHeight,
        );
        expect(current.rowAxis.offsetOf(300)).toBeGreaterThanOrEqual(top());
    });

    it("scrolls to a cell's row again, never sideways, and leaves it once a person scrolls", () => {
        const heights = new Map<number, number>();
        const { model, engine, viewport, elements, settle, top } = setup({
            columns: 20,
            heightOf: (id) => heights.get(id) ?? 20,
        });
        const scrollBy = (axis: "scrollTop" | "scrollLeft", to: number) => {
            viewport[axis] = to;
            viewport.dispatchEvent(new Event("scroll"));
            settle();
        };
        const resize = (id: number, height: number) => {
            heights.set(id, height);
            resizeElements(
                new Map([[elements.get(id)?.row ?? viewport, height]]),
            );
            settle();
        };
        model.run("active-position.set", { rowIndex: 3, columnIndex: 2 });
        settle();
        frames.frame();
        // sideways: a row measured again leaves the columns where the person put them
        scrollBy("scrollLeft", 900);
        resize(1, 70);
        expect(engine.get("scroll-position").left).toBe(900);
        // down: the view stays where the person scrolled, far from the active row
        scrollBy("scrollTop", 3_000);
        const at = top();
        frames.frame();
        const shown = engine.get("row-window").visible.start + 2;
        resize(shown, 25);
        expect(top()).toBe(at);
        expect(engine.get("row-window").visible.start).toBeGreaterThan(100);
    });

    it("keeps a height by key: forgets it where another row comes, keeps it where its row stays", () => {
        const ids = Array.from({ length: 50 }, (_, i) => i);
        const { view, setIds } = setup({ ids });
        expect(view().rowAxis.sizeOf(1)).toBe(30);
        // rows 0 and 1 swap; the others stay where they are
        setIds([1, 0, ...ids.slice(2)]);
        const current = view();
        // each one read again where it now is (its element kept: its height known)
        expect(current.rowAxis.sizeOf(0)).toBe(contentHeight(1));
        expect(current.rowAxis.sizeOf(1)).toBe(contentHeight(0));
        expect(current.rowAxis.sizeOf(2)).toBe(contentHeight(2));
    });

    it("forgets the heights of rows that changed off screen, and keeps the others", () => {
        const ids = Array.from({ length: 500 }, (_, i) => i);
        const { model, engine, view, settle, replaceIds } = setup({ ids });
        expect(view().rowAxis.sizeOf(4)).toBe(contentHeight(4));
        engine.run("scroll-to", { top: 30 * 300 });
        settle();
        replaceIds([100, 101, 102, ...ids.slice(3)]);
        model.run("rows.changed", { start: 0, end: 3 });
        expect(view().rowAxis.sizeOf(1)).toBe(30);
        expect(view().rowAxis.sizeOf(4)).toBe(contentHeight(4));
    });

    it("forgets every height once rows are no longer measured", () => {
        const { model, view, settle } = setup();
        model.run("sizes.set", { rowHeight: 25 });
        settle();
        expect(view().measuredRows).toBe(false);
        expect(view().rowAxis.sizeOf(1)).toBe(25);
        expect(view().rowAxis.fixed).toBe(true);
        model.run("sizes.set", { rowHeight: "auto", estimatedRowHeight: 40 });
        expect(view().rowAxis.sizeOf(500)).toBe(40);
    });
});

describe("measured details", () => {
    it("adds a detail at its content's height, the estimate until it is read", () => {
        const { model, view, settle } = setup({
            rowHeight: 20,
            detailHeight: "auto",
            detailOf: (id) => 70 + id,
        });
        expect(view().measuredDetails).toBe(true);
        model.run("expanded-rows.toggle", { rowIndex: 2 });
        // not rendered yet: the estimate
        expect(view().rowAxis.extraSizeOf(2)).toBe(50);
        settle();
        expect(view().rowAxis.extraSizeOf(2)).toBe(72);
        expect(rowDetailBox(view(), 2)?.height).toBe(72);
        expect(rowTop(view(), 3)).toBe(3 * 20 + 72);
    });

    it("takes a measured row's own height as its element's less its detail's", () => {
        const { model, view, settle } = setup({
            detailHeight: "auto",
            detailOf: () => 120,
        });
        model.run("expanded-rows.toggle", { rowIndex: 2 });
        settle();
        const current = view();
        expect(rowCellsHeight(current, 2)).toBe(contentHeight(2));
        expect(current.rowAxis.extraSizeOf(2)).toBe(120);
        model.run("expanded-rows.toggle", { rowIndex: 2 });
        settle();
        expect(view().rowAxis.sizeOf(2)).toBe(contentHeight(2));
    });
});

describe("rows and details of a given height", () => {
    it("are never observed nor read", () => {
        const { model, view, elements, settle } = setup({
            rowHeight: 20,
            expandedRowKeys: [1],
        });
        settle();
        frames.frame();
        expect(view().measuredRows).toBe(false);
        const detail = elements.get(1)?.detail;
        expect(detail).toBeTruthy();
        expect(isObserved(detail ?? document.body)).toBe(false);
        expect(view().rowAxis.extraSizeOf(1)).toBe(100);
        model.run("sizes.set", { detailHeight: "auto" });
        frames.frame();
        // measured from now on
        expect(isObserved(detail ?? document.body)).toBe(true);
    });
});

describe("the heights an engine measured", () => {
    it("merge by index, the last one for an index winning", () => {
        const store = new MeasuredHeights();
        expect(
            store.set([
                { index: 5, height: 50, key: "e" },
                { index: 1, height: 10, key: "a" },
                { index: 5, height: 55, key: "e" },
            ]),
        ).toEqual([1, 5]);
        expect(store.heightAt(5)).toBe(55);
        expect(store.set([{ index: 1, height: 10, key: "a" }])).toEqual([]);
        expect(store.set([{ index: 3, height: 30, key: "c" }])).toEqual([3]);
        expect([1, 3, 5].map((index) => store.heightAt(index))).toEqual([
            10, 30, 55,
        ]);
    });

    it("keep the heights whose row is still at their index", () => {
        const store = new MeasuredHeights();
        store.set([
            { index: 1, height: 10, key: "a" },
            { index: 2, height: 20, key: "b" },
            { index: 3, height: 30, key: "c" },
        ]);
        const keys = ["x", "a", "z", "c"];
        expect(store.keep(0, 3, (index) => keys[index])).toBe(true);
        expect(store.heightAt(2)).toBeUndefined();
        // outside the range: kept
        expect(store.heightAt(3)).toBe(30);
        expect(store.keep(0, 10, (index) => keys[index])).toBe(false);
        expect(store.clear()).toBe(true);
        expect(store.clear()).toBe(false);
    });

    /** A deterministic pseudo-random integer in [0, max), from a seed and a step. */
    const pick = (seed: number, step: number, max: number) => {
        const x = Math.sin((step + 1) * 12.9898 + seed * 78.233) * 43758.5453;
        return Math.floor((x - Math.floor(x)) * max);
    };

    it("lay an axis out as the one built item by item, through batches and drops (property)", () => {
        for (let seed = 0; seed < 12; seed++) {
            const count = 2_000;
            const estimate = 20 + (seed % 3) * 15;
            const store = new MeasuredHeights();
            const truth = new Map<number, number>();
            for (let batch = 0; batch < 40; batch++) {
                // a window's rows, somewhere: many blocks once enough are measured
                const from = pick(seed, batch, count - 30);
                store.set(
                    Array.from({ length: 30 }, (_, i) => {
                        const height = 1 + pick(seed + 7, batch * 30 + i, 120);
                        truth.set(from + i, height);
                        return { index: from + i, height, key: from + i };
                    }),
                );
                if (batch % 9 === 8) {
                    // rows whose index now holds another row
                    const start = pick(seed + 3, batch, count);
                    store.keep(start, start + 200, (index) =>
                        index % 3 === 0 ? -1 : index,
                    );
                    for (const index of [...truth.keys()]) {
                        if (
                            index >= start &&
                            index < start + 200 &&
                            index % 3 === 0
                        ) {
                            truth.delete(index);
                        }
                    }
                }
            }
            const axis = store.axis(count, estimate);
            const expected = createAxis(
                count,
                (index) => truth.get(index) ?? estimate,
            );
            expect(axis.totalSize).toBeCloseTo(expected.totalSize, 6);
            for (let i = 0; i <= count; i += 7) {
                expect(axis.offsetOf(i)).toBeCloseTo(expected.offsetOf(i), 6);
                expect(axis.sizeOf(i)).toBe(expected.sizeOf(i));
            }
            for (
                let offset = -10;
                offset < expected.totalSize + 10;
                offset += 97
            ) {
                expect(axis.indexAt(offset), `seed ${seed} at ${offset}`).toBe(
                    expected.indexAt(offset),
                );
            }
            // an old version's axis keeps its offsets through a later batch
            const total = axis.totalSize;
            store.set([{ index: 5, height: 999, key: 5 }]);
            expect(axis.totalSize).toBe(total);
            expect(store.axis(count, estimate)).not.toBe(axis);
        }
    });

    it("keep their axis through a new count, and have nothing to resize", () => {
        const store = new MeasuredHeights();
        store.set([
            { index: 2, height: 80, key: 2 },
            { index: 8, height: 100, key: 8 },
        ]);
        const axis = store.axis(10, 20);
        expect(axis.totalSize).toBe(8 * 20 + 180);
        expect(axis.withCount(20).totalSize).toBe(18 * 20 + 180);
        expect(axis.withCount(5).totalSize).toBe(4 * 20 + 80);
        expect(axis.withCount(5).sizeOf(8)).toBe(0);
        expect(axis.withCount(10)).toBe(axis);
        // one estimate for every item: a resize changes nothing
        expect(axis.resized(3)).toBe(axis);
        expect(store.axis(10, 20)).toBe(axis);
    });

    it("lay 100M estimated rows out allocating nothing per row", () => {
        const store = new MeasuredHeights();
        store.set([{ index: 50_000_000, height: 300, key: 1 }]);
        const axis = store.axis(100_000_000, 32);
        expect(axis.totalSize).toBe(3_200_000_000 - 32 + 300);
        expect(axis.offsetOf(50_000_001)).toBe(50_000_000 * 32 + 300);
        expect(axis.indexAt(50_000_000 * 32 + 299)).toBe(50_000_000);
        expect(axis.indexAt(50_000_000 * 32 + 300)).toBe(50_000_001);
    });
});

describe("the model's heights", () => {
    it("take 'auto' and estimates above 0", () => {
        const model = createDataGridModel<Row>({
            rowHeight: "auto",
            detailHeight: "auto",
            estimatedRowHeight: -1,
        });
        expect(model.get("row-height")).toBe("auto");
        expect(model.state.estimatedRowHeight).toBe(35);
        expect(model.state.estimatedDetailHeight).toBe(300);
        expect(model.run("sizes.set", { estimatedRowHeight: 0 }).ok).toBe(
            false,
        );
        expect(model.run("sizes.set", { estimatedDetailHeight: 80 }).ok).toBe(
            true,
        );
        expect(model.state.estimatedDetailHeight).toBe(80);
    });
});
