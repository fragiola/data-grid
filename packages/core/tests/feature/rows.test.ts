// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
    type Column,
    type DataGridFeature,
    GROUP_TOGGLE_ATTRIBUTE,
    gridRole,
    ROW_DRAG_HANDLE_ATTRIBUTE,
    type RowMeta,
    rowPart,
} from "../../src";
import { navigation } from "../../src/navigation";
import { rowExpansion } from "../../src/row-expansion";
import { rowGrouping } from "../../src/row-grouping";
import { rowReorder } from "../../src/row-reorder";
import { cellSpans } from "../../src/spans";
import { summaryRows } from "../../src/summary-rows";
import {
    cellElement,
    click,
    keydown,
    mountEngine,
    pointer,
    type Row,
} from "../engine/harness";

// The row features (Epic #151): row expansion, row grouping, column spans, summary rows and row
// reorder are opt-in. Without them a grid keeps the row model (the data contract, `getRowMeta`
// included; the sizes and measured heights; the row axis and the windows) and none of their
// behaviour: no detail, no group toggling, spans ignored, no summary row, no row drag.

const COLUMNS: Column<Row>[] = [
    { key: "a", width: 100, colSpan: (args) => (args.type === "row" ? 2 : 1) },
    { key: "b", width: 100 },
    { key: "c", width: 100 },
];

/** Every row 0 and 1 a group's (0 at the top, expanded or not, 1 under it), the rest data rows. */
const getRowMeta = (index: number): RowMeta | undefined =>
    index === 0
        ? {
              group: {
                  key: "g",
                  columnKey: "a",
                  value: 1,
                  depth: 0,
                  childCount: 9,
                  aggregates: {},
              },
          }
        : { depth: 1, parentIndex: 0 };

/** The model's verbs, untyped: a key of a feature not installed. */
type Bare = {
    run: (command: string, payload?: unknown) => { ok: boolean };
    get: (key: string, payload?: unknown) => unknown;
    is: (key: string, payload: unknown) => boolean;
};

/** A grid of `COLUMNS` with navigation and the row features given, its body rendered. */
function grid(
    features: readonly DataGridFeature[] = [],
    options: { readonly getRowMeta?: typeof getRowMeta } = {},
) {
    return mountEngine(
        {
            columns: COLUMNS,
            rowCount: 10,
            rowKey: (row) => row.id,
            features: [navigation(), ...features],
            ...options,
        },
        { width: 300, layers: ["body"], reorderableRows: true },
    );
}

describe("a grid without the row features", () => {
    it("has none of their keys: each is not found", () => {
        const { model, engine } = grid();
        const bare = model as unknown as Bare;
        for (const [command, payload] of [
            ["expanded-rows.toggle", { rowIndex: 1 }],
            ["expanded-rows.set", { rowKeys: [1] }],
            ["row-groups.toggle", { groupKey: "g" }],
            ["row-groups.set", { groupKeys: ["g"] }],
            ["summary-rows.set", { top: 1 }],
            ["summary-rows.changed", {}],
        ] as const) {
            expect(bare.run(command, payload), command).toMatchObject({
                ok: false,
                error: { code: "not_found" },
            });
        }
        expect(bare.get("expanded-row-keys")).toBeUndefined();
        expect(bare.get("expanded-group-keys")).toBeUndefined();
        expect(bare.get("summary-rows")).toBeUndefined();
        expect(
            bare.get("cell-span-by", { rowIndex: 1, columnIndex: 1 }),
        ).toBeUndefined();
        expect(bare.is("row-expanded", { rowIndex: 1 })).toBe(false);
        expect(bare.is("row-group-expanded", { rowIndex: 0 })).toBe(false);
        expect(bare.is("row-movable", { rowIndex: 1 })).toBe(false);
        expect(engine.get("row-reorder")).toBeUndefined();
        // the row bands stay the core's: none
        expect(model.state.summaryRows).toEqual({ top: 0, bottom: 0 });
    });

    it("ignores a column's colSpan: every body cell is one column", () => {
        const { model, view } = grid();
        expect(view().rowSpans).toBeNull();
        // the active cell does not snap to a span's first column
        model.run("active-position.set", { rowIndex: 1, columnIndex: 1 });
        expect(model.state.activePosition).toEqual({
            rowIndex: 1,
            columnIndex: 1,
        });
    });

    it("lays no detail out, and expands no group", () => {
        const { model, engine, view, body } = grid([], { getRowMeta });
        expect(view().expandedRows).toEqual([]);
        expect(view().rowAxis.sizeOf(1)).toBe(20);
        // a group row is a row: no tree's ARIA, no treegrid, its toggle does nothing
        expect(gridRole(view())).toBe("grid");
        expect(rowPart(view(), 0, true).ariaTree).toBeUndefined();
        expect(rowPart(view(), 0, true).state.groupExpanded).toBeUndefined();
        const cell = cellElement(body, 0, 0);
        const toggle = document.createElement("button");
        toggle.setAttribute(GROUP_TOGGLE_ATTRIBUTE, "0");
        cell.append(toggle);
        expect(click(engine, toggle).handled).toBe(false);
        model.run("active-position.set", { rowIndex: 0, columnIndex: 0 });
        expect(keydown(engine, cell, " ").handled).toBe(false);
    });

    it("never drags a row by its handle, nor moves one by the keys", () => {
        const { model, engine, view, body } = grid();
        const moves: unknown[] = [];
        engine.subscribe("row-move", (move) => moves.push(move));
        const cell = cellElement(body, 2, 0);
        const handle = document.createElement("span");
        handle.setAttribute(ROW_DRAG_HANDLE_ATTRIBUTE, "2");
        cell.append(handle);
        pointer(engine, handle, "pointerdown", 10, { clientY: 50 });
        pointer(engine, handle, "pointermove", 10, { clientY: 150 });
        pointer(engine, handle, "pointerup", 10, { clientY: 150 });
        expect(view().heldRow).toBeNull();
        expect(rowPart(view(), 2, true).state.dragging).toBeUndefined();
        model.run("active-position.set", { rowIndex: 2, columnIndex: 0 });
        keydown(engine, cell, "ArrowDown", { ctrlKey: true, shiftKey: true });
        expect(moves).toEqual([]);
    });
});

describe("a grid with them", () => {
    it("spans, expands, groups and has summary rows", () => {
        const { model, view } = grid(
            [
                cellSpans(),
                rowExpansion(),
                rowGrouping(),
                summaryRows(),
                rowReorder(),
            ],
            { getRowMeta },
        );
        const typed = model as unknown as Bare;
        expect(
            typed.get("cell-span-by", { rowIndex: 1, columnIndex: 1 }),
        ).toEqual({ columnIndex: 0, columnSpan: 2 });
        expect(typed.run("expanded-rows.toggle", { rowIndex: 1 }).ok).toBe(
            true,
        );
        expect(view().expandedRows).toEqual([1]);
        expect(typed.run("row-groups.toggle", { rowIndex: 0 }).ok).toBe(true);
        expect(rowPart(view(), 0, true).state.groupExpanded).toBe(true);
        expect(gridRole(view())).toBe("treegrid");
        expect(typed.run("summary-rows.set", { top: 1 }).ok).toBe(true);
        expect(model.state.summaryRows).toEqual({ top: 1, bottom: 0 });
        // a grouped grid's rows never move
        expect(typed.is("row-movable", { rowIndex: 1 })).toBe(false);
    });
});
