import { describe, expect, it, vi } from "vitest";
import {
    createDataGridModel,
    DEFAULT_DETAIL_HEIGHT,
    type RowKey,
    veto,
} from "../../src";

// Expanded rows (M1): the model keeps their keys and derives the rows shown expanded, by index.

interface Order {
    id: string;
    total: number;
}

const orders: Order[] = Array.from({ length: 10 }, (_, i) => ({
    id: `o${i}`,
    total: i * 10,
}));

function grid(options: { expandedRowKeys?: readonly RowKey[] } = {}) {
    return createDataGridModel<Order>({
        columns: [{ key: "id", width: 100 }],
        rows: orders,
        rowKey: (row) => row.id,
        ...options,
    });
}

describe("expanded rows", () => {
    it("start collapsed, with a default detail height", () => {
        const model = grid();
        expect(model.get("expanded-row-keys")).toEqual([]);
        expect(model.get("expanded-rows")).toEqual([]);
        expect(model.get("detail-height")).toBe(DEFAULT_DETAIL_HEIGHT);
        expect(model.is("row-expanded", { rowIndex: 0 })).toBe(false);
    });

    it("start from the keys given, once each", () => {
        const model = grid({ expandedRowKeys: ["o4", "o1", "o4", "gone"] });
        expect(model.get("expanded-row-keys")).toEqual(["o4", "o1", "gone"]);
        expect(model.get("expanded-rows")).toEqual([1, 4]);
    });

    it("toggle by index: the row's key is kept", () => {
        const model = grid();
        expect(model.run("expanded-rows.toggle", { rowIndex: 3 })).toEqual({
            ok: true,
            value: ["o3"],
        });
        model.run("expanded-rows.toggle", { rowIndex: 1 });
        expect(model.get("expanded-row-keys")).toEqual(["o3", "o1"]);
        expect(model.get("expanded-rows")).toEqual([1, 3]);
        expect(model.is("row-expanded", { rowIndex: 3 })).toBe(true);
        expect(model.is("row-expanded", { rowIndex: 2 })).toBe(false);
        model.run("expanded-rows.toggle", { rowIndex: 3 });
        expect(model.get("expanded-row-keys")).toEqual(["o1"]);
        expect(model.get("expanded-rows")).toEqual([1]);
    });

    it("toggle by key, whether its row is there or not", () => {
        const model = grid();
        model.run("expanded-rows.toggle", { rowKey: "o7" });
        model.run("expanded-rows.toggle", { rowKey: "elsewhere" });
        expect(model.get("expanded-row-keys")).toEqual(["o7", "elsewhere"]);
        expect(model.get("expanded-rows")).toEqual([7]);
        model.run("expanded-rows.toggle", { rowKey: "o7" });
        expect(model.get("expanded-rows")).toEqual([]);
    });

    it("are set by key, and setting the same keys commits nothing", () => {
        const model = grid();
        const listener = vi.fn();
        model.subscribe(listener);
        expect(
            model.run("expanded-rows.set", { rowKeys: ["o9", "o0"] }),
        ).toEqual({ ok: true, value: ["o9", "o0"] });
        expect(model.get("expanded-rows")).toEqual([0, 9]);
        model.run("expanded-rows.set", { rowKeys: ["o9", "o0"] });
        expect(listener).toHaveBeenCalledTimes(1);
        model.run("expanded-rows.set", { rowKeys: [] });
        expect(model.get("expanded-rows")).toEqual([]);
    });

    it("refuse what is not a row or a key", () => {
        const model = grid();
        expect(
            model.run("expanded-rows.toggle", { rowIndex: 10 }),
        ).toMatchObject({ ok: false, error: { code: "not_found" } });
        expect(
            model.run("expanded-rows.toggle", { rowIndex: 1.5 }),
        ).toMatchObject({ ok: false, error: { code: "not_found" } });
        expect(
            model.run("expanded-rows.toggle", { rowKey: Number.NaN }),
        ).toMatchObject({ ok: false, error: { code: "invalid_payload" } });
        expect(
            // @ts-expect-error: a key is a string or a number
            model.run("expanded-rows.set", { rowKeys: [{}] }),
        ).toMatchObject({ ok: false, error: { code: "invalid_payload" } });
        expect(model.get("expanded-row-keys")).toEqual([]);
    });

    it("follow their record when the app reorders the rows", () => {
        const model = grid();
        model.run("expanded-rows.toggle", { rowIndex: 2 });
        model.run("expanded-rows.toggle", { rowIndex: 8 });
        model.run("data.set", { rows: [...orders].reverse() });
        expect(model.get("expanded-row-keys")).toEqual(["o2", "o8"]);
        expect(model.get("expanded-rows")).toEqual([1, 7]);
        // filtered out, the key stays: back in the rows, its row is expanded again
        model.run("data.set", { rows: orders.filter((o) => o.id !== "o2") });
        expect(model.get("expanded-rows")).toEqual([7]);
        model.run("data.set", { rows: orders });
        expect(model.get("expanded-rows")).toEqual([2, 8]);
    });

    it("are keyed by index without a rowKey", () => {
        const model = createDataGridModel<Order>({
            columns: [{ key: "id", width: 100 }],
            rows: orders,
        });
        model.run("expanded-rows.toggle", { rowIndex: 4 });
        expect(model.get("expanded-row-keys")).toEqual([4]);
        model.run("data.set", { rows: [...orders].reverse() });
        // nothing identifies the record: the index stays expanded
        expect(model.get("expanded-rows")).toEqual([4]);
        model.run("data.set", { rows: orders.slice(0, 3) });
        expect(model.get("expanded-rows")).toEqual([]);
        expect(model.get("expanded-row-keys")).toEqual([4]);
    });

    it("never expand a row not loaded: its key is unknown", () => {
        const cache = new Map<number, Order>([[1, { id: "a", total: 1 }]]);
        const model = createDataGridModel<Order>({
            columns: [{ key: "id", width: 100 }],
            rowCount: 1_000_000,
            getRow: (index) => cache.get(index),
            rowKey: (row) => row.id,
            expandedRowKeys: ["a", "b"],
        });
        expect(model.get("expanded-rows")).toEqual([1]);
        expect(
            model.run("expanded-rows.toggle", { rowIndex: 5 }),
        ).toMatchObject({ ok: false, error: { code: "refused" } });
        // "b" arrives at row 500 000: the app says so, and only that range is looked at
        cache.set(500_000, { id: "b", total: 2 });
        const getRow = vi.fn((index: number) => cache.get(index));
        model.run("data.set", {
            rowCount: 1_000_000,
            getRow,
            rowKey: (row) => row.id,
        });
        expect(model.get("expanded-rows")).toEqual([1, 500_000]);
        getRow.mockClear();
        cache.set(600_000, { id: "c", total: 3 });
        model.run("expanded-rows.toggle", { rowKey: "c" });
        cache.delete(500_000);
        cache.set(700_000, { id: "b", total: 2 });
        getRow.mockClear();
        model.run("rows.changed", { start: 500_000, end: 700_001 });
        expect(model.get("expanded-rows")).toEqual([1, 600_000, 700_000]);
        // where the keys were seen, then the range, up to the last key it was missing
        expect(getRow.mock.calls.length).toBeLessThanOrEqual(200_010);
    });

    it("look for a key where it was last seen before anywhere else", () => {
        const getRow = vi.fn((index: number) => ({
            id: `r${index}`,
            total: 0,
        }));
        const model = createDataGridModel<Order>({
            columns: [{ key: "id", width: 100 }],
            rowCount: 1_000_000,
            getRow,
            rowKey: (row) => row.id,
        });
        // a controlled root asks with the toggle (vetoed), then sets the keys the parent chose
        model.use((ctx, next) => {
            const result = next();
            return ctx.command === "expanded-rows.toggle" ? veto() : result;
        });
        model.run("expanded-rows.toggle", { rowIndex: 900_000 });
        getRow.mockClear();
        model.run("expanded-rows.set", { rowKeys: ["r900000"] });
        expect(model.get("expanded-rows")).toEqual([900_000]);
        expect(getRow.mock.calls.length).toBeLessThan(5);
    });

    it("look in the rows added behind the same getRow, not in every row", () => {
        const getRow = vi.fn((index: number) =>
            index === 5 ? undefined : { id: `r${index}`, total: 0 },
        );
        const rowKey = (row: Order) => row.id;
        const model = createDataGridModel<Order>({
            columns: [{ key: "id", width: 100 }],
            rowCount: 1_000,
            getRow,
            rowKey,
            expandedRowKeys: ["r3", "r1500", "r5"],
        });
        expect(model.get("expanded-rows")).toEqual([3]);
        getRow.mockClear();
        model.run("data.set", { rowCount: 2_000, getRow, rowKey });
        expect(model.get("expanded-rows")).toEqual([3, 1_500]);
        // "r5" is still missing: only the 1 000 new rows were looked at
        expect(getRow.mock.calls.length).toBeLessThan(1_010);
    });

    it("scan nothing while no row is expanded", () => {
        const getRow = vi.fn((index: number) => ({
            id: `r${index}`,
            total: 0,
        }));
        const model = createDataGridModel<Order>({
            columns: [{ key: "id", width: 100 }],
            rowCount: 1_000_000,
            getRow,
            rowKey: (row) => row.id,
        });
        model.run("data.set", {
            rowCount: 2_000_000,
            getRow,
            rowKey: (row) => row.id,
        });
        model.run("rows.changed", {});
        expect(getRow).not.toHaveBeenCalled();
    });

    it("collapse every row showing a key, when the data repeats it", () => {
        const model = createDataGridModel<Order>({
            columns: [{ key: "id", width: 100 }],
            rows: [
                { id: "a", total: 0 },
                { id: "b", total: 0 },
                { id: "a", total: 0 },
            ],
            rowKey: (row) => row.id,
        });
        model.run("expanded-rows.toggle", { rowIndex: 0 });
        model.run("expanded-rows.toggle", { rowIndex: 2 });
        expect(model.get("expanded-row-keys")).toEqual([]);
        expect(model.get("expanded-rows")).toEqual([]);
    });

    it("a middleware can refuse a toggle", () => {
        const model = grid();
        model.use((ctx, next) =>
            ctx.command === "expanded-rows.toggle" && ctx.payload.rowIndex === 0
                ? veto("row 0 has no detail")
                : next(),
        );
        expect(
            model.run("expanded-rows.toggle", { rowIndex: 0 }),
        ).toMatchObject({ ok: false, error: { code: "vetoed" } });
        expect(model.can("expanded-rows.toggle", { rowIndex: 1 })).toBe(true);
        expect(model.get("expanded-row-keys")).toEqual([]);
    });

    it("take a detail height through sizes.set", () => {
        const model = grid();
        const height = (row: Order) => 100 + row.total;
        model.run("sizes.set", { detailHeight: height });
        expect(model.get("detail-height")).toBe(height);
        expect(model.run("sizes.set", { detailHeight: -1 })).toMatchObject({
            ok: false,
            error: { code: "invalid_payload" },
        });
    });
});
