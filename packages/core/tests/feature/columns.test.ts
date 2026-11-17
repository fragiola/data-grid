// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
    COLUMN_RESIZER_ATTRIBUTE,
    type ColumnOrGroup,
    headerCellPart,
} from "../../src";
import { columnGroupCollapse } from "../../src/column-group-collapse";
import { columnPinning } from "../../src/column-pinning";
import { columnReorder } from "../../src/column-reorder";
import { columnResize } from "../../src/column-resize";
import { navigation } from "../../src/navigation";
import {
    cellElement,
    keydown,
    mountEngine,
    pointer,
    type Row,
} from "../engine/harness";

// The column features (Epic #148): resizing, reordering, pinning and collapsible groups are
// opt-in. Without them a grid keeps the column model (columns and groups as declared, their
// widths as given, `flex` and `autoSize`) and the layers, and none of their behaviour: no resize,
// no column drag, `pinned` ignored (every column scrolls), a collapsible group expanded.

const COLUMNS: ColumnOrGroup<Row>[] = [
    {
        key: "a",
        width: 100,
        pinned: "start",
        resizable: true,
        reorderable: true,
    },
    { key: "b", width: 100, resizable: true, reorderable: true },
    {
        key: "g",
        collapsible: true,
        children: [
            { key: "c", width: 100 },
            { key: "d", width: 100, groupShow: "expanded" },
            { key: "e", width: 100, groupShow: "collapsed" },
        ],
    },
    { key: "z", width: 100, pinned: "end" },
];

/** A grid of `COLUMNS` with navigation and the column features given, its header cells rendered. */
function grid(features: readonly ReturnType<typeof columnPinning>[] = []) {
    const mounted = mountEngine(
        {
            columns: COLUMNS,
            rowCount: 10,
            features: [navigation(), ...features],
        },
        { width: 300, layers: ["header"] },
    );
    const headerCell = (key: string) => {
        const cell = mounted.model.state.header.cellByKey(key);
        if (!cell) throw new Error(`no header cell ${key}`);
        return cell;
    };
    const headerElement = (key: string) => {
        const cell = headerCell(key);
        return cellElement(mounted.header, cell.rowIndex, cell.columnIndex);
    };
    return { ...mounted, headerCell, headerElement };
}

describe("a grid without the column features", () => {
    it("lays its columns out as declared: pinned ones scroll, a collapsible group expanded", () => {
        const { model, view } = grid();
        expect(model.state.columns.map((column) => column.key)).toEqual([
            "a",
            "b",
            "c",
            "d",
            "z",
        ]);
        expect(view().pinnedColumnCount).toBe(0);
        expect(view().pinnedEndColumnCount).toBe(0);
        expect(view().pinnedWidth).toBe(0);
    });

    it("has none of their keys: each is not found", () => {
        const { model, engine } = grid();
        const bare = model as unknown as {
            run: (command: string, payload?: unknown) => { ok: boolean };
            get: (key: string) => unknown;
            is: (key: string, payload: unknown) => boolean;
        };
        for (const [command, payload] of [
            ["column-widths.resize", { columnKey: "a", width: 200 }],
            [
                "column-order.move",
                { columnKey: "b", targetKey: "g", side: "after" },
            ],
            ["column-groups.toggle", { groupKey: "g" }],
        ] as const) {
            expect(bare.run(command, payload), command).toMatchObject({
                ok: false,
                error: { code: "not_found" },
            });
        }
        expect(bare.get("column-widths")).toBeUndefined();
        expect(bare.get("column-order")).toBeUndefined();
        expect(bare.get("pinned-column-keys")).toBeUndefined();
        expect(bare.is("group-collapsed", { groupKey: "g" })).toBe(false);
        expect(engine.get("column-resize")).toBeUndefined();
        expect(engine.get("column-reorder")).toBeUndefined();
    });

    it("never resizes from a resizer nor drags a header cell", () => {
        const { model, engine, view, headerElement, headerCell } = grid();
        const resizer = document.createElement("span");
        resizer.setAttribute(COLUMN_RESIZER_ATTRIBUTE, "b");
        headerElement("b").append(resizer);
        const press = pointer(engine, resizer, "pointerdown", 200);
        expect(press.defaultPrevented).toBe(false);
        pointer(engine, resizer, "pointermove", 260);
        pointer(engine, resizer, "pointerup", 260);
        expect(view().columnAxis.sizeOf(1)).toBe(100);
        // a header cell's drag moves nothing
        const b = headerElement("b");
        pointer(engine, b, "pointerdown", 150);
        pointer(engine, b, "pointermove", 280);
        pointer(engine, b, "pointerup", 280);
        expect(model.state.columns.map((column) => column.key)).toEqual([
            "a",
            "b",
            "c",
            "d",
            "z",
        ]);
        // nor do the keys
        model.run("active-position.set", headerCell("b"));
        keydown(engine, b, "ArrowRight", { ctrlKey: true, shiftKey: true });
        expect(model.state.columns[1]?.key).toBe("b");
        const state = headerCellPart(view(), headerCell("g")).state;
        expect(state.resizable).toBeUndefined();
        expect(state.reorderable).toBeUndefined();
        expect(state.collapsed).toBeUndefined();
        expect(headerCellPart(view(), headerCell("a")).state.pinned).toBe(
            false,
        );
    });
});

describe("a grid with them", () => {
    it("pins, collapses, resizes and reorders", () => {
        const { model, view, headerCell } = grid([
            columnResize(),
            columnReorder(),
            columnPinning(),
            columnGroupCollapse(),
        ] as unknown as readonly ReturnType<typeof columnPinning>[]);
        const run = model.run as unknown as (
            command: string,
            payload?: unknown,
        ) => { ok: boolean };
        expect(view().pinnedColumnCount).toBe(1);
        expect(view().pinnedEndColumnCount).toBe(1);
        expect(headerCellPart(view(), headerCell("g")).state.collapsed).toBe(
            false,
        );
        expect(run("column-groups.toggle", { groupKey: "g" }).ok).toBe(true);
        expect(model.state.columns.map((column) => column.key)).toEqual([
            "a",
            "b",
            "c",
            "e",
            "z",
        ]);
        expect(
            run("column-widths.resize", { columnKey: "b", width: 150 }).ok,
        ).toBe(true);
        expect(view().columnAxis.sizeOf(1)).toBe(150);
        expect(
            run("column-order.move", {
                columnKey: "b",
                targetKey: "g",
                side: "after",
            }).ok,
        ).toBe(true);
        expect(model.state.columns.map((column) => column.key)).toEqual([
            "a",
            "c",
            "e",
            "b",
            "z",
        ]);
    });
});
