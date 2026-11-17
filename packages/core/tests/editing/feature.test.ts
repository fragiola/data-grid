// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    type Column,
    cellPartOf,
    createDataGridModel,
    type GridCellInfo,
    type GridView,
} from "../../src";
import { editing } from "../../src/editing";
import { navigation } from "../../src/navigation";
import {
    cellElement,
    click,
    keydown,
    mountEngine,
    type Row,
    stubAnimationFrames,
} from "../engine/harness";

// Cell editing is a feature (Epic #146), requiring navigation: without it, no key nor click
// starts an edit, its commands are not found, its engine actions do nothing and no cell part is
// ever `editing`.

beforeEach(() => {
    stubAnimationFrames();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

const COLUMNS: Column<Row>[] = [
    { key: "id", width: 100 },
    { key: "name", width: 100, editable: true, getValue: (row) => row.id },
];

const at = (rowIndex: number, columnIndex: number) => ({
    rowIndex,
    columnIndex,
});

/** A body cell as an adapter hands it to `cellPartOf`, its row loaded. */
function cellInfo(
    view: GridView<Row>,
    rowIndex: number,
    columnIndex: number,
): GridCellInfo<Row> {
    const column = view.columnDefs[columnIndex];
    if (!column) throw new Error(`no column ${columnIndex}`);
    return {
        rowIndex,
        columnIndex,
        column,
        row: { id: rowIndex },
        loaded: true,
        value: rowIndex,
        group: undefined,
        meta: undefined,
    };
}

describe("editing's requirement", () => {
    it("fails at creation without navigation, naming it", () => {
        expect(() => createDataGridModel({ features: [editing()] })).toThrow(
            'feature "editing" requires feature "navigation": install it too',
        );
        expect(() =>
            createDataGridModel({ features: [editing(), navigation()] }),
        ).not.toThrow();
    });
});

describe("a grid without editing", () => {
    it("runs the edit's commands as not found and reads none of its keys", () => {
        const model = createDataGridModel({
            columns: COLUMNS,
            rows: [{ id: 0 }],
            features: [navigation()],
        });
        // its types name no such command: run as a caller unaware of the grid's features would
        const run = model.run as (command: string, payload: unknown) => unknown;
        expect(run("editing-cell.set", at(0, 1))).toMatchObject({
            ok: false,
            error: { code: "not_found" },
        });
        expect(run("editing-cell.clear", {})).toMatchObject({
            ok: false,
            error: { code: "not_found" },
        });
        const get = model.get as (key: string) => unknown;
        const is = model.is as (key: string, payload: unknown) => boolean;
        expect(get("editing-cell")).toBeUndefined();
        expect(is("cell-editable", at(0, 1))).toBe(false);
        expect("editingCell" in model.state).toBe(false);
    });

    it("never starts an edit: Enter, F2, typing, a double click and `edit-cell` edit nothing", () => {
        const { engine, grid, model, view } = mountEngine({
            columns: COLUMNS,
            rowCount: 10,
            features: [navigation()],
            activePosition: at(1, 1),
        });
        const drafts: unknown[] = [];
        engine.subscribe("edit-draft", (draft) => drafts.push(draft));
        const cell = cellElement(grid, 1, 1);
        for (const key of ["Enter", "F2", "a"]) {
            const { handled, event } = keydown(engine, cell, key);
            expect(handled).toBe(false);
            expect(event.defaultPrevented).toBe(false);
        }
        expect(click(engine, cell, { detail: 2 }).handled).toBe(false);
        engine.run("edit-cell", at(1, 1));
        engine.run("commit-edit", { value: 1 });
        engine.run("cancel-edit", {});
        expect(drafts).toEqual([]);
        expect(engine.get("edit-draft")).toBeUndefined();
        expect(model.state.activePosition).toEqual(at(1, 1));
        // no cell part is ever `editing`, nor marked so
        const part = cellPartOf(view(), cellInfo(view(), 1, 1));
        expect(part.state.editing).toBeUndefined();
        expect("data-editing" in part.props).toBe(false);
    });
});

describe("a grid with editing", () => {
    it("edits an editable cell: the part is `editing`, the draft the cell's value", () => {
        const { engine, grid, model, view } = mountEngine({
            columns: COLUMNS,
            rowCount: 10,
            features: [navigation(), editing()],
            activePosition: at(1, 1),
        });
        const cell = cellElement(grid, 1, 1);
        expect(keydown(engine, cell, "Enter").handled).toBe(true);
        expect(model.get("editing-cell")).toEqual(at(1, 1));
        expect(engine.get("edit-draft")).toMatchObject({ value: 1 });
        const part = cellPartOf(view(), cellInfo(view(), 1, 1));
        expect(part.state.editing).toBe(true);
        expect(part.props["data-editing"]).toBe("");
        expect(cellPartOf(view(), cellInfo(view(), 2, 1)).state.editing).toBe(
            false,
        );
    });
});
