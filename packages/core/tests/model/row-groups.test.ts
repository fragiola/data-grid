import { describe, expect, it } from "vitest";
import {
    createDataGridModel,
    type DataGridModelOptions,
    type GroupRow,
    type RowMeta,
} from "../../src";

// Row kinds (Epic #87, E3.1): a source says what each index is (`getRowMeta`): a group row, which
// has no data row and is keyed by its group, or a data row at a depth. The model expands row
// groups by key and selects a group's rows by theirs.

interface Row {
    id: string;
    amount: number;
}

const group = (
    key: string,
    rowKeys: readonly string[],
    value = key,
): GroupRow => ({
    key,
    columnKey: "id",
    value,
    depth: 0,
    childCount: rowKeys.length,
    aggregates: { amount: rowKeys.length * 10 },
    rowKeys,
});

/**
 * Two groups as the grid shows them: "a" expanded (its rows r1 and r2 under it), then "b"
 * collapsed (r3 not shown), then a row at the top that expands (a tree's parent).
 */
const SHOWN: readonly { meta: RowMeta; row?: Row }[] = [
    { meta: { group: group("a", ["r1", "r2"]), setSize: 3, posInSet: 1 } },
    {
        meta: { depth: 1, parentIndex: 0, setSize: 2, posInSet: 1 },
        row: { id: "r1", amount: 1 },
    },
    {
        meta: { depth: 1, parentIndex: 0, setSize: 2, posInSet: 2 },
        row: { id: "r2", amount: 2 },
    },
    { meta: { group: group("b", ["r3"]), setSize: 3, posInSet: 2 } },
    { meta: { expandable: true }, row: { id: "p", amount: 5 } },
];

function setup(options: DataGridModelOptions<Row> = {}) {
    return createDataGridModel<Row>({
        columns: [
            { key: "id", width: 100 },
            { key: "amount", width: 100 },
        ],
        rowCount: SHOWN.length,
        // a group row's index holds anything: the grid never reads it
        getRow: (index) => SHOWN[index]?.row ?? { id: "never", amount: -1 },
        getRowMeta: (index) => SHOWN[index]?.meta,
        rowKey: (row) => row.id,
        expandedGroupKeys: ["a"],
        ...options,
    });
}

describe("rows with kinds", () => {
    it("reads no data row at a group row, and keys it by its group", () => {
        const model = setup();
        expect(model.get("row-by", { index: 0 })).toBeUndefined();
        expect(model.get("row-by", { index: 1 })).toEqual({
            id: "r1",
            amount: 1,
        });
        expect(model.get("row-key-by", { rowIndex: 0 })).toBe("a");
        expect(model.get("row-key-by", { rowIndex: 1 })).toBe("r1");
        // nothing to wait for
        expect(model.is("row-loaded", { rowIndex: 0 })).toBe(true);
        expect(model.get("row-meta-by", { rowIndex: 3 })?.group?.key).toBe("b");
    });

    it("gives a group row's cells its value and its aggregates", () => {
        const model = setup();
        expect(
            model.get("cell-value-by", { rowIndex: 0, columnIndex: 0 }),
        ).toBe("a");
        expect(
            model.get("cell-value-by", { rowIndex: 0, columnIndex: 1 }),
        ).toBe(20);
        expect(
            model.get("cell-value-by", { rowIndex: 1, columnIndex: 1 }),
        ).toBe(1);
    });

    it("has no kinds without getRowMeta", () => {
        const model = createDataGridModel<Row>({
            rows: [{ id: "x", amount: 1 }],
        });
        expect(model.get("row-meta-by", { rowIndex: 0 })).toBeUndefined();
        expect(model.state.source).not.toHaveProperty("getRowMeta");
        expect(model.get("expanded-group-keys")).toEqual([]);
    });

    it("takes getRowMeta with the data: left out, kept; given undefined, cleared (as rowKey)", () => {
        const model = setup();
        const rows = [{ id: "x", amount: 1 }];
        const kept = model.state.source.getRowMeta;
        expect(model.run("data.set", { rows }).ok).toBe(true);
        expect(model.state.source.getRowMeta).toBe(kept);
        expect(model.state.rowKey).toBeDefined();
        model.run("data.set", { rows, getRowMeta: undefined });
        expect(model.state.source.getRowMeta).toBeUndefined();
        const getRowMeta = () => ({ depth: 2 });
        model.run("data.set", { rows, getRowMeta });
        expect(model.get("row-meta-by", { rowIndex: 0 })).toEqual({
            depth: 2,
        });
        // asked for the source's rows only
        expect(model.get("row-meta-by", { rowIndex: 1 })).toBeUndefined();
        const refused = model.run("data.set", {
            rows,
            // @ts-expect-error: not a function
            getRowMeta: 3,
        });
        expect(refused.ok || refused.error.code).toBe("invalid_payload");
    });
});

describe("row-groups.*", () => {
    it("toggles a group row by its index, and by its key", () => {
        const model = setup();
        expect(model.is("row-group-expanded", { rowIndex: 0 })).toBe(true);
        expect(model.run("row-groups.toggle", { rowIndex: 0 })).toEqual({
            ok: true,
            value: [],
        });
        expect(model.is("row-group-expanded", { rowIndex: 0 })).toBe(false);
        model.run("row-groups.toggle", { groupKey: "b" });
        expect(model.get("expanded-group-keys")).toEqual(["b"]);
        expect(model.is("row-group-expanded", { rowIndex: 3 })).toBe(true);
    });

    it("toggles a row that expands by its own key", () => {
        const model = setup();
        model.run("row-groups.toggle", { rowIndex: 4 });
        expect(model.get("expanded-group-keys")).toEqual(["a", "p"]);
        expect(model.is("row-group-expanded", { rowIndex: 4 })).toBe(true);
    });

    it("refuses a row that does not expand, and a row that is not there", () => {
        const model = setup();
        const plain = model.run("row-groups.toggle", { rowIndex: 1 });
        expect(plain.ok || plain.error.code).toBe("refused");
        const gone = model.run("row-groups.toggle", { rowIndex: 9 });
        expect(gone.ok || gone.error.code).toBe("not_found");
        const bad = model.run(
            "row-groups.toggle",
            // @ts-expect-error: neither an index nor a key
            {},
        );
        expect(bad.ok || bad.error.code).toBe("invalid_payload");
    });

    it("sets the keys as a set: the same keys in another order change nothing", () => {
        const model = setup({ expandedGroupKeys: ["a", "b"] });
        const before = model.state;
        model.run("row-groups.set", { groupKeys: ["b", "a", "b"] });
        expect(model.state).toBe(before);
        model.run("row-groups.set", { groupKeys: ["gone"] });
        // a key no row has is kept: its row may come
        expect(model.get("expanded-group-keys")).toEqual(["gone"]);
        const bad = model.run("row-groups.set", {
            // @ts-expect-error: not keys
            groupKeys: [{}],
        });
        expect(bad.ok || bad.error.code).toBe("invalid_payload");
    });

    it("gives a group row no detail", () => {
        const model = setup();
        const result = model.run("expanded-rows.toggle", { rowIndex: 0 });
        expect(result.ok || result.error.message).toMatch(/group row/);
    });
});

describe("selecting a group row", () => {
    it("selects its rows' keys, and clears them once all are", () => {
        const model = setup({ rowSelection: "multiple" });
        expect(model.is("row-selectable", { rowIndex: 0 })).toBe(true);
        expect(model.is("row-selected", { rowIndex: 0 })).toBe(false);
        model.run("selected-rows.toggle", { rowIndex: 0 });
        expect(model.get("selected-row-keys")).toEqual(["r1", "r2"]);
        expect(model.is("row-selected", { rowIndex: 0 })).toBe(true);
        model.run("selected-rows.toggle", { rowIndex: 0 });
        expect(model.get("selected-row-keys")).toEqual([]);
    });

    it("adds the missing keys when some are selected", () => {
        const model = setup({
            rowSelection: "multiple",
            selectedRowKeys: ["r2", "x"],
        });
        expect(model.is("row-selected", { rowIndex: 0 })).toBe(false);
        model.run("selected-rows.toggle", { rowIndex: 0 });
        expect(model.get("selected-row-keys")).toEqual(["r2", "x", "r1"]);
        expect(model.is("row-selected", { rowIndex: 0 })).toBe(true);
    });

    it("is refused in single mode, and for a group naming no rows", () => {
        const single = setup({ rowSelection: "single" });
        expect(single.is("row-selectable", { rowIndex: 0 })).toBe(false);
        const refused = single.run("selected-rows.toggle", { rowIndex: 0 });
        expect(refused.ok || refused.error.code).toBe("refused");
        const bare = createDataGridModel<Row>({
            rowCount: 1,
            getRow: () => undefined,
            getRowMeta: () => ({
                group: { ...group("g", []), rowKeys: undefined },
            }),
            rowSelection: "multiple",
        });
        expect(bare.is("row-selectable", { rowIndex: 0 })).toBe(false);
        expect(bare.can("selected-rows.toggle", { rowIndex: 0 })).toBe(false);
    });

    it("takes a group row's rows in a range and in select-all: a collapsed group's too", () => {
        const model = setup({ rowSelection: "multiple" });
        model.run("selected-rows.toggle", { rowIndex: 1 });
        // from r1 (the anchor) to the row that expands: "b", collapsed, gives r3
        model.run("selected-rows.toggle", { rowIndex: 4, extend: true });
        expect(model.get("selected-row-keys")).toEqual(["r1", "r2", "r3", "p"]);
        model.run("selected-rows.set", { rowKeys: [] });
        model.run("selected-rows.select-all", {});
        expect(model.get("selected-row-keys")).toEqual(["r1", "r2", "r3", "p"]);
        // a range back clears them alike
        model.run("selected-rows.toggle", { rowIndex: 4 });
        model.run("selected-rows.toggle", { rowIndex: 2, extend: true });
        expect(model.get("selected-row-keys")).toEqual(["r1"]);
    });

    it("still refuses a range reaching a data row not loaded", () => {
        const model = createDataGridModel<Row>({
            rowCount: 3,
            getRow: (index) =>
                index === 2 ? undefined : { id: `r${index}`, amount: 0 },
            getRowMeta: (index) =>
                index === 0 ? { group: group("g", ["x", "y"]) } : undefined,
            rowKey: (row) => row.id,
            rowSelection: "multiple",
        });
        const all = model.run("selected-rows.select-all", {});
        expect(all.ok || all.error.code).toBe("not_loaded");
    });

    it("makes a group row toggled by its index the anchor, with the state it gave", () => {
        const model = setup({ rowSelection: "multiple" });
        model.run("selected-rows.toggle", { rowIndex: 1 });
        model.run("selected-rows.toggle", { rowIndex: 3 });
        expect(model.get("selection-anchor")).toEqual({
            rowKey: "b",
            rowIndex: 3,
            selected: true,
        });
        // from the group row, not from r1: r2 stays out
        model.run("selected-rows.toggle", { rowIndex: 4, extend: true });
        expect(model.get("selected-row-keys")).toEqual(["r1", "r3", "p"]);
        // the keys set as the anchor's state left it: the anchor stays
        model.run("selected-rows.set", { rowKeys: ["r3"] });
        expect(model.get("selection-anchor")?.rowKey).toBe("b");
        model.run("selected-rows.set", { rowKeys: [] });
        expect(model.get("selection-anchor")).toBeNull();
        // a group row can be the anchor a controlled root sets back
        expect(
            model.run("selection-anchor.set", { rowIndex: 0, selected: false })
                .ok,
        ).toBe(true);
    });

    it("names groupKeys when row-groups.set is given no list", () => {
        const model = setup();
        const result = model.run("row-groups.set", {
            // @ts-expect-error: not a list
            groupKeys: "a",
        });
        expect(result.ok || result.error.message).toMatch(/^groupKeys/);
    });

    it("extends a range to a group row, and toggles it without an anchor", () => {
        const model = setup({ rowSelection: "multiple" });
        // no anchor: a toggle of the group's rows
        model.run("selected-rows.toggle", { rowIndex: 3, extend: true });
        expect(model.get("selected-row-keys")).toEqual(["r3"]);
        model.run("selected-rows.set", { rowKeys: [] });
        model.run("selected-rows.toggle", { rowIndex: 1 });
        model.run("selected-rows.toggle", { rowIndex: 3, extend: true });
        expect(model.get("selected-row-keys")).toEqual(["r1", "r2", "r3"]);
    });
});

describe("column spans on a group row", () => {
    it("asks a column's colSpan with the group", () => {
        const asked: string[] = [];
        const model = setup({
            columns: [
                {
                    key: "id",
                    width: 100,
                    colSpan: (args) => {
                        asked.push(args.type);
                        return args.type === "group" ? 2 : 1;
                    },
                },
                { key: "amount", width: 100 },
            ],
        });
        model.run("active-position.set", { rowIndex: 0, columnIndex: 1 });
        // the span covers the second column: the active cell snaps to its first
        expect(model.state.activePosition).toEqual({
            rowIndex: 0,
            columnIndex: 0,
        });
        expect(asked).toContain("group");
    });
});
