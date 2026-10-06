import { describe, expect, it } from "vitest";
import {
    type Column,
    createDataGridModel,
    type DataGridModelOptions,
} from "../../src";

// Cell editing (Epic #88, E4.3): the model keeps which cell is edited, the active one of a loaded
// data row whose column is editable for it; it refuses any other, and drops the edit when the
// active cell moves off it or the cell can no longer be edited.

interface Row {
    id: number;
    locked?: boolean;
}

const COLUMNS: Column<Row>[] = [
    { key: "id", width: 100 },
    { key: "name", width: 100, editable: true },
    {
        key: "note",
        width: 100,
        editable: (row, rowIndex) => !row.locked && rowIndex < 8,
    },
];

const rows: Row[] = Array.from({ length: 10 }, (_, id) => ({
    id,
    locked: id === 3,
}));

const at = (rowIndex: number, columnIndex: number) => ({
    rowIndex,
    columnIndex,
});

function grid(options: DataGridModelOptions<Row> = {}) {
    return createDataGridModel<Row>({
        columns: COLUMNS,
        rows,
        ...options,
    });
}

const code = (result: { ok: boolean; error?: { code: string } }) =>
    result.ok ? "ok" : result.error?.code;

describe("the edited cell", () => {
    it("is the active cell of an editable column, with the key that started it", () => {
        const model = grid({ activePosition: at(2, 1) });
        expect(model.is("cell-editable", at(2, 1))).toBe(true);
        expect(
            model.run("editing-cell.set", { ...at(2, 1), startKey: "a" }),
        ).toEqual({ ok: true, value: { ...at(2, 1), startKey: "a" } });
        expect(model.get("editing-cell")).toEqual({
            ...at(2, 1),
            startKey: "a",
        });
        model.run("editing-cell.clear", {});
        expect(model.get("editing-cell")).toBeNull();
    });

    it("refuses any other cell: not active, not editable, a header, past the grid, not a key", () => {
        const model = grid({ activePosition: at(3, 2) });
        expect(code(model.run("editing-cell.set", at(2, 1)))).toBe("refused");
        // the function refuses row 3 (locked) and rows from 8
        expect(model.is("cell-editable", at(3, 2))).toBe(false);
        expect(code(model.run("editing-cell.set", at(3, 2)))).toBe("refused");
        expect(model.is("cell-editable", at(8, 2))).toBe(false);
        expect(model.is("cell-editable", at(2, 0))).toBe(false);
        model.run("active-position.set", at(-1, 1));
        expect(code(model.run("editing-cell.set", at(-1, 1)))).toBe("refused");
        expect(code(model.run("editing-cell.set", at(20, 1)))).toBe("refused");
        expect(code(model.run("editing-cell.set", at(1, 9)))).toBe("not_found");
        expect(
            code(
                model.run("editing-cell.set", {
                    ...at(1, 1),
                    startKey: 5 as unknown as string,
                }),
            ),
        ).toBe("invalid_payload");
        expect(model.get("editing-cell")).toBeNull();
    });

    it("refuses a group row, a summary row and a row not loaded", () => {
        const grouped = grid({
            rowCount: 3,
            getRow: (index) => (index === 2 ? undefined : { id: index }),
            rows: undefined,
            getRowMeta: (index) =>
                index === 0
                    ? {
                          group: {
                              key: "g",
                              columnKey: "name",
                              value: "G",
                              depth: 0,
                              childCount: 1,
                              aggregates: {},
                          },
                      }
                    : undefined,
            summaryRows: { bottom: 1 },
            activePosition: at(0, 1),
        });
        expect(code(grouped.run("editing-cell.set", at(0, 1)))).toBe("refused");
        grouped.run("active-position.set", at(2, 1));
        expect(code(grouped.run("editing-cell.set", at(2, 1)))).toBe(
            "not_loaded",
        );
        grouped.run("active-position.set", at(3, 1));
        expect(grouped.state.activePosition).toEqual(at(3, 1));
        expect(code(grouped.run("editing-cell.set", at(3, 1)))).toBe("refused");
        grouped.run("active-position.set", at(1, 1));
        expect(code(grouped.run("editing-cell.set", at(1, 1)))).toBe("ok");
    });

    it("goes when another row or column comes under it: its keys are not the ones it started on", () => {
        const keyed = grid({
            rowKey: (row) => `r${row.id}`,
            activePosition: at(2, 1),
        });
        keyed.run("editing-cell.set", at(2, 1));
        expect(keyed.state.editingKeys).toEqual({
            rowKey: "r2",
            columnKey: "name",
        });
        // the same rows in a new array: kept
        keyed.run("data.set", {
            rows: [...rows],
            rowKey: (row) => `r${row.id}`,
        });
        expect(keyed.state.editingCell).toEqual(at(2, 1));
        // another row at its index (rows sorted, one inserted above): ended
        keyed.run("data.set", {
            rows: [{ id: 99 }, ...rows],
            rowKey: (row) => `r${row.id}`,
        });
        expect(keyed.state.editingCell).toBeNull();
        expect(keyed.state.editingKeys).toBeNull();
        // another column at its index
        keyed.run("editing-cell.set", at(2, 1));
        keyed.run("columns.set", {
            columns: [
                COLUMNS[0] as Column<Row>,
                { key: "other", width: 100, editable: true },
                ...COLUMNS.slice(1),
            ],
        });
        expect(keyed.state.editingCell).toBeNull();
    });

    it("asks the app's rules again only when the rows, the columns, the active cell or the edit change", () => {
        let asked = 0;
        const columns: Column<Row>[] = [
            { key: "id", width: 100 },
            {
                key: "note",
                width: 100,
                editable: () => {
                    asked += 1;
                    return true;
                },
            },
        ];
        const model = grid({ columns, activePosition: at(2, 1) });
        model.run("editing-cell.set", at(2, 1));
        asked = 0;
        // commands that change none of it (rows told changed away from its row): no rule asked
        model.run("sort-columns.set", { sortColumns: [] });
        model.run("column-widths.set", { columnWidths: { id: 120 } });
        model.run("rows.changed", { start: 4, end: 8 });
        expect(asked).toBe(0);
        model.run("rows.changed", { start: 0, end: 4 });
        expect(asked).toBeGreaterThan(0);
        asked = 0;
        model.run("data.set", { rows: [...rows] });
        expect(asked).toBeGreaterThan(0);
        expect(model.get("editing-cell")).toEqual(at(2, 1));
    });

    it("goes when the active cell moves, or the cell can no longer be edited", () => {
        const model = grid({ activePosition: at(1, 1) });
        model.run("editing-cell.set", at(1, 1));
        model.run("sort-columns.set", { sortColumns: [] });
        expect(model.state.editingCell).toEqual(at(1, 1));
        model.run("active-position.move", { direction: "down" });
        expect(model.state.editingCell).toBeNull();
        model.run("editing-cell.set", at(2, 1));
        model.run("columns.set", {
            columns: [COLUMNS[0] as Column<Row>, { key: "name", width: 100 }],
        });
        expect(model.state.editingCell).toBeNull();
        const loading = grid({
            rows: undefined,
            rowCount: 5,
            getRow: (id) => ({ id }),
            activePosition: at(1, 1),
            editingCell: at(1, 1),
        });
        expect(loading.state.editingCell).toEqual(at(1, 1));
        loading.run("data.set", { rowCount: 5, getRow: () => undefined });
        expect(loading.state.editingCell).toBeNull();
        // given to start with, only for the active cell
        expect(
            grid({ activePosition: at(0, 1), editingCell: at(1, 1) }).state
                .editingCell,
        ).toBeNull();
    });
});
