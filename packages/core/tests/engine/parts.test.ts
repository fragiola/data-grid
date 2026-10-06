import { describe, expect, it } from "vitest";
import {
    type Column,
    cellBox,
    cellPart,
    type HeaderCellLayout,
    headerCellPart,
    rowDetailPart,
    rowPart,
} from "../../src";
import { COLUMNS, column, type Row, stateOf, viewOf } from "./views";

// A part's state as a pure function of the view (Q4), with what ARIA says of it beyond the state:
// what an adapter maps to attributes and style. The view renders the rows 10–20 and the columns
// 2–5.

const PINNED = [column("p0", true), column("p1", true), ...COLUMNS];

const sortable = (key: string): Column<Row> => ({
    key,
    width: 100,
    sortable: true,
});

/** The header cell a view renders for a column (or a group) key. */
function headerCell(
    view: ReturnType<typeof viewOf>,
    key: string,
): HeaderCellLayout<Row, unknown> {
    const cell = view.headerRows
        .flatMap((row) => row.cells)
        .find((entry) => entry.key === key);
    if (!cell) throw new Error(`no header cell ${key}`);
    return cell;
}

describe("rowPart", () => {
    it("is plain for a row with nothing on it, and has no aria-selected", () => {
        expect(rowPart(viewOf(), 12, true)).toEqual({
            state: {
                rowIndex: 12,
                loaded: true,
                active: false,
                expanded: false,
                selected: false,
            },
            ariaSelected: undefined,
        });
    });

    it("holds the active cell, its detail and its selection", () => {
        const view = viewOf(
            stateOf({
                rowKey: (row) => row.id,
                activePosition: { rowIndex: 12, columnIndex: 3 },
                expandedRowKeys: [12],
                rowSelection: "multiple",
                selectedRowKeys: [12],
            }),
        );
        expect(rowPart(view, 12, true).state).toEqual({
            rowIndex: 12,
            loaded: true,
            active: true,
            expanded: true,
            selected: true,
        });
        expect(rowPart(view, 13, false).state).toMatchObject({
            loaded: false,
            active: false,
            expanded: false,
            selected: false,
        });
    });

    it("aria-selected: true when selected, false when selectable, none when refused or not loaded", () => {
        const view = viewOf(
            stateOf({
                rows: undefined,
                rowCount: 100,
                getRow: (index) => (index < 50 ? { id: index } : undefined),
                rowKey: (row) => row.id,
                rowSelection: "single",
                selectedRowKeys: [12],
                isRowSelectable: (row) => row.id !== 14,
            }),
        );
        const aria = (rowIndex: number) =>
            rowPart(view, rowIndex, rowIndex < 50).ariaSelected;
        expect(aria(12)).toBe(true);
        expect(aria(13)).toBe(false);
        expect(aria(14)).toBeUndefined();
        expect(aria(60)).toBeUndefined();
    });
});

describe("cellPart", () => {
    it("is active, the tab stop and interacting at the view's positions only", () => {
        const view = viewOf(
            stateOf({ activePosition: { rowIndex: 12, columnIndex: 3 } }),
            { interaction: { rowIndex: 12, columnIndex: 3 } },
        );
        expect(
            cellPart(view, { rowIndex: 12, columnIndex: 3, loaded: true }),
        ).toEqual({
            state: {
                rowIndex: 12,
                columnIndex: 3,
                loaded: true,
                active: true,
                pinned: false,
                pinnedEdge: false,
                interacting: true,
                editing: false,
            },
            tabIndex: 0,
        });
        const beside = cellPart(view, {
            rowIndex: 12,
            columnIndex: 4,
            loaded: true,
        });
        expect(beside.state).toMatchObject({
            active: false,
            interacting: false,
        });
        expect(beside.tabIndex).toBe(-1);
        expect(
            cellPart(view, { rowIndex: 13, columnIndex: 3, loaded: false })
                .state,
        ).toMatchObject({ loaded: false, active: false, interacting: false });
    });

    it("is pinned in the pinned columns, at the edge in the last one", () => {
        const view = viewOf(stateOf({ columns: PINNED }), {
            pinnedColumnCount: 2,
            pinnedWidth: 200,
        });
        const at = (columnIndex: number) =>
            cellPart(view, { rowIndex: 12, columnIndex, loaded: true }).state;
        expect(at(0)).toMatchObject({ pinned: true, pinnedEdge: false });
        expect(at(1)).toMatchObject({ pinned: true, pinnedEdge: true });
        expect(at(2)).toMatchObject({ pinned: false, pinnedEdge: false });
    });
});

describe("cellBox", () => {
    it("is its column's place in the row, and the row's own height", () => {
        // the layers lay the columns out from the first rendered one (200px)
        expect(cellBox(viewOf(), 12, 3)).toEqual({
            left: 100,
            width: 100,
            height: 20,
        });
    });

    it("leaves an expanded row's detail out of its height", () => {
        const view = viewOf(
            stateOf({
                rowKey: (row) => row.id,
                expandedRowKeys: [12],
                detailHeight: 80,
            }),
        );
        expect(view.rowAxis.sizeOf(12)).toBe(100);
        expect(cellBox(view, 12, 3).height).toBe(20);
    });

    it("is at its column's offset in a pinned column", () => {
        const view = viewOf(stateOf({ columns: PINNED }), {
            pinnedColumnCount: 2,
            pinnedWidth: 200,
        });
        expect(cellBox(view, 12, 1)).toEqual({
            left: 100,
            width: 100,
            height: 20,
        });
    });
});

describe("headerCellPart", () => {
    it("tells a column's sort, and aria-sort on the first sorted column only", () => {
        const view = viewOf(
            stateOf({
                columns: COLUMNS.map((entry) => sortable(entry.key)),
                sortColumns: [
                    { columnKey: "c3", direction: "descending" },
                    { columnKey: "c2", direction: "ascending" },
                ],
            }),
        );
        const first = headerCellPart(view, headerCell(view, "c3"));
        const second = headerCellPart(view, headerCell(view, "c2"));
        expect(first).toEqual({
            state: {
                rowIndex: -1,
                columnIndex: 3,
                columnSpan: 1,
                rowSpan: 1,
                group: false,
                active: false,
                sortable: true,
                sortDirection: "descending",
                sortPriority: 1,
                pinned: false,
                pinnedEdge: false,
                interacting: false,
                resizable: false,
                resizing: false,
                reorderable: false,
                dragging: false,
                dropTarget: null,
            },
            tabIndex: -1,
            ariaSort: "descending",
        });
        expect(second.state).toMatchObject({
            sortDirection: "ascending",
            sortPriority: 2,
        });
        expect(second.ariaSort).toBeUndefined();
        expect(
            headerCellPart(view, headerCell(view, "c4")).state,
        ).toMatchObject({
            sortable: true,
            sortDirection: undefined,
            sortPriority: undefined,
        });
    });

    it("is active, and the tab stop, on any header row a column spans; a group's cell is a group", () => {
        const state = stateOf({
            columns: [
                {
                    key: "g",
                    children: [column("c0"), column("c1"), column("c2")],
                },
                column("c3"),
                column("c4"),
            ],
            activePosition: { rowIndex: -1, columnIndex: 3 },
        });
        const view = viewOf(state, {
            headerHeight: 60,
            columnWindow: {
                visible: { start: 0, end: 5 },
                rendered: { start: 0, end: 5 },
            },
        });
        // c3 spans both header rows: its cell is in the top one, active from the bottom one
        const spanning = headerCellPart(view, headerCell(view, "c3"));
        expect(spanning.state).toMatchObject({
            rowIndex: -2,
            rowSpan: 2,
            group: false,
            active: true,
        });
        expect(spanning.tabIndex).toBe(0);
        expect(headerCellPart(view, headerCell(view, "g")).state).toMatchObject(
            {
                rowIndex: -2,
                columnSpan: 3,
                group: true,
                active: false,
                sortable: false,
            },
        );
    });

    it("is interacting at the view's interaction, and pinned over pinned columns", () => {
        const view = viewOf(stateOf({ columns: PINNED }), {
            pinnedColumnCount: 2,
            pinnedWidth: 200,
            interaction: { rowIndex: -1, columnIndex: 1 },
        });
        expect(
            headerCellPart(view, headerCell(view, "p1")).state,
        ).toMatchObject({ pinned: true, pinnedEdge: true, interacting: true });
        expect(
            headerCellPart(view, headerCell(view, "p0")).state,
        ).toMatchObject({
            pinned: true,
            pinnedEdge: false,
            interacting: false,
        });
    });
});

describe("rowDetailPart", () => {
    it("is collapsed, 0 tall and without a box, while its row is not expanded", () => {
        expect(rowDetailPart(viewOf(), 12)).toEqual({
            state: { rowIndex: 12, expanded: false, height: 0 },
            box: null,
        });
    });

    it("is its detail's height, below the row's cells, while its row is expanded", () => {
        const view = viewOf(
            stateOf({
                rowKey: (row) => row.id,
                expandedRowKeys: [12],
                detailHeight: 80,
            }),
        );
        expect(rowDetailPart(view, 12)).toEqual({
            state: { rowIndex: 12, expanded: true, height: 80 },
            box: { top: 20, start: 0, width: 300, height: 80 },
        });
    });
});
