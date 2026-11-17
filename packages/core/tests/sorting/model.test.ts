import { describe, expect, it, vi } from "vitest";
import { type Column, createDataGridModel, veto } from "../../src";
import { sorting } from "../../src/sorting";

// Sorting's model (Epic #27, S1–S3), a feature since Epic #141: installed, the model keeps the
// sort and runs its commands, as before.

interface Person {
    id: number;
    name: string;
    age: number;
}

type Sorting = ReturnType<typeof sorting>;

const people: Person[] = Array.from({ length: 20 }, (_, i) => ({
    id: i + 100,
    name: `Person ${i}`,
    age: 20 + i,
}));

describe("sorting", () => {
    const sortable: Column<Person>[] = [
        { key: "name", width: 200, sortable: true },
        { key: "age", width: 80, sortable: true },
        { key: "label", width: 120 },
    ];

    function sorted() {
        return createDataGridModel({
            columns: sortable,
            rows: people,
            features: [sorting()],
        });
    }

    it("starts unsorted, or from the sort it is given, without what is not a sortable column", () => {
        expect(sorted().state.sortColumns).toEqual([]);
        const grid = createDataGridModel({
            columns: sortable,
            rows: people,
            features: [sorting()],
            sortColumns: [
                { columnKey: "age", direction: "descending" },
                { columnKey: "label", direction: "ascending" },
                { columnKey: "gone", direction: "ascending" },
                { columnKey: "age", direction: "ascending" },
            ],
        });
        expect(grid.get("sort-columns")).toEqual([
            { columnKey: "age", direction: "descending" },
        ]);
    });

    it("toggles a column alone: ascending, descending, not sorted", () => {
        const grid = sorted();
        const toggle = () =>
            grid.run("sort-columns.toggle", { columnKey: "name" });
        expect(toggle()).toEqual({
            ok: true,
            value: [{ columnKey: "name", direction: "ascending" }],
        });
        expect(toggle()).toEqual({
            ok: true,
            value: [{ columnKey: "name", direction: "descending" }],
        });
        expect(toggle()).toEqual({ ok: true, value: [] });
        expect(grid.state.sortColumns).toEqual([]);
    });

    it("makes a column toggled alone the only sorted one", () => {
        const grid = sorted();
        grid.run("sort-columns.set", {
            sortColumns: [
                { columnKey: "name", direction: "ascending" },
                { columnKey: "age", direction: "ascending" },
            ],
        });
        grid.run("sort-columns.toggle", { columnKey: "age" });
        expect(grid.state.sortColumns).toEqual([
            { columnKey: "age", direction: "descending" },
        ]);
    });

    it("with multi, adds a column last and cycles it in place, keeping the others", () => {
        const grid = sorted();
        const toggle = (columnKey: string) =>
            grid.run("sort-columns.toggle", { columnKey, multi: true });
        toggle("age");
        toggle("name");
        expect(grid.state.sortColumns).toEqual([
            { columnKey: "age", direction: "ascending" },
            { columnKey: "name", direction: "ascending" },
        ]);
        toggle("age");
        expect(grid.state.sortColumns).toEqual([
            { columnKey: "age", direction: "descending" },
            { columnKey: "name", direction: "ascending" },
        ]);
        toggle("age");
        expect(grid.state.sortColumns).toEqual([
            { columnKey: "name", direction: "ascending" },
        ]);
        expect(grid.get("sort-column-by", { columnKey: "name" })).toEqual({
            columnKey: "name",
            direction: "ascending",
        });
        expect(
            grid.get("sort-column-by", { columnKey: "age" }),
        ).toBeUndefined();
    });

    it("refuses a column that is not sortable, a group and an unknown key", () => {
        const grouped = createDataGridModel<Person, unknown, [Sorting]>({
            columns: [
                {
                    key: "who",
                    children: [{ key: "name", width: 200, sortable: true }],
                },
                { key: "age", width: 80 },
            ],
            rows: people,
            features: [sorting()],
        });
        const age = grouped.run("sort-columns.toggle", { columnKey: "age" });
        expect(!age.ok && age.error.code).toBe("refused");
        const group = grouped.run("sort-columns.toggle", { columnKey: "who" });
        expect(!group.ok && group.error.code).toBe("not_found");
        const unknown = grouped.run("sort-columns.set", {
            sortColumns: [{ columnKey: "nope", direction: "ascending" }],
        });
        expect(!unknown.ok && unknown.error.code).toBe("not_found");
        expect(grouped.is("column-sortable", { columnKey: "name" })).toBe(true);
        expect(grouped.is("column-sortable", { columnKey: "age" })).toBe(false);
        expect(grouped.is("column-sortable", { columnKey: "who" })).toBe(false);
        expect(grouped.state.sortColumns).toEqual([]);
    });

    it("refuses a set with a bad direction or a column twice", () => {
        const grid = sorted();
        for (const sortColumns of [
            [{ columnKey: "name", direction: "up" }],
            [
                { columnKey: "name", direction: "ascending" },
                { columnKey: "name", direction: "descending" },
            ],
        ]) {
            const result = grid.run("sort-columns.set", {
                sortColumns: sortColumns as never,
            });
            expect(!result.ok && result.error.code).toBe("invalid_payload");
        }
        expect(grid.state.sortColumns).toEqual([]);
    });

    it("commits nothing when the sort stays the same", () => {
        const grid = sorted();
        const listener = vi.fn();
        grid.subscribe(listener);
        grid.run("sort-columns.set", { sortColumns: [] });
        expect(listener).not.toHaveBeenCalled();
    });

    it("drops a sorted column the columns no longer have, or no longer sort by", () => {
        const grid = sorted();
        grid.run("sort-columns.set", {
            sortColumns: [
                { columnKey: "name", direction: "ascending" },
                { columnKey: "age", direction: "descending" },
            ],
        });
        grid.run("columns.set", {
            columns: [
                { key: "name", width: 200 },
                { key: "age", width: 80, sortable: true },
            ],
        });
        expect(grid.state.sortColumns).toEqual([
            { columnKey: "age", direction: "descending" },
        ]);
        grid.run("columns.set", { columns: [{ key: "label", width: 100 }] });
        expect(grid.state.sortColumns).toEqual([]);
    });

    it("goes through the middleware, which can refuse or rewrite a toggle", () => {
        const grid = sorted();
        const remove = grid.use((ctx, next) =>
            ctx.command === "sort-columns.toggle" &&
            ctx.payload.columnKey === "age"
                ? veto("age stays unsorted")
                : next(),
        );
        expect(grid.run("sort-columns.toggle", { columnKey: "age" }).ok).toBe(
            false,
        );
        remove();
        grid.use((ctx, next) => {
            if (ctx.command === "sort-columns.toggle") {
                ctx.payload = { ...ctx.payload, multi: true };
            }
            return next();
        });
        grid.run("sort-columns.toggle", { columnKey: "name" });
        grid.run("sort-columns.toggle", { columnKey: "age" });
        expect(grid.state.sortColumns.map((entry) => entry.columnKey)).toEqual([
            "name",
            "age",
        ]);
    });
});
