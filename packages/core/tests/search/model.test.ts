import { describe, expect, it, vi } from "vitest";
import { bindGridRoot, createDataGridModel } from "../../src";
import { search } from "../../src/search";

// Search (Epic #153): installed, the model keeps the search text; a root's props control it. The
// grid never searches the rows.

const columns = [{ key: "name", width: 120 }];
const rows = [{ name: "a" }, { name: "b" }];

describe("search", () => {
    it("starts without a search, or with the text given", () => {
        const plain = createDataGridModel({
            columns,
            rows,
            features: [search()],
        });
        expect(plain.get("search-text")).toBe("");
        expect(plain.is("searched", undefined)).toBe(false);
        const given = createDataGridModel({
            columns,
            rows,
            features: [search()],
            searchText: "ab",
        });
        expect(given.get("search-text")).toBe("ab");
        expect(given.is("searched", undefined)).toBe(true);
    });

    it("sets and clears the text, refusing one that is no string", () => {
        const grid = createDataGridModel({
            columns,
            rows,
            features: [search()],
        });
        expect(grid.run("search.set", { text: "  " })).toEqual({
            ok: true,
            value: "  ",
        });
        // a blank text is no search
        expect(grid.is("searched", undefined)).toBe(false);
        const state = grid.state;
        grid.run("search.set", { text: "  " });
        expect(grid.state).toBe(state);
        expect(grid.run("search.clear")).toEqual({
            ok: true,
            value: "",
        });
        expect(
            grid.run("search.set", { text: 3 as unknown as string }),
        ).toMatchObject({ ok: false, error: { code: "invalid_payload" } });
        expect(grid.state.rowCount).toBe(2);
    });

    it("is controlled by a root's props", () => {
        const onSearchTextChange = vi.fn();
        let props = {
            columns,
            rows,
            features: [search()] as const,
            searchText: "a",
            onSearchTextChange,
        };
        const root = bindGridRoot(() => props);
        root.sync();
        root.model.run("search.set", { text: "b" });
        expect(onSearchTextChange).toHaveBeenCalledWith("b");
        expect(root.model.get("search-text")).toBe("a");
        props = { ...props, searchText: "b" };
        root.sync();
        expect(root.model.get("search-text")).toBe("b");
    });

    it("is uncontrolled from its default, telling every change", () => {
        const onSearchTextChange = vi.fn();
        const root = bindGridRoot(() => ({
            columns,
            rows,
            features: [search()] as const,
            defaultSearchText: "a",
            onSearchTextChange,
        }));
        root.sync();
        expect(root.model.get("search-text")).toBe("a");
        root.model.run("search.clear");
        expect(root.model.get("search-text")).toBe("");
        expect(onSearchTextChange).toHaveBeenCalledWith("");
    });
});
