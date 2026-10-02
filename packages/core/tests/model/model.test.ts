import { describe, expect, it, vi } from "vitest";
import {
    type Column,
    type CommandEvent,
    createDataGridModel,
    veto,
} from "../../src";

interface Person {
    id: number;
    name: string;
    age: number;
}

const people: Person[] = Array.from({ length: 20 }, (_, i) => ({
    id: i + 100,
    name: `Person ${i}`,
    age: 20 + i,
}));

const columns: Column<Person>[] = [
    { key: "name", width: 200 },
    { key: "age", width: 80 },
    {
        key: "label",
        width: 120,
        getValue: (row, index) => `${row.name} #${index}`,
    },
];

function model() {
    return createDataGridModel<Person>({
        columns,
        rows: people,
        rowKey: (row) => row.id,
    });
}

describe("the model", () => {
    it("starts from its options, and runs in plain Node", () => {
        const grid = model();
        expect(grid.get("columns")).toBe(columns);
        expect(grid.get("column-count")).toBe(3);
        expect(grid.get("row-count")).toBe(20);
        expect(grid.get("header-row-count")).toBe(1);
        expect(grid.get("row-height")).toBe(35);
        expect(grid.get("active-position")).toBeNull();
        expect(typeof document).toBe("undefined");
    });

    it("reads rows, keys, columns and values", () => {
        const grid = model();
        expect(grid.get("row-by", { index: 3 })).toBe(people[3]);
        expect(grid.get("row-by", { index: 20 })).toBeUndefined();
        expect(grid.get("row-key-by", { rowIndex: 3 })).toBe(103);
        expect(grid.get("column-by", { key: "age" })).toBe(columns[1]);
        expect(grid.get("cell-value-by", { rowIndex: 2, columnIndex: 1 })).toBe(
            22,
        );
        expect(grid.get("cell-value-by", { rowIndex: 2, columnIndex: 2 })).toBe(
            "Person 2 #2",
        );
        expect(grid.is("row-loaded", { rowIndex: 2 })).toBe(true);
    });

    it("reads rows from a getter, where a row not loaded is undefined but still counted", () => {
        const loaded = new Map([[5, people[0]]]);
        const grid = createDataGridModel<Person>({
            columns,
            rowCount: 1_000_000,
            getRow: (index) => loaded.get(index),
            rowKey: (row) => row.id,
        });
        expect(grid.get("row-count")).toBe(1_000_000);
        expect(grid.get("row-by", { index: 5 })).toBe(people[0]);
        expect(grid.is("row-loaded", { rowIndex: 6 })).toBe(false);
        // a row not loaded is keyed by its index
        expect(grid.get("row-key-by", { rowIndex: 6 })).toBe(6);
        expect(grid.get("row-key-by", { rowIndex: 5 })).toBe(100);
        expect(
            grid.get("cell-value-by", { rowIndex: 6, columnIndex: 0 }),
        ).toBeUndefined();
    });

    it("commits a command and tells its listeners, once per change", () => {
        const grid = model();
        const events: CommandEvent<Person>[] = [];
        grid.subscribe((event) => events.push(event));
        const before = grid.state;
        const result = grid.run("active-position.set", {
            rowIndex: 2,
            columnIndex: 1,
        });
        expect(result).toEqual({
            ok: true,
            value: { rowIndex: 2, columnIndex: 1 },
        });
        expect(grid.state).not.toBe(before);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            command: "active-position.set",
            payload: { rowIndex: 2, columnIndex: 1 },
            before,
            after: grid.state,
        });
        expect(grid.is("cell-active", { rowIndex: 2, columnIndex: 1 })).toBe(
            true,
        );
        expect(grid.is("row-active", { rowIndex: 2 })).toBe(true);
        // the same position again changes nothing: no event, same state
        const same = grid.state;
        grid.run("active-position.set", { rowIndex: 2, columnIndex: 1 });
        expect(grid.state).toBe(same);
        expect(events).toHaveLength(1);
    });

    it("dry-runs with can and check, committing nothing", () => {
        const grid = model();
        const listener = vi.fn();
        grid.subscribe(listener);
        expect(
            grid.can("active-position.set", { rowIndex: 3, columnIndex: 0 }),
        ).toBe(true);
        expect(
            grid.check("active-position.set", {
                rowIndex: 300,
                columnIndex: 0,
            }),
        ).toMatchObject({ ok: false, error: { code: "not_found" } });
        expect(grid.get("active-position")).toBeNull();
        expect(listener).not.toHaveBeenCalled();
    });

    it("moves the active cell, and refuses to move with none", () => {
        const grid = model();
        expect(
            grid.run("active-position.move", { direction: "down" }),
        ).toMatchObject({ ok: false, error: { code: "refused" } });
        grid.run("active-position.set", { rowIndex: 0, columnIndex: 0 });
        grid.run("active-position.move", { direction: "up" });
        expect(grid.get("active-position")).toEqual({
            rowIndex: -1,
            columnIndex: 0,
        });
        grid.run("active-position.move", { direction: "grid-end" });
        expect(grid.get("active-position")).toEqual({
            rowIndex: 19,
            columnIndex: 2,
        });
        grid.run("active-position.move", { direction: "page-up", pageSize: 5 });
        expect(grid.get("active-position")).toEqual({
            rowIndex: 14,
            columnIndex: 2,
        });
        expect(
            grid.run("active-position.move", {
                // @ts-expect-error: not a direction
                direction: "sideways",
            }),
        ).toMatchObject({ ok: false, error: { code: "invalid_payload" } });
    });

    it("lets a move reach a row that is not loaded: its place exists before its data", () => {
        const grid = createDataGridModel<Person>({
            columns,
            rowCount: 10,
            getRow: () => undefined,
        });
        grid.run("active-position.set", { rowIndex: 0, columnIndex: 0 });
        grid.run("active-position.move", { direction: "down" });
        expect(grid.get("active-position")).toEqual({
            rowIndex: 1,
            columnIndex: 0,
        });
    });

    it("keeps the active cell when rows are appended, and clamps it when they shrink", () => {
        const grid = model();
        grid.run("active-position.set", { rowIndex: 15, columnIndex: 2 });
        grid.run("data.set", { rows: [...people, ...people] });
        expect(grid.get("row-count")).toBe(40);
        expect(grid.get("active-position")).toEqual({
            rowIndex: 15,
            columnIndex: 2,
        });
        grid.run("data.set", { rows: people.slice(0, 5) });
        expect(grid.get("active-position")).toEqual({
            rowIndex: 4,
            columnIndex: 2,
        });
        grid.run("columns.set", { columns: columns.slice(0, 1) });
        expect(grid.get("active-position")).toEqual({
            rowIndex: 4,
            columnIndex: 0,
        });
        grid.run("columns.set", { columns: [] });
        expect(grid.get("active-position")).toBeNull();
    });

    it("moves an active header cell into the rows when the header goes away", () => {
        const grid = model();
        grid.run("active-position.set", { rowIndex: -1, columnIndex: 1 });
        grid.run("sizes.set", { headerRowHeight: 0 });
        expect(grid.get("header-row-count")).toBe(0);
        expect(grid.get("active-position")).toEqual({
            rowIndex: 0,
            columnIndex: 1,
        });
    });

    it("rejects invalid payloads without changing anything", () => {
        const grid = model();
        const state = grid.state;
        expect(
            grid.run("columns.set", {
                columns: [
                    { key: "a", width: 10 },
                    { key: "a", width: 10 },
                ],
            }),
        ).toMatchObject({ ok: false, error: { code: "invalid_payload" } });
        expect(
            grid.run("columns.set", { columns: [{ key: "a", width: -1 }] }),
        ).toMatchObject({ ok: false, error: { code: "invalid_payload" } });
        expect(
            grid.run("data.set", { rowCount: -1, getRow: () => undefined }),
        ).toMatchObject({ ok: false, error: { code: "invalid_payload" } });
        expect(grid.run("sizes.set", { rowHeight: Number.NaN })).toMatchObject({
            ok: false,
            error: { code: "invalid_payload" },
        });
        expect(
            // @ts-expect-error: not a command
            grid.run("rows.sort", {}),
        ).toMatchObject({ ok: false, error: { code: "unknown_command" } });
        expect(grid.state).toBe(state);
    });

    it("clears the active cell", () => {
        const grid = model();
        grid.run("active-position.set", { rowIndex: 1, columnIndex: 1 });
        grid.run("active-position.clear");
        expect(grid.get("active-position")).toBeNull();
    });
});

describe("robustness", () => {
    it("never throws on a payload of the wrong shape", () => {
        const grid = model();
        expect(
            // @ts-expect-error: a column must be an object
            grid.run("columns.set", { columns: [null] }),
        ).toMatchObject({ ok: false, error: { code: "invalid_payload" } });
        expect(
            grid.run("active-position.move", {
                direction: "down",
                pageSize: Number.NaN,
            }),
        ).toMatchObject({ ok: false, error: { code: "invalid_payload" } });
        expect(
            // @ts-expect-error: the header row's height is a number
            grid.run("sizes.set", { headerRowHeight: () => 40 }),
        ).toMatchObject({ ok: false, error: { code: "invalid_payload" } });
        expect(grid.get("header-row-count")).toBe(1);
    });

    it("keeps an initial active position inside the grid, or drops one that is no cell", () => {
        const at = (rowIndex: number, columnIndex: number) =>
            createDataGridModel<Person>({
                columns,
                rows: people,
                activePosition: { rowIndex, columnIndex },
            }).get("active-position");
        expect(at(5, -1)).toEqual({ rowIndex: 5, columnIndex: 0 });
        expect(at(500, 9)).toEqual({ rowIndex: 19, columnIndex: 2 });
        expect(at(1.5, 0)).toBeNull();
        expect(at(Number.NaN, 0)).toBeNull();
    });

    it("tells listeners the payload as the middleware rewrote it", () => {
        const grid = model();
        grid.run("active-position.set", { rowIndex: 3, columnIndex: 0 });
        grid.use((ctx, next) => {
            if (ctx.command === "active-position.move") {
                ctx.payload = { direction: "right" };
            }
            return next();
        });
        const payloads: unknown[] = [];
        grid.subscribe((event) => payloads.push(event.payload));
        grid.run("active-position.move", { direction: "down" });
        expect(payloads).toEqual([{ direction: "right" }]);
    });

    it("queues a command a listener issues, so every listener sees the events in order", () => {
        const grid = model();
        const seen: string[] = [];
        grid.subscribe((event) => {
            const position = event.after.activePosition;
            seen.push(`a:${position?.rowIndex}`);
            if (position?.rowIndex === 1) {
                grid.run("active-position.set", {
                    rowIndex: 2,
                    columnIndex: 0,
                });
            }
        });
        grid.subscribe((event) => {
            seen.push(`b:${event.after.activePosition?.rowIndex}`);
        });
        grid.run("active-position.set", { rowIndex: 1, columnIndex: 0 });
        expect(seen).toEqual(["a:1", "b:1", "a:2", "b:2"]);
        expect(grid.get("active-position")?.rowIndex).toBe(2);
    });

    it("runs what was queued even when a listener throws", () => {
        const grid = model();
        let thrown = false;
        grid.subscribe((event) => {
            if (event.after.activePosition?.rowIndex === 1 && !thrown) {
                thrown = true;
                grid.run("active-position.set", {
                    rowIndex: 4,
                    columnIndex: 0,
                });
                throw new Error("listener failed");
            }
        });
        expect(() =>
            grid.run("active-position.set", { rowIndex: 1, columnIndex: 0 }),
        ).toThrow("listener failed");
        expect(grid.get("active-position")?.rowIndex).toBe(4);
    });
});

describe("middleware", () => {
    it("runs around every command and can veto one", () => {
        const grid = model();
        grid.use((ctx, next) =>
            ctx.command === "active-position.set" && ctx.payload.rowIndex === 7
                ? veto("row 7 is locked")
                : next(),
        );
        expect(
            grid.run("active-position.set", { rowIndex: 7, columnIndex: 0 }),
        ).toEqual({
            ok: false,
            error: { code: "vetoed", message: "row 7 is locked" },
        });
        expect(grid.get("active-position")).toBeNull();
        expect(
            grid.run("active-position.set", { rowIndex: 6, columnIndex: 0 }).ok,
        ).toBe(true);
        // can sees the veto too
        expect(
            grid.can("active-position.set", { rowIndex: 7, columnIndex: 0 }),
        ).toBe(false);
    });

    it("vetoes when it neither calls next nor answers", () => {
        const grid = model();
        grid.use(() => undefined);
        expect(
            grid.run("active-position.set", { rowIndex: 1, columnIndex: 1 }),
        ).toMatchObject({ ok: false, error: { code: "vetoed" } });
    });

    it("builds a navigation mode: right at a row's end wraps to the next row", () => {
        const grid = model();
        // RDG's CHANGE_ROW mode, from middleware only: at the last column, the move answers
        // without running, and issues the set it stands for (queued: it runs right after)
        grid.use((ctx, next) => {
            if (
                ctx.command === "active-position.move" &&
                ctx.payload.direction === "right"
            ) {
                const active = ctx.state.activePosition;
                if (
                    active &&
                    active.columnIndex === ctx.state.columns.length - 1
                ) {
                    const target = {
                        rowIndex: Math.min(
                            active.rowIndex + 1,
                            ctx.state.rowCount - 1,
                        ),
                        columnIndex: 0,
                    };
                    if (!ctx.dryRun) {
                        expect(
                            grid.run("active-position.set", target),
                        ).toMatchObject({
                            ok: false,
                            error: { code: "queued" },
                        });
                    }
                    return { ok: true, value: target };
                }
            }
            return next();
        });
        grid.run("active-position.set", { rowIndex: 3, columnIndex: 1 });
        grid.run("active-position.move", { direction: "right" });
        expect(grid.get("active-position")).toEqual({
            rowIndex: 3,
            columnIndex: 2,
        });
        expect(
            grid.check("active-position.move", { direction: "right" }),
        ).toEqual({ ok: true, value: { rowIndex: 4, columnIndex: 0 } });
        // the dry run issued nothing
        expect(grid.get("active-position")).toEqual({
            rowIndex: 3,
            columnIndex: 2,
        });
        grid.run("active-position.move", { direction: "right" });
        expect(grid.get("active-position")).toEqual({
            rowIndex: 4,
            columnIndex: 0,
        });
    });

    it("can rewrite the payload before the command runs", () => {
        const grid = model();
        grid.use((ctx, next) => {
            if (ctx.command === "active-position.set") {
                ctx.payload = { ...ctx.payload, columnIndex: 0 };
            }
            return next();
        });
        grid.run("active-position.set", { rowIndex: 2, columnIndex: 2 });
        expect(grid.get("active-position")).toEqual({
            rowIndex: 2,
            columnIndex: 0,
        });
    });

    it("reports a middleware that throws, and can be removed", () => {
        const grid = model();
        const remove = grid.use(() => {
            throw new Error("boom");
        });
        expect(
            grid.run("active-position.set", { rowIndex: 1, columnIndex: 1 }),
        ).toEqual({
            ok: false,
            error: { code: "middleware_error", message: "boom" },
        });
        remove();
        expect(
            grid.run("active-position.set", { rowIndex: 1, columnIndex: 1 }).ok,
        ).toBe(true);
    });

    it("tells the middleware whether it is a dry run", () => {
        const grid = model();
        const seen: boolean[] = [];
        grid.use((ctx, next) => {
            seen.push(ctx.dryRun);
            return next();
        });
        grid.can("active-position.set", { rowIndex: 1, columnIndex: 1 });
        grid.run("active-position.set", { rowIndex: 1, columnIndex: 1 });
        expect(seen).toEqual([true, false]);
    });
});
