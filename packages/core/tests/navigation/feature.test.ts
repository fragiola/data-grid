// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
    type Column,
    cellPartOf,
    createDataGridModel,
    type GridCellInfo,
    type GridView,
    gridPartOf,
    headerCellPartOf,
} from "../../src";
import { clipboard } from "../../src/clipboard";
import { fillHandle } from "../../src/fill";
import { navigation } from "../../src/navigation";
import { cellRange } from "../../src/range";
import { rowSelection } from "../../src/row-selection";
import { cellElement, click, keydown, mountEngine } from "../engine/harness";

// Navigation, row selection, cell ranges, the clipboard and the fill handle are features (Epic
// #144): their requirements are checked at creation, and a grid without navigation is a table
// (APG): no active cell, no tab stop on the grid nor on its cells, arrows not the grid's.

interface Row {
    id: number;
}

const columns: Column<Row>[] = [
    { key: "a", width: 100 },
    { key: "b", width: 100 },
];
const rows: Row[] = Array.from({ length: 5 }, (_, id) => ({ id }));

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
        value: undefined,
        group: undefined,
        meta: undefined,
    };
}

describe("the features' requirements", () => {
    it("fail at creation for cell ranges without navigation", () => {
        expect(() => createDataGridModel({ features: [cellRange()] })).toThrow(
            'feature "cellRange" requires feature "navigation": install it too',
        );
        expect(() =>
            createDataGridModel({ features: [navigation(), cellRange()] }),
        ).not.toThrow();
    });

    it("fail at creation for the clipboard or the fill handle without cell ranges", () => {
        expect(() =>
            createDataGridModel({ features: [navigation(), clipboard()] }),
        ).toThrow(
            'feature "clipboard" requires feature "cellRange": install it too',
        );
        expect(() =>
            createDataGridModel({ features: [navigation(), fillHandle()] }),
        ).toThrow(
            'feature "fillHandle" requires feature "cellRange": install it too',
        );
        expect(() =>
            createDataGridModel({
                features: [
                    navigation(),
                    cellRange(),
                    clipboard(),
                    fillHandle(),
                ],
            }),
        ).not.toThrow();
    });

    it("leave row selection on its own", () => {
        expect(() =>
            createDataGridModel({ features: [rowSelection()] }),
        ).not.toThrow();
    });
});

describe("a grid without navigation", () => {
    it("runs the active position's commands as not found, its position kept null", () => {
        const model = createDataGridModel({ columns, rows });
        const state = model.state;
        // its types name no such command: run as a caller unaware of the grid's features would
        const run = model.run as (command: string, payload: unknown) => unknown;
        expect(
            run("active-position.set", { rowIndex: 0, columnIndex: 0 }),
        ).toMatchObject({
            ok: false,
            error: {
                code: "not_found",
                message: expect.stringContaining("active-position.set"),
            },
        });
        const get = model.get as (key: string) => unknown;
        const is = model.is as (key: string, payload: unknown) => boolean;
        expect(get("active-position")).toBeUndefined();
        expect(is("cell-active", { rowIndex: 0, columnIndex: 0 })).toBe(false);
        expect(model.state).toBe(state);
        expect(model.state.activePosition).toBeNull();
    });

    it("handles no arrow key and activates no cell, by key or by click", () => {
        const { engine, grid, model, view } = mountEngine({
            columns,
            rowCount: 10,
            features: [],
        });
        const cell = cellElement(grid, 2, 1);
        for (const key of ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"]) {
            const { handled, event } = keydown(engine, cell, key);
            expect(handled).toBe(false);
            expect(event.defaultPrevented).toBe(false);
        }
        click(engine, cell);
        expect(model.state.activePosition).toBeNull();
        expect(view().active).toBeNull();
    });

    it("is a table: no tab stop on the grid nor on its cells", () => {
        const { view } = mountEngine({ columns, rowCount: 10, features: [] });
        const grid = gridPartOf(view());
        expect(grid.props.role).toBe("table");
        expect("tabIndex" in grid.props).toBe(false);
        const cell = cellPartOf(view(), cellInfo(view(), 2, 1));
        expect(cell.props.role).toBe("cell");
        expect("tabIndex" in cell.props).toBe(false);
        expect(cell.state.active).toBe(false);
        const header = view().header.cellByKey("a");
        if (!header) throw new Error("no header cell a");
        // header cells are column headers either way, no tab stop either
        const headerProps = headerCellPartOf(view(), header).props;
        expect(headerProps.role).toBe("columnheader");
        expect("tabIndex" in headerProps).toBe(false);
    });
});

describe("a grid with navigation", () => {
    it("is a grid: the grid a tab stop, its cells roving", () => {
        const { view, model } = mountEngine({
            columns,
            rowCount: 10,
            features: [navigation()],
        });
        const grid = gridPartOf(view());
        expect(grid.props.role).toBe("grid");
        expect(grid.props.tabIndex).toBe(0);
        const cell = cellPartOf(view(), cellInfo(view(), 2, 1));
        expect(cell.props.role).toBe("gridcell");
        expect(cell.props.tabIndex).toBe(-1);
        model.run("active-position.set", { rowIndex: 2, columnIndex: 1 });
        expect(gridPartOf(view()).props.tabIndex).toBe(-1);
        expect(cellPartOf(view(), cellInfo(view(), 2, 1)).props.tabIndex).toBe(
            0,
        );
    });

    it("moves the active cell with the arrows", () => {
        const { engine, grid, model } = mountEngine({
            columns,
            rowCount: 10,
            features: [navigation()],
        });
        model.run("active-position.set", { rowIndex: 2, columnIndex: 1 });
        const cell = cellElement(grid, 2, 1);
        expect(keydown(engine, cell, "ArrowDown").handled).toBe(true);
        expect(model.get("active-position")).toEqual({
            rowIndex: 3,
            columnIndex: 1,
        });
    });
});
