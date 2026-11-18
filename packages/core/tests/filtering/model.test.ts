import { describe, expect, it, vi } from "vitest";
import {
    bindGridRoot,
    type Column,
    type ColumnGroup,
    createDataGridEngine,
    createDataGridModel,
    headerCellPart,
} from "../../src";
import { type ColumnFilters, filtering } from "../../src/filtering";

// Filtering (Epic #153): installed, the model keeps the column filters, by column key, none
// empty; the header cell of a filtered column carries `data-filtered`; a root's props control
// them. The grid never filters the rows.

interface Person {
    id: number;
    name: string;
    team: string;
}

const people: Person[] = Array.from({ length: 5 }, (_, i) => ({
    id: i,
    name: `Person ${i}`,
    team: i % 2 ? "Data" : "Design",
}));

const columns: (Column<Person> | ColumnGroup<Person>)[] = [
    { key: "name", width: 120 },
    { key: "group", children: [{ key: "team", width: 100 }] },
];

function filtered(columnFilters?: ColumnFilters) {
    return createDataGridModel({
        columns,
        rows: people,
        features: [filtering()],
        columnFilters,
    });
}

describe("filtering", () => {
    it("starts without filters, or with the ones given that are a column's and not empty", () => {
        expect(filtered().get("column-filters")).toEqual({});
        expect(
            filtered({ team: "Data", name: "", gone: "x", group: "y" }).get(
                "column-filters",
            ),
        ).toEqual({ team: "Data" });
    });

    it("sets, sets one, clears one and clears every filter", () => {
        const grid = filtered();
        expect(
            grid.run("column-filters.set", {
                columnFilters: { name: "per", team: ["Data"] },
            }),
        ).toEqual({ ok: true, value: { name: "per", team: ["Data"] } });
        expect(grid.get("column-filter-by", { columnKey: "team" })).toEqual([
            "Data",
        ]);
        expect(grid.is("column-filtered", { columnKey: "name" })).toBe(true);
        grid.run("column-filter.set", { columnKey: "name", value: "" });
        expect(grid.get("column-filters")).toEqual({ team: ["Data"] });
        grid.run("column-filter.set", { columnKey: "name", value: 3 });
        grid.run("column-filters.clear", { columnKey: "team" });
        expect(grid.get("column-filters")).toEqual({ name: 3 });
        grid.run("column-filters.clear", undefined);
        expect(grid.get("column-filters")).toEqual({});
        expect(grid.is("column-filtered", { columnKey: "name" })).toBe(false);
    });

    it("refuses a key that is no column's and a payload that is no object", () => {
        const grid = filtered();
        expect(
            grid.run("column-filter.set", { columnKey: "gone", value: 1 }),
        ).toMatchObject({ ok: false, error: { code: "not_found" } });
        expect(
            grid.run("column-filters.set", { columnFilters: { group: 1 } }),
        ).toMatchObject({ ok: false, error: { code: "not_found" } });
        expect(
            grid.run("column-filters.set", {
                columnFilters: null as unknown as ColumnFilters,
            }),
        ).toMatchObject({ ok: false, error: { code: "invalid_payload" } });
    });

    it("keeps the same state for the same filters, and its own copy", () => {
        const grid = filtered();
        const given = { name: "a" };
        grid.run("column-filters.set", { columnFilters: given });
        const state = grid.state;
        grid.run("column-filters.set", { columnFilters: { name: "a" } });
        expect(grid.state).toBe(state);
        (given as Record<string, unknown>).name = "b";
        expect(grid.get("column-filters")).toEqual({ name: "a" });
    });

    it("drops a filter whose column is gone", () => {
        const grid = filtered({ name: "a", team: "Data" });
        grid.run("columns.set", { columns: [{ key: "name", width: 120 }] });
        expect(grid.get("column-filters")).toEqual({ name: "a" });
    });

    it("never filters the rows", () => {
        const grid = filtered({ team: "Data" });
        expect(grid.state.rowCount).toBe(people.length);
    });

    it("marks a filtered column's header cell", () => {
        const grid = filtered({ team: "Data" });
        const engine = createDataGridEngine(grid);
        const view = engine.adapter.getView();
        const part = (key: string) => {
            const cell = view.header.cellByKey(key);
            if (!cell) throw new Error(key);
            return headerCellPart(view, cell);
        };
        expect(part("team").attributes?.["data-filtered"]).toBe("");
        expect(part("team").state.filtered).toBe(true);
        expect(part("name").attributes?.["data-filtered"]).toBeUndefined();
        expect(part("name").state.filtered).toBe(false);
        // a group's cell is never filtered
        const group = view.header.cellByKey("group");
        expect(group && headerCellPart(view, group).state.filtered).toBe(false);
        engine.destroy();
    });

    it("is controlled by a root's props, and tells the filters a command asks for", () => {
        const onColumnFiltersChange = vi.fn();
        let props = {
            columns,
            rows: people,
            features: [filtering()] as const,
            columnFilters: { team: "Data" } as ColumnFilters,
            onColumnFiltersChange,
        };
        const root = bindGridRoot(() => props);
        root.sync();
        expect(root.model.get("column-filters")).toEqual({ team: "Data" });
        root.model.run("column-filter.set", { columnKey: "name", value: "a" });
        expect(onColumnFiltersChange).toHaveBeenCalledWith({
            team: "Data",
            name: "a",
        });
        expect(root.model.get("column-filters")).toEqual({ team: "Data" });
        props = { ...props, columnFilters: { name: "a", gone: 1 } };
        root.sync();
        expect(root.model.get("column-filters")).toEqual({ name: "a" });
        // what the columns could not take is told as it settled
        expect(onColumnFiltersChange).toHaveBeenLastCalledWith({ name: "a" });
    });
});
