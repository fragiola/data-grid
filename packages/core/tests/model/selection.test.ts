import { describe, expect, it } from "vitest";
import {
    createDataGridModel,
    type DataGridModelOptions,
    type RowKey,
    veto,
} from "../../src";

// Selected rows (Epic #57, R1–R5): the model keeps their keys, in the order they were selected,
// and changes them only through commands; a range and select-all are all or nothing.

interface Person {
    id: string;
    locked?: boolean;
}

const people: Person[] = Array.from({ length: 10 }, (_, i) => ({
    id: `p${i}`,
    locked: i === 4,
}));

function grid(options: DataGridModelOptions<Person> = {}) {
    return createDataGridModel<Person>({
        columns: [{ key: "id", width: 100 }],
        rows: people,
        rowKey: (row) => row.id,
        rowSelection: "multiple",
        ...options,
    });
}

const keys = (model: { state: { selectedRowKeys: readonly RowKey[] } }) =>
    model.state.selectedRowKeys;

describe("selected rows", () => {
    it("start from the given keys, once each, and read through get and is", () => {
        const model = grid({ selectedRowKeys: ["p2", "p1", "p2", "gone"] });
        expect(model.get("selected-row-keys")).toEqual(["p2", "p1", "gone"]);
        expect(model.get("row-selection")).toBe("multiple");
        expect(model.is("row-selected", { rowIndex: 1 })).toBe(true);
        expect(model.is("row-selected", { rowIndex: 3 })).toBe(false);
        expect(model.is("row-selected", { rowIndex: 99 })).toBe(false);
    });

    it("set replaces the keys, keeps those of rows not loaded, and refuses what is not a key", () => {
        const model = grid();
        expect(
            model.run("selected-rows.set", { rowKeys: ["p3", "elsewhere"] }),
        ).toEqual({ ok: true, value: ["p3", "elsewhere"] });
        expect(model.is("row-selected", { rowIndex: 3 })).toBe(true);
        const bad = model.run("selected-rows.set", {
            rowKeys: [Number.NaN],
        });
        expect(bad.ok).toBe(false);
        expect(keys(model)).toEqual(["p3", "elsewhere"]);
    });

    it("toggle by index selects and clears, by key too, in the order selected", () => {
        const model = grid();
        model.run("selected-rows.toggle", { rowIndex: 5 });
        model.run("selected-rows.toggle", { rowIndex: 2 });
        expect(keys(model)).toEqual(["p5", "p2"]);
        model.run("selected-rows.toggle", { rowKey: "p5" });
        expect(keys(model)).toEqual(["p2"]);
        model.run("selected-rows.toggle", { rowKey: "later" });
        expect(keys(model)).toEqual(["p2", "later"]);
    });

    it("toggle by index makes the row the anchor; by key, there is none", () => {
        const model = grid();
        expect(model.run("selected-rows.toggle", { rowIndex: 2 })).toEqual({
            ok: true,
            value: {
                rowKeys: ["p2"],
                anchor: { rowKey: "p2", rowIndex: 2, selected: true },
            },
        });
        expect(model.state.selectionAnchor).toEqual({
            rowKey: "p2",
            rowIndex: 2,
            selected: true,
        });
        model.run("selected-rows.toggle", { rowKey: "p7" });
        expect(model.state.selectionAnchor).toBeNull();
        model.run("selected-rows.toggle", { rowIndex: 5 });
        model.run("selection-anchor.clear", {});
        expect(model.get("selection-anchor")).toBeNull();
    });

    it("extends from the anchor with its state: adding, then removing", () => {
        const model = grid();
        model.run("selected-rows.toggle", { rowIndex: 1 });
        model.run("selected-rows.toggle", { rowIndex: 3, extend: true });
        expect(keys(model)).toEqual(["p1", "p2", "p3"]);
        // the anchor stays: a range the other way from it
        model.run("selected-rows.toggle", { rowIndex: 0, extend: true });
        expect(keys(model)).toEqual(["p1", "p2", "p3", "p0"]);
        // cleared, the anchor's state clears the range
        model.run("selected-rows.toggle", { rowIndex: 2 });
        model.run("selected-rows.toggle", { rowIndex: 3, extend: true });
        expect(keys(model)).toEqual(["p1", "p0"]);
    });

    it("skips rows that cannot be selected in a range, and refuses to toggle them", () => {
        const model = grid({ isRowSelectable: (row) => !row.locked });
        expect(model.is("row-selectable", { rowIndex: 4 })).toBe(false);
        expect(model.is("row-selectable", { rowIndex: 3 })).toBe(true);
        expect(model.run("selected-rows.toggle", { rowIndex: 4 }).ok).toBe(
            false,
        );
        model.run("selected-rows.toggle", { rowIndex: 3 });
        model.run("selected-rows.toggle", { rowIndex: 6, extend: true });
        expect(keys(model)).toEqual(["p3", "p5", "p6"]);
    });

    it("toggles alone without an anchor, whatever row is active", () => {
        const model = grid({ activePosition: { rowIndex: 2, columnIndex: 0 } });
        model.run("selected-rows.toggle", { rowIndex: 4, extend: true });
        expect(keys(model)).toEqual(["p4"]);
        expect(model.get("selection-anchor")).toEqual({
            rowKey: "p4",
            rowIndex: 4,
            selected: true,
        });
    });

    it("changes nothing extending from the anchor to itself", () => {
        const model = grid();
        model.run("selected-rows.toggle", { rowIndex: 4 });
        model.run("selected-rows.toggle", { rowIndex: 4, extend: true });
        expect(keys(model)).toEqual(["p4"]);
    });

    it("sets the anchor without selecting, for a range from a row already selected", () => {
        const model = grid({ selectedRowKeys: ["p2"] });
        expect(model.get("selection-anchor")).toBeNull();
        expect(model.run("selection-anchor.set", { rowIndex: 2 })).toEqual({
            ok: true,
            value: { rowKey: "p2", rowIndex: 2, selected: true },
        });
        model.run("selected-rows.toggle", { rowIndex: 4, extend: true });
        expect(keys(model)).toEqual(["p2", "p3", "p4"]);
        // a range that clears
        model.run("selection-anchor.set", { rowIndex: 3, selected: false });
        model.run("selected-rows.toggle", { rowIndex: 4, extend: true });
        expect(keys(model)).toEqual(["p2"]);
        expect(model.run("selection-anchor.set", { rowIndex: 99 }).ok).toBe(
            false,
        );
    });

    it("clears a row that cannot be selected, never adds it by index", () => {
        const model = grid({
            selectedRowKeys: ["p4"],
            isRowSelectable: (row) => !row.locked,
        });
        expect(model.run("selected-rows.toggle", { rowIndex: 4 }).ok).toBe(
            true,
        );
        expect(keys(model)).toEqual([]);
        expect(model.run("selected-rows.toggle", { rowIndex: 4 }).ok).toBe(
            false,
        );
        // by key, the key is the app's: the row is not looked for
        model.run("selected-rows.toggle", { rowKey: "p4" });
        expect(keys(model)).toEqual(["p4"]);
    });

    it("drops an anchor whose row the keys changed by other means", () => {
        const model = grid();
        model.run("selected-rows.toggle", { rowIndex: 2 });
        // the header's "select all" cleared everything: no range starts from row 2
        model.run("selected-rows.set", { rowKeys: [] });
        expect(model.get("selection-anchor")).toBeNull();
        model.run("selected-rows.toggle", { rowIndex: 4 });
        // a set keeping the anchor's row as it was keeps the anchor
        model.run("selected-rows.set", { rowKeys: ["p4", "p9"] });
        expect(model.get("selection-anchor")?.rowKey).toBe("p4");
    });

    it("drops an anchor whose key moved: the rows were sorted", () => {
        const model = grid({ activePosition: null });
        model.run("selected-rows.toggle", { rowIndex: 1 });
        model.run("data.set", { rows: [...people].reverse() });
        // "p1" is at 8 now: no anchor, no active row, a plain toggle
        model.run("selected-rows.toggle", { rowIndex: 5, extend: true });
        expect(keys(model)).toEqual(["p1", "p4"]);
    });

    it("refuses a range reaching a row not loaded, changing nothing", () => {
        const model = grid({
            rows: undefined,
            rowCount: 10,
            getRow: (index) => (index === 3 ? undefined : people[index]),
        });
        model.run("selected-rows.toggle", { rowIndex: 1 });
        const result = model.run("selected-rows.toggle", {
            rowIndex: 5,
            extend: true,
        });
        expect(result).toMatchObject({
            ok: false,
            error: { code: "not_loaded" },
        });
        expect(keys(model)).toEqual(["p1"]);
        expect(
            model.run("selected-rows.toggle", { rowIndex: 3 }),
        ).toMatchObject({ ok: false, error: { code: "not_loaded" } });
    });

    it("selects every selectable row, keeping the keys already selected", () => {
        const model = grid({
            selectedRowKeys: ["other"],
            isRowSelectable: (row) => !row.locked,
        });
        model.run("selected-rows.select-all", {});
        expect(keys(model)).toEqual([
            "other",
            "p0",
            "p1",
            "p2",
            "p3",
            "p5",
            "p6",
            "p7",
            "p8",
            "p9",
        ]);
    });

    it("refuses to select all when a row is not loaded: its key is unknown", () => {
        const model = grid({
            rows: undefined,
            rowCount: 10,
            getRow: (index) => (index === 9 ? undefined : people[index]),
        });
        expect(model.run("selected-rows.select-all", {})).toMatchObject({
            ok: false,
            error: { code: "not_loaded" },
        });
        expect(keys(model)).toEqual([]);
    });

    it("keys rows by index without rowKey", () => {
        const model = grid({ rowKey: undefined });
        model.run("selected-rows.toggle", { rowIndex: 2 });
        expect(keys(model)).toEqual([2]);
        expect(model.is("row-selected", { rowIndex: 2 })).toBe(true);
    });
});

describe("single selection", () => {
    it("selecting a row replaces the other; set keeps the last key", () => {
        const model = grid({
            rowSelection: "single",
            selectedRowKeys: ["p1", "p2"],
        });
        expect(keys(model)).toEqual(["p2"]);
        model.run("selected-rows.toggle", { rowIndex: 5 });
        expect(keys(model)).toEqual(["p5"]);
        model.run("selected-rows.toggle", { rowIndex: 5 });
        expect(keys(model)).toEqual([]);
        model.run("selected-rows.set", { rowKeys: ["p1", "p3"] });
        expect(keys(model)).toEqual(["p3"]);
    });

    it("has no range, a Shift+click toggling, and no select-all", () => {
        const model = grid({ rowSelection: "single" });
        model.run("selected-rows.toggle", { rowIndex: 1 });
        model.run("selected-rows.toggle", { rowIndex: 3, extend: true });
        expect(keys(model)).toEqual(["p3"]);
        expect(model.run("selected-rows.select-all", {}).ok).toBe(false);
        expect(keys(model)).toEqual(["p3"]);
    });
});

describe("without selection", () => {
    it("refuses every selection command, and no row is selected or selectable", () => {
        const model = grid({
            rowSelection: undefined,
            selectedRowKeys: ["p1"],
        });
        expect(model.get("row-selection")).toBeUndefined();
        expect(model.is("row-selected", { rowIndex: 1 })).toBe(false);
        expect(model.is("row-selectable", { rowIndex: 1 })).toBe(false);
        for (const result of [
            model.run("selected-rows.set", { rowKeys: [] }),
            model.run("selection-anchor.set", { rowIndex: 1 }),
            model.run("selected-rows.toggle", { rowIndex: 1 }),
            model.run("selected-rows.select-all", {}),
        ]) {
            expect(result).toMatchObject({
                ok: false,
                error: { code: "refused" },
            });
        }
    });

    it("row-selection.set turns it on, changes the mode and the filter, and off", () => {
        const model = grid({ rowSelection: undefined });
        model.run("row-selection.set", { rowSelection: "multiple" });
        model.run("selected-rows.set", { rowKeys: ["p1", "p2"] });
        const locked = (row: Person) => !row.locked;
        model.run("row-selection.set", {
            rowSelection: "single",
            isRowSelectable: locked,
        });
        expect(keys(model)).toEqual(["p2"]);
        expect(model.state.isRowSelectable).toBe(locked);
        model.run("row-selection.set", { isRowSelectable: null });
        expect(model.state.isRowSelectable).toBeUndefined();
        expect(model.state.rowSelection).toBe("single");
        model.run("selected-rows.toggle", { rowIndex: 3 });
        model.run("row-selection.set", { rowSelection: null });
        expect(model.get("row-selection")).toBeUndefined();
        expect(model.state.selectionAnchor).toBeNull();
        expect(
            model.run("row-selection.set", {
                // @ts-expect-error: not a mode
                rowSelection: "many",
            }).ok,
        ).toBe(false);
    });
});

describe("middleware", () => {
    it("vetoes a selection command, or rewrites it", () => {
        const model = grid();
        const remove = model.use((ctx, next) =>
            ctx.command === "selected-rows.select-all"
                ? veto("the server selects all")
                : next(),
        );
        expect(model.run("selected-rows.select-all", {})).toMatchObject({
            ok: false,
            error: { code: "vetoed" },
        });
        remove();
        model.use((ctx, next) => {
            if (ctx.command === "selected-rows.toggle") {
                ctx.payload = { rowIndex: 0 };
            }
            return next();
        });
        model.run("selected-rows.toggle", { rowIndex: 7 });
        expect(keys(model)).toEqual(["p0"]);
    });

    it("tells listeners once per change, and not when nothing changed", () => {
        const model = grid({ selectedRowKeys: ["p1"] });
        const events: string[] = [];
        model.subscribe((event) => events.push(event.command));
        model.run("selected-rows.set", { rowKeys: ["p1"] });
        model.run("selected-rows.toggle", { rowIndex: 2 });
        expect(events).toEqual(["selected-rows.toggle"]);
    });
});
