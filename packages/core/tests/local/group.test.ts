import { describe, expect, it, vi } from "vitest";
import { type Column, createDataGridModel, type RowMeta } from "../../src";
import {
    createLocalRows,
    type GroupedRows,
    groupKeyOf,
    groupRows,
} from "../../src/local";

// Grouping rows in memory (Epic #87, E3.2): after the filters, the search and the sort, before
// the page; group rows with a count and the app's aggregates, nested by the next column, ordered
// by the sort when it sorts their column; the grid given them flattened, as it shows them.

interface Sale {
    id: number;
    country: string | null;
    city: string;
    amount: number;
}

const sales: Sale[] = [
    { id: 1, country: "France", city: "Paris", amount: 10 },
    { id: 2, country: "Brazil", city: "Recife", amount: 5 },
    { id: 3, country: "France", city: "Lyon", amount: 7 },
    { id: 4, country: null, city: "Nowhere", amount: 1 },
    { id: 5, country: "Brazil", city: "Recife", amount: 3 },
    { id: 6, country: "France", city: "Paris", amount: 2 },
];

const columns: Column<Sale>[] = [
    { key: "country", width: 100 },
    { key: "city", width: 100 },
    { key: "amount", width: 100 },
];

const sum = (rows: readonly Sale[]) =>
    rows.reduce((total, row) => total + row.amount, 0);

const FRANCE = groupKeyOf([["country", "France"]]);
const BRAZIL = groupKeyOf([["country", "Brazil"]]);

/** Each shown row, as text: a group row's value and count, a data row's id, indented by depth. */
function shown(groups: GroupedRows<Sale> | null): string[] {
    if (!groups) return [];
    return Array.from({ length: groups.rowCount }, (_, index) => {
        const meta = groups.getRowMeta(index);
        const indent = "  ".repeat(meta?.depth ?? 0);
        const group = meta?.group;
        if (group)
            return `${indent}${String(group.value)} (${group.childCount})`;
        return `${indent}#${groups.getRow(index)?.id}`;
    });
}

describe("grouping in the local pipeline", () => {
    it("changes nothing without groupBy", () => {
        const local = createLocalRows<Sale>();
        const view = local.derive(sales, columns);
        expect(view.groups).toBeNull();
        expect(view.rows).toEqual(sales);
        expect(local.derive(sales, columns, { groupBy: [] })).toBe(view);
    });

    it("groups by a column: values ascending, an empty one last, collapsed", () => {
        const local = createLocalRows<Sale>();
        const view = local.derive(sales, columns, { groupBy: ["country"] });
        expect(shown(view.groups)).toEqual([
            "Brazil (2)",
            "France (3)",
            "null (1)",
        ]);
        // the data rows shown: none while collapsed
        expect(view.rows).toEqual([]);
        expect(view.filteredCount).toBe(6);
        expect(view.groups?.groupKeys).toEqual([
            BRAZIL,
            FRANCE,
            groupKeyOf([["country", null]]),
        ]);
    });

    it("shows an expanded group's rows under it, in the sort's order", () => {
        const local = createLocalRows<Sale>({
            defaultExpandedGroupKeys: [FRANCE],
            defaultSortColumns: [
                { columnKey: "amount", direction: "ascending" },
            ],
        });
        const view = local.derive(sales, columns, { groupBy: ["country"] });
        expect(shown(view.groups)).toEqual([
            "Brazil (2)",
            "France (3)",
            "  #6",
            "  #3",
            "  #1",
            "null (1)",
        ]);
        expect(view.rows.map((row) => row.id)).toEqual([6, 3, 1]);
        expect(view.rowIndexes).toEqual([5, 2, 0]);
    });

    it("orders the groups by the sort when it sorts their column", () => {
        const local = createLocalRows<Sale>({
            defaultSortColumns: [
                { columnKey: "country", direction: "descending" },
            ],
        });
        const view = local.derive(sales, columns, { groupBy: ["country"] });
        expect(shown(view.groups)).toEqual([
            "France (3)",
            "Brazil (2)",
            "null (1)",
        ]);
    });

    it("nests by the next column, and tells each row its place", () => {
        const paris = groupKeyOf([
            ["country", "France"],
            ["city", "Paris"],
        ]);
        const local = createLocalRows<Sale>({
            defaultExpandedGroupKeys: [FRANCE, paris],
        });
        const { groups } = local.derive(sales, columns, {
            groupBy: ["country", "city"],
        });
        expect(shown(groups)).toEqual([
            "Brazil (2)",
            "France (3)",
            "  Lyon (1)",
            "  Paris (2)",
            "    #1",
            "    #6",
            "null (1)",
        ]);
        const meta = (index: number): RowMeta | undefined =>
            groups?.getRowMeta(index);
        expect(meta(1)).toMatchObject({
            depth: 0,
            parentIndex: undefined,
            setSize: 3,
            posInSet: 2,
        });
        expect(meta(3)).toMatchObject({
            depth: 1,
            parentIndex: 1,
            setSize: 2,
            posInSet: 2,
        });
        expect(meta(5)).toEqual({
            depth: 2,
            parentIndex: 3,
            setSize: 2,
            posInSet: 2,
        });
        expect(groups?.groupKeys).toContain(paris);
        // a group row has no data row
        expect(groups?.getRow(1)).toBeUndefined();
    });

    it("gives each group the app's aggregates and its rows' keys", () => {
        const local = createLocalRows<Sale>();
        const { groups } = local.derive(sales, columns, {
            groupBy: ["country"],
            aggregates: { amount: sum },
            rowKey: (row) => `s${row.id}`,
        });
        const france = groups?.getRowMeta(1)?.group;
        expect(france).toMatchObject({
            key: FRANCE,
            columnKey: "country",
            value: "France",
            depth: 0,
            childCount: 3,
            aggregates: { amount: 19 },
            rowKeys: ["s1", "s3", "s6"],
        });
        // without a rowKey, a row's key is its index among the rows given
        const plain = createLocalRows<Sale>().derive(sales, columns, {
            groupBy: ["country"],
        });
        expect(plain.groups?.getRowMeta(1)?.group?.rowKeys).toEqual([0, 2, 5]);
        expect(plain.groups?.rowKey({ ...sales[0], id: 99 } as Sale, 1)).toBe(
            1,
        );
    });

    it("filters inside the groups: a group without rows left goes", () => {
        const local = createLocalRows<Sale>({
            defaultFilters: { city: "rec" },
        });
        const view = local.derive(sales, columns, { groupBy: ["country"] });
        expect(shown(view.groups)).toEqual(["Brazil (2)"]);
    });

    it("keys data rows by the app's key, or their index among the rows given", () => {
        const local = createLocalRows<Sale>({
            defaultExpandedGroupKeys: [BRAZIL],
        });
        const { groups } = local.derive(sales, columns, {
            groupBy: ["country"],
            rowKey: (row) => `s${row.id}`,
        });
        const row = groups?.getRow(1);
        expect(row?.id).toBe(2);
        if (!row || !groups) throw new Error("no row");
        expect(groups.rowKey(row, 1)).toBe("s2");
        const plain = createLocalRows<Sale>({
            defaultExpandedGroupKeys: [BRAZIL],
        }).derive(sales, columns, { groupBy: ["country"] });
        expect(plain.groups?.rowKey(row, 2)).toBe(4);
    });

    it("expands by its own state, or by the keys it is given", () => {
        const local = createLocalRows<Sale>();
        const listener = vi.fn();
        local.subscribe(listener);
        local.setExpandedGroupKeys([BRAZIL]);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(
            shown(
                local.derive(sales, columns, { groupBy: ["country"] }).groups,
            ),
        ).toHaveLength(5);
        const given = local.derive(sales, columns, {
            groupBy: ["country"],
            expandedGroupKeys: [FRANCE],
        });
        expect(shown(given.groups)).toHaveLength(6);
    });

    it("pages the rows shown, group rows included", () => {
        const local = createLocalRows<Sale>({
            pageSize: 3,
            defaultPageIndex: 1,
            defaultExpandedGroupKeys: [BRAZIL, FRANCE],
        });
        const view = local.derive(sales, columns, { groupBy: ["country"] });
        // Brazil, #2, #5 | France, #1, #3 | #6, null
        expect(view.pageCount).toBe(3);
        expect(shown(view.groups)).toEqual(["France (3)", "  #1", "  #3"]);
        expect(view.groups?.getRowMeta(1)?.parentIndex).toBe(0);
        local.setPageIndex(2);
        const last = local.derive(sales, columns, { groupBy: ["country"] });
        // its group is on the page before: no row above it to go to
        expect(last.groups?.getRowMeta(0)?.parentIndex).toBeUndefined();
    });

    it("works out each stage again only when its inputs change", () => {
        const local = createLocalRows<Sale>();
        const aggregates = { amount: vi.fn(sum) };
        const first = local.derive(sales, columns, {
            groupBy: ["country"],
            aggregates,
        });
        const calls = aggregates.amount.mock.calls.length;
        // a new groupBy array of the same keys is the same grouping
        const again = local.derive(sales, columns, {
            groupBy: ["country"],
            aggregates,
        });
        expect(again).toBe(first);
        local.setExpandedGroupKeys([FRANCE]);
        local.derive(sales, columns, { groupBy: ["country"], aggregates });
        // expanding a group groups nothing again
        expect(aggregates.amount.mock.calls.length).toBe(calls);
    });

    it("hands the grid what it takes: a treegrid of group rows", () => {
        const local = createLocalRows<Sale>({
            defaultExpandedGroupKeys: [FRANCE],
        });
        const { groups } = local.derive(sales, columns, {
            groupBy: ["country"],
            rowKey: (row) => row.id,
        });
        if (!groups) throw new Error("not grouped");
        const model = createDataGridModel<Sale>({
            columns,
            rowCount: groups.rowCount,
            getRow: groups.getRow,
            getRowMeta: groups.getRowMeta,
            rowKey: groups.rowKey,
            rowSelection: "multiple",
            expandedGroupKeys: [FRANCE],
        });
        expect(model.get("row-key-by", { rowIndex: 1 })).toBe(FRANCE);
        expect(model.get("row-key-by", { rowIndex: 2 })).toBe(1);
        expect(model.is("row-group-expanded", { rowIndex: 1 })).toBe(true);
        model.run("selected-rows.toggle", { rowIndex: 1 });
        expect(model.get("selected-row-keys")).toEqual([1, 3, 6]);
    });

    it("groups any array on its own: groupRows", () => {
        const groups = groupRows(sales, columns, {
            groupBy: ["country"],
            expandedGroupKeys: [BRAZIL],
        });
        expect(shown(groups)).toEqual([
            "Brazil (2)",
            "  #2",
            "  #5",
            "France (3)",
            "null (1)",
        ]);
    });

    it("leaves the rows isRowSelectable refuses out of a group's keys", () => {
        const { groups } = createLocalRows<Sale>().derive(sales, columns, {
            groupBy: ["country"],
            rowKey: (row) => row.id,
            isRowSelectable: (row) => row.amount > 5,
        });
        // France: 10, 7 and 2
        expect(groups?.getRowMeta(1)?.group?.rowKeys).toEqual([1, 3]);
        expect(groups?.getRowMeta(1)?.group?.childCount).toBe(3);
    });
});
