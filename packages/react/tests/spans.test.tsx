import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type CellInfo, type Column, DataGrid } from "../src";
import { cellAt, headerAt, stubViewportSize, tags } from "./helpers";

// Column spans (Epic #85, E1.2): `Cells` hands one cell per rendered column, a spanning cell
// standing for the ones it covers; the spanning cell is as wide as its columns, with
// `aria-colspan`, and `colSpan` as a table cell; a header cell spanning columns the same.

interface Row {
    id: number;
}

const rows: Row[] = Array.from({ length: 20 }, (_, id) => ({ id }));

/** "a" spans "b" and "c" on even rows; "d"'s header cell spans "e" */
const columns: Column<Row>[] = [
    {
        key: "a",
        name: "A",
        width: 100,
        colSpan: (args) =>
            args.type === "row" && args.row.id % 2 === 0 ? 3 : undefined,
    },
    { key: "b", name: "B", width: 100 },
    { key: "c", name: "C", width: 100 },
    {
        key: "d",
        name: "D",
        width: 100,
        colSpan: ({ type }) => (type === "header" ? 2 : undefined),
    },
    { key: "e", name: "E", width: 100 },
];

stubViewportSize(800, 235);

function Grid({
    table = false,
    seen,
}: {
    table?: boolean;
    seen?: (cell: CellInfo<Row>) => void;
}) {
    const tag = tags(table);
    return (
        <DataGrid.Root columns={columns} rows={rows} rowHeight={20}>
            <DataGrid.Grid render={tag.grid}>
                <DataGrid.Header render={tag.header}>
                    <DataGrid.HeaderRow render={tag.headerRow}>
                        <DataGrid.HeaderCells<Row>>
                            {(cell) => (
                                <DataGrid.HeaderCell
                                    cell={cell}
                                    render={tag.headerCell}
                                />
                            )}
                        </DataGrid.HeaderCells>
                    </DataGrid.HeaderRow>
                </DataGrid.Header>
                <DataGrid.Body render={tag.body}>
                    <DataGrid.Rows<Row>>
                        {(row) => (
                            <DataGrid.Row row={row} render={tag.row}>
                                <DataGrid.Cells<Row>>
                                    {(cell) => {
                                        seen?.(cell);
                                        return (
                                            <DataGrid.Cell
                                                cell={cell}
                                                render={tag.cell}
                                            />
                                        );
                                    }}
                                </DataGrid.Cells>
                            </DataGrid.Row>
                        )}
                    </DataGrid.Rows>
                </DataGrid.Body>
            </DataGrid.Grid>
        </DataGrid.Root>
    );
}

const cellsOf = (container: ParentNode, rowIndex: number) =>
    [
        ...container.querySelectorAll(
            `[data-grid-part="cell"][data-row-index="${rowIndex}"]`,
        ),
    ].map((cell) => cell.getAttribute("data-column-index"));

describe("column spans", () => {
    for (const table of [false, true]) {
        it(`render a spanning cell as wide as its columns, the covered ones left out${table ? ", as table cells" : ""}`, () => {
            const { container } = render(<Grid table={table} />);
            expect(cellsOf(container, 0)).toEqual(["0", "3", "4"]);
            expect(cellsOf(container, 1)).toEqual(["0", "1", "2", "3", "4"]);
            const span = cellAt(container, 0, 0);
            expect(span).toHaveAttribute("aria-colspan", "3");
            expect(span.style.width).toBe("300px");
            expect(cellAt(container, 0, 3).style.left).toBe("300px");
            expect(cellAt(container, 1, 0)).not.toHaveAttribute("aria-colspan");
            const header = headerAt(container, 3);
            expect(header).toHaveAttribute("aria-colspan", "2");
            expect(header.style.width).toBe("200px");
            expect(
                container.querySelector(
                    '[data-grid-part="header-cell"][data-column-index="4"]',
                ),
            ).toBeNull();
            if (table) {
                expect(span.tagName).toBe("TD");
                expect(span).toHaveAttribute("colspan", "3");
                expect(header).toHaveAttribute("colspan", "2");
                expect(cellAt(container, 1, 0)).not.toHaveAttribute("colspan");
            }
        });
    }

    it("hand the children one cell per rendered column, a span for the ones it covers", () => {
        const seen: string[] = [];
        render(
            <Grid
                seen={(cell) => {
                    if (cell.rowIndex === 2) seen.push(cell.column.key);
                }}
            />,
        );
        expect([...new Set(seen)]).toEqual(["a", "d", "e"]);
    });
});
