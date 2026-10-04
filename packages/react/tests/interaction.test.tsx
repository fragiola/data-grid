import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type Column, DataGrid, type HeaderCellState } from "../src";
import { cellAt, settled, stubViewportSize, tags } from "./helpers";

// Interactive cells (Epic #52, I5): the cell whose controls have the keys carries
// `data-interacting`, its hooks report `interacting`, and the cells' controls stay out of the tab
// order outside it, as divs or as a table.

interface Task {
    id: number;
    title: string;
}

const tasks: Task[] = Array.from({ length: 20 }, (_, id) => ({
    id,
    title: `Task ${id}`,
}));

const columns: Column<Task>[] = [
    { key: "title", name: "Title", width: 160 },
    {
        key: "actions",
        name: "Actions",
        width: 160,
        renderCell: ({ row }) => (
            <>
                <button type="button">Edit {row.id}</button>
                <a href={`#task-${row.id}`}>Open {row.id}</a>
            </>
        ),
    },
];

stubViewportSize(400, 300);

let headerStates: HeaderCellState[] = [];

function Grid({
    table = false,
    cells = columns,
}: {
    table?: boolean;
    cells?: Column<Task>[];
}) {
    const tag = tags(table);
    return (
        <DataGrid.Root columns={cells} rows={tasks} rowHeight={24}>
            <DataGrid.Grid render={tag.grid}>
                <DataGrid.Header render={tag.header}>
                    <DataGrid.HeaderRow render={tag.headerRow}>
                        <DataGrid.HeaderCells<Task>>
                            {(cell) => (
                                <DataGrid.HeaderCell
                                    cell={cell}
                                    render={tag.headerCell}
                                    className={(state) => {
                                        headerStates.push(state);
                                        return undefined;
                                    }}
                                />
                            )}
                        </DataGrid.HeaderCells>
                    </DataGrid.HeaderRow>
                </DataGrid.Header>
                <DataGrid.Body render={tag.body}>
                    <DataGrid.Rows<Task>>
                        {(row) => (
                            <DataGrid.Row row={row} render={tag.row}>
                                <DataGrid.Cells<Task>>
                                    {(cell) => (
                                        <DataGrid.Cell
                                            cell={cell}
                                            render={tag.cell}
                                            className={(state) =>
                                                state.interacting
                                                    ? "interacting"
                                                    : undefined
                                            }
                                        />
                                    )}
                                </DataGrid.Cells>
                            </DataGrid.Row>
                        )}
                    </DataGrid.Rows>
                </DataGrid.Body>
            </DataGrid.Grid>
        </DataGrid.Root>
    );
}

for (const table of [false, true]) {
    describe(`interactive cells, as ${table ? "a table" : "divs"}`, () => {
        it("keeps the cells' controls out of the tab order", async () => {
            const { container } = render(<Grid table={table} />);
            await settled();
            const controls = container.querySelectorAll(
                '[data-grid-part="cell"] button, [data-grid-part="cell"] a',
            );
            expect(controls.length).toBeGreaterThan(0);
            for (const control of controls) {
                expect(control.getAttribute("tabindex")).toBe("-1");
            }
        });

        it("marks the cell whose controls have the keys, and its state", async () => {
            const { container } = render(<Grid table={table} />);
            await settled();
            const actions = cellAt(container, 2, 1);
            act(() => actions.focus());
            fireEvent.keyDown(actions, { key: "Enter" });
            const cell = cellAt(container, 2, 1);
            expect(cell).toHaveAttribute("data-interacting", "");
            expect(cell).toHaveClass("interacting");
            const edit = cell.querySelector("button");
            expect(document.activeElement).toBe(edit);
            expect(edit?.hasAttribute("tabindex")).toBe(false);
            fireEvent.keyDown(edit as HTMLElement, { key: "Escape" });
            expect(cellAt(container, 2, 1)).not.toHaveAttribute(
                "data-interacting",
            );
            expect(document.activeElement).toBe(cellAt(container, 2, 1));
            await settled();
            expect(
                cellAt(container, 2, 1)
                    .querySelector("button")
                    ?.getAttribute("tabindex"),
            ).toBe("-1");
        });
    });
}

describe("interactive header cells", () => {
    it("report interacting on a header cell entered with F2", () => {
        headerStates = [];
        const withMenu: Column<Task>[] = [
            {
                key: "title",
                name: "Title",
                width: 160,
                sortable: true,
                renderHeaderCell: () => (
                    <>
                        Title <button type="button">Menu</button>
                    </>
                ),
            },
        ];
        const { container } = render(<Grid cells={withMenu} />);
        const header = container.querySelector(
            '[data-grid-part="header-cell"]',
        ) as HTMLElement;
        act(() => header.focus());
        fireEvent.keyDown(header, { key: "F2" });
        expect(header).toHaveAttribute("data-interacting", "");
        expect(headerStates.at(-1)?.interacting).toBe(true);
    });
});

describe("a grid without controls in its cells", () => {
    it("carries no interaction attribute, and lets Enter through", () => {
        const plain: Column<Task>[] = [
            { key: "title", name: "Title", width: 160 },
        ];
        const { container } = render(<Grid cells={plain} />);
        const cell = cellAt(container, 0, 0);
        act(() => cell.focus());
        fireEvent.keyDown(cell, { key: "Enter" });
        expect(container.querySelectorAll("[data-interacting]")).toHaveLength(
            0,
        );
    });
});
