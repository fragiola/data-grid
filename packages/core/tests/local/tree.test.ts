import { describe, expect, it, vi } from "vitest";
import { type Column, createDataGridModel } from "../../src";
import { createLocalRows, type GroupedRows, treeRows } from "../../src/local";

// Tree data in memory (Epic #87, E3.3): rows with rows under them (`getSubRows`), flattened as
// the grid shows them; parents are data rows that expand by their key; the filters keep a match's
// ancestors, the sort orders each parent's rows among themselves.

interface File {
    name: string;
    size: number;
    children?: File[];
}

const files: File[] = [
    {
        name: "src",
        size: 30,
        children: [
            { name: "app.ts", size: 10 },
            {
                name: "lib",
                size: 20,
                children: [
                    { name: "a.ts", size: 5 },
                    { name: "b.ts", size: 15 },
                ],
            },
        ],
    },
    { name: "docs", size: 3, children: [{ name: "readme.md", size: 3 }] },
    { name: "package.json", size: 1 },
];

const columns: Column<File>[] = [
    { key: "name", width: 200 },
    { key: "size", width: 80 },
];

const getSubRows = (file: File) => file.children;
const byName = (file: File) => file.name;

/** Each shown row, as text: its name, indented by depth, `+`/`-` for a collapsed/expanded parent. */
function shown(
    rows: GroupedRows<File> | null,
    expanded: readonly string[] = [],
) {
    if (!rows) return [];
    return Array.from({ length: rows.rowCount }, (_, index) => {
        const meta = rows.getRowMeta(index);
        const file = rows.getRow(index);
        const mark = meta?.expandable
            ? expanded.includes(file?.name ?? "")
                ? "- "
                : "+ "
            : "";
        return `${"  ".repeat(meta?.depth ?? 0)}${mark}${file?.name}`;
    });
}

describe("tree data in the local pipeline", () => {
    it("shows the top rows, parents collapsed", () => {
        const view = createLocalRows<File>().derive(files, columns, {
            getSubRows,
            rowKey: byName,
        });
        expect(shown(view.groups)).toEqual(["+ src", "+ docs", "package.json"]);
        expect(view.groups?.getRowMeta(0)).toEqual({
            depth: 0,
            expandable: true,
            parentIndex: undefined,
            setSize: 3,
            posInSet: 1,
        });
        // every row at every depth
        expect(view.total).toBe(8);
        expect(view.groups?.groupKeys).toEqual(["src", "lib", "docs"]);
    });

    it("shows an expanded parent's rows under it, a level down", () => {
        const expanded = ["src", "lib"];
        const { groups } = createLocalRows<File>({
            defaultExpandedGroupKeys: expanded,
        }).derive(files, columns, { getSubRows, rowKey: byName });
        expect(shown(groups, expanded)).toEqual([
            "- src",
            "  app.ts",
            "  - lib",
            "    a.ts",
            "    b.ts",
            "+ docs",
            "package.json",
        ]);
        expect(groups?.getRowMeta(4)).toEqual({
            depth: 2,
            parentIndex: 2,
            setSize: 2,
            posInSet: 2,
        });
        // a parent's rows at every depth, collapsed ones included
        expect(groups?.subRowKeysOf(0)).toEqual([
            "app.ts",
            "lib",
            "a.ts",
            "b.ts",
        ]);
        expect(groups?.subRowKeysOf(5)).toEqual(["readme.md"]);
        expect(groups?.subRowKeysOf(6)).toEqual([]);
    });

    it("keys rows by their place in the whole tree without a rowKey", () => {
        const { groups } = createLocalRows<File>({
            defaultExpandedGroupKeys: [0],
        }).derive(files, columns, { getSubRows });
        // src 0, app.ts 1, lib 2, a.ts 3, b.ts 4, docs 5, readme.md 6, package.json 7
        expect(groups?.groupKeys).toEqual([0, 2, 5]);
        // shown fourth (lib collapsed), docs is still the tree's sixth row
        const docs = groups?.getRow(3);
        if (!docs || !groups) throw new Error("no docs");
        expect(docs.name).toBe("docs");
        expect(groups.rowKey(docs, 3)).toBe(5);
    });

    it("keeps the ancestors of a row the search finds", () => {
        const expanded = ["src", "lib", "docs"];
        const view = createLocalRows<File>({
            defaultSearch: "b.ts",
            defaultExpandedGroupKeys: expanded,
        }).derive(files, columns, { getSubRows, rowKey: byName });
        expect(shown(view.groups, expanded)).toEqual([
            "- src",
            "  - lib",
            "    b.ts",
        ]);
        // the rows it leaves, at every depth, in the tree's order
        expect(view.filteredCount).toBe(3);
        expect(view.filteredRows.map(byName)).toEqual(["src", "lib", "b.ts"]);
    });

    it("sorts each parent's rows among themselves", () => {
        const expanded = ["src", "lib"];
        const view = createLocalRows<File>({
            defaultSortColumns: [
                { columnKey: "size", direction: "descending" },
            ],
            defaultExpandedGroupKeys: expanded,
        }).derive(files, columns, { getSubRows, rowKey: byName });
        expect(shown(view.groups, expanded)).toEqual([
            "- src",
            "  - lib",
            "    b.ts",
            "    a.ts",
            "  app.ts",
            "+ docs",
            "package.json",
        ]);
    });

    it("pages the rows shown", () => {
        const local = createLocalRows<File>({
            pageSize: 4,
            defaultPageIndex: 1,
            defaultExpandedGroupKeys: ["src", "lib"],
        });
        const view = local.derive(files, columns, {
            getSubRows,
            rowKey: byName,
        });
        expect(view.pageCount).toBe(2);
        expect(shown(view.groups, ["src", "lib"])).toEqual([
            "    b.ts",
            "+ docs",
            "package.json",
        ]);
        // its parent is on the page before
        expect(view.groups?.getRowMeta(0)?.parentIndex).toBeUndefined();
    });

    it("reads the tree once: expanding reads no row's rows again", () => {
        const local = createLocalRows<File>();
        const read = vi.fn(getSubRows);
        local.derive(files, columns, { getSubRows: read, rowKey: byName });
        const calls = read.mock.calls.length;
        expect(calls).toBe(8);
        local.setExpandedGroupKeys(["src"]);
        local.derive(files, columns, { getSubRows: read, rowKey: byName });
        expect(read.mock.calls.length).toBe(calls);
    });

    it("flattens any tree on its own: treeRows", () => {
        const rows = treeRows(files, {
            getSubRows,
            rowKey: byName,
            expandedGroupKeys: ["docs"],
        });
        expect(shown(rows, ["docs"])).toEqual([
            "+ src",
            "- docs",
            "  readme.md",
            "package.json",
        ]);
    });

    it("hands the grid a treegrid whose parents expand by their key", () => {
        const { groups } = createLocalRows<File>().derive(files, columns, {
            getSubRows,
            rowKey: byName,
        });
        if (!groups) throw new Error("no tree");
        const model = createDataGridModel<File>({
            columns,
            rowCount: groups.rowCount,
            getRow: groups.getRow,
            getRowMeta: groups.getRowMeta,
            rowKey: groups.rowKey,
            rowSelection: "multiple",
        });
        expect(model.run("row-groups.toggle", { rowIndex: 0 })).toEqual({
            ok: true,
            value: ["src"],
        });
        // a parent is a data row: it selects itself
        model.run("selected-rows.toggle", { rowIndex: 0 });
        expect(model.get("selected-row-keys")).toEqual(["src"]);
        expect(model.run("row-groups.toggle", { rowIndex: 2 }).ok).toBe(false);
    });

    it("leaves the rows isRowSelectable refuses out of a parent's keys, worked out once", () => {
        const local = createLocalRows<File>();
        const grouping = {
            getSubRows,
            rowKey: byName,
            isRowSelectable: (file: File) => !file.name.endsWith(".md"),
        };
        const first = local.derive(files, columns, grouping).groups;
        // docs holds readme.md only: refused
        expect(first?.subRowKeysOf(1)).toEqual([]);
        const src = first?.subRowKeysOf(0);
        expect(src).toEqual(["app.ts", "lib", "a.ts", "b.ts"]);
        // the same keys again, and after the tree opens: its node is the same
        expect(first?.subRowKeysOf(0)).toBe(src);
        local.setExpandedGroupKeys(["src"]);
        expect(
            local.derive(files, columns, grouping).groups?.subRowKeysOf(0),
        ).toBe(src);
    });

    it("lists the rows it leaves in the sort's tree order", () => {
        const view = createLocalRows<File>({
            defaultSortColumns: [{ columnKey: "size", direction: "ascending" }],
        }).derive(files, columns, { getSubRows, rowKey: byName });
        expect(view.filteredRows.map(byName)).toEqual([
            "package.json",
            "docs",
            "readme.md",
            "src",
            "app.ts",
            "lib",
            "a.ts",
            "b.ts",
        ]);
    });
});
