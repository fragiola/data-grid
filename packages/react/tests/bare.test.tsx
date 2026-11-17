import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type Column, DataGrid, type DataGridFeatures } from "../src";
import { editing } from "../src/editing";
import { navigation } from "../src/navigation";
import { cellAt, headerAt, settled, stubViewportSize, tags } from "./helpers";

// A grid without features (Epic #144): cell navigation is a feature, so a bare grid is the APG
// table pattern (`role="table"`, `columnheader`, `cell`), with no tab stop of its own, nor on its
// cells, and the arrow keys move nothing; the controls in its cells keep their own tab order.
// Installing `navigation()` makes it a grid: `grid`, `gridcell` and the roving tab stop. Cell
// editing is one too (Epic #146): without `editing()`, an editable column's cell never edits.

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
        renderCell: ({ row }) => <button type="button">Edit {row.id}</button>,
    },
];

/** The columns with an editable one, its editor the app's. */
const editableColumns: Column<Task>[] = [
    {
        key: "title",
        name: "Title",
        width: 160,
        editable: true,
        renderEditCell: ({ value }) => (
            <input data-editor="" defaultValue={String(value)} />
        ),
    },
];

stubViewportSize(400, 300);

function Grid({
    table = false,
    features,
    gridColumns = columns,
}: {
    table?: boolean;
    features?: DataGridFeatures;
    gridColumns?: Column<Task>[];
}) {
    const tag = tags(table);
    return (
        <DataGrid.Root
            features={features}
            columns={gridColumns}
            rows={tasks}
            rowHeight={24}
        >
            <DataGrid.Grid render={tag.grid} aria-label="Tasks">
                <DataGrid.Header render={tag.header}>
                    <DataGrid.HeaderRow render={tag.headerRow}>
                        <DataGrid.HeaderCells<Task>>
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
                    <DataGrid.Rows<Task>>
                        {(row) => (
                            <DataGrid.Row row={row} render={tag.row}>
                                <DataGrid.Cells<Task>>
                                    {(cell) => (
                                        <DataGrid.Cell
                                            cell={cell}
                                            render={tag.cell}
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

const gridOf = (container: ParentNode) =>
    container.querySelector('[data-grid-part="grid"]') as HTMLElement;
const cellsOf = (container: ParentNode) => [
    ...container.querySelectorAll<HTMLElement>('[data-grid-part="cell"]'),
];

for (const table of [false, true]) {
    describe(`a grid without features, as ${table ? "a table" : "divs"}`, () => {
        it("is a table: role table, columnheader and cell, no tabindex on the grid nor its cells", async () => {
            const { container } = render(<Grid table={table} />);
            await settled();
            const grid = gridOf(container);
            expect(grid).toHaveAttribute("role", "table");
            expect(grid).not.toHaveAttribute("tabindex");
            const cells = cellsOf(container);
            expect(cells.length).toBeGreaterThan(0);
            for (const cell of cells) {
                expect(cell).toHaveAttribute("role", "cell");
                expect(cell).not.toHaveAttribute("tabindex");
            }
            expect(headerAt(container, 0)).toHaveAttribute(
                "role",
                "columnheader",
            );
            expect(headerAt(container, 0)).not.toHaveAttribute("tabindex");
            // the controls in its cells keep their own tab order
            for (const button of container.querySelectorAll(
                '[data-grid-part="cell"] button',
            )) {
                expect(button).not.toHaveAttribute("tabindex");
            }
        });

        it("moves nothing with the arrow keys", async () => {
            const { container } = render(<Grid table={table} />);
            await settled();
            const cell = cellAt(container, 0, 0);
            const kept = fireEvent.keyDown(cell, { key: "ArrowDown" });
            fireEvent.keyDown(cell, { key: "ArrowRight" });
            act(() => {
                fireEvent.click(cell);
            });
            fireEvent.keyDown(cell, { key: "ArrowDown" });
            // not the grid's: the browser's default stays, and no cell is ever active
            expect(kept).toBe(true);
            expect(container.querySelector("[data-active]")).toBeNull();
            expect(container.querySelector("[tabindex='0']")).toBeNull();
            for (const each of cellsOf(container)) {
                expect(each).not.toHaveAttribute("tabindex");
            }
        });
    });

    describe(`a grid with navigation, as ${table ? "a table" : "divs"}`, () => {
        it("is a grid: role grid and gridcell, the grid the tab stop until a cell is active, then that cell", async () => {
            const { container } = render(
                <Grid table={table} features={[navigation()]} />,
            );
            await settled();
            const grid = gridOf(container);
            expect(grid).toHaveAttribute("role", "grid");
            expect(grid).toHaveAttribute("tabindex", "0");
            for (const cell of cellsOf(container)) {
                expect(cell).toHaveAttribute("role", "gridcell");
                expect(cell).toHaveAttribute("tabindex", "-1");
            }
            const first = cellAt(container, 0, 0);
            act(() => first.focus());
            const prevented = !fireEvent.keyDown(first, { key: "ArrowDown" });
            expect(prevented).toBe(true);
            const below = cellAt(container, 1, 0);
            expect(below).toHaveAttribute("data-active", "");
            expect(below).toHaveAttribute("tabindex", "0");
            expect(document.activeElement).toBe(below);
            expect(gridOf(container)).toHaveAttribute("tabindex", "-1");
        });

        it("edits nothing without editing: Enter, F2, typing and a double click, no editor rendered", async () => {
            const { container } = render(
                <Grid
                    table={table}
                    features={[navigation()]}
                    gridColumns={editableColumns}
                />,
            );
            await settled();
            const cell = cellAt(container, 0, 0);
            act(() => {
                fireEvent.click(cell);
                cell.focus();
            });
            expect(cell).toHaveAttribute("data-active", "");
            for (const key of ["Enter", "F2", "a"]) {
                expect(fireEvent.keyDown(cell, { key })).toBe(true);
            }
            act(() => {
                fireEvent.click(cell, { detail: 2 });
            });
            expect(container.querySelector("[data-editing]")).toBeNull();
            expect(container.querySelector("[data-editor]")).toBeNull();
        });

        it("edits with editing installed: the cell renders its column's editor", async () => {
            const { container } = render(
                <Grid
                    table={table}
                    features={[navigation(), editing()]}
                    gridColumns={editableColumns}
                />,
            );
            await settled();
            const cell = cellAt(container, 0, 0);
            act(() => {
                fireEvent.click(cell);
                cell.focus();
            });
            act(() => {
                fireEvent.keyDown(cell, { key: "Enter" });
            });
            expect(cell).toHaveAttribute("data-editing", "");
            expect(cell.querySelector("[data-editor]")).toHaveValue("Task 0");
        });
    });
}
