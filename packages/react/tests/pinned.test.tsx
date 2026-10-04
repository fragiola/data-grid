import { act, fireEvent, render } from "@testing-library/react";
import { Activity } from "react";
import { describe, expect, it } from "vitest";
import { type Column, type ColumnOrGroup, DataGrid } from "../src";
import { cellAt, stubViewportSize, tags } from "./helpers";

// Pinned columns (Epic #31, P3 and P5; Epic #38): pinned cells and header cells carry
// `data-pinned` and `data-pinned-edge`, sit sticky in their row's flow (rows are flex containers
// then) at the inset the engine writes (a consumer's transform and insets are dropped), and a grid
// without pinned columns renders as before.

interface Row {
    id: number;
}

const rows: Row[] = Array.from({ length: 100 }, (_, id) => ({ id }));

const plain = (key: string): Column<Row> => ({ key, name: key, width: 100 });
const pinned = (key: string): Column<Row> => ({
    ...plain(key),
    pinned: "start",
});

const columns: Column<Row>[] = [
    pinned("a"),
    pinned("b"),
    ...Array.from({ length: 30 }, (_, i) => plain(`c${i}`)),
];

stubViewportSize(500, 235);

/** What a consumer might give a cell: a transform and insets (dropped on pinned cells), a colour. */
const CONSUMER_STYLE = {
    transform: "scale(2)",
    top: 3,
    left: 7,
    right: 9,
    color: "red",
} as const;

function Grid({
    cells = columns,
    table = false,
}: {
    cells?: ColumnOrGroup<Row>[];
    table?: boolean;
}) {
    const tag = tags(table);
    return (
        <DataGrid.Root columns={cells} rows={rows} rowHeight={20}>
            <DataGrid.Grid render={tag.grid}>
                <DataGrid.Header render={tag.header}>
                    <DataGrid.HeaderRows<Row>>
                        {(row) => (
                            <DataGrid.HeaderRow
                                row={row}
                                render={tag.headerRow}
                            >
                                <DataGrid.HeaderCells<Row>>
                                    {(cell) => (
                                        <DataGrid.HeaderCell
                                            cell={cell}
                                            render={tag.headerCell}
                                            style={CONSUMER_STYLE}
                                            className={(state) =>
                                                state.pinned
                                                    ? state.pinnedEdge
                                                        ? "pinned edge"
                                                        : "pinned"
                                                    : undefined
                                            }
                                        />
                                    )}
                                </DataGrid.HeaderCells>
                            </DataGrid.HeaderRow>
                        )}
                    </DataGrid.HeaderRows>
                </DataGrid.Header>
                <DataGrid.Body render={tag.body}>
                    <DataGrid.Rows<Row>>
                        {(row) => (
                            <DataGrid.Row row={row} render={tag.row}>
                                <DataGrid.Cells<Row>>
                                    {(cell) => (
                                        <DataGrid.Cell
                                            cell={cell}
                                            render={tag.cell}
                                            style={CONSUMER_STYLE}
                                            className={(state) =>
                                                state.pinned
                                                    ? state.pinnedEdge
                                                        ? "pinned edge"
                                                        : "pinned"
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

describe("pinned cells", () => {
    it("mark pinned cells and header cells, and the last pinned column's edge", () => {
        const { container } = render(<Grid />);
        for (const rowIndex of [-1, 0, 5]) {
            const a = cellAt(container, rowIndex, 0);
            const b = cellAt(container, rowIndex, 1);
            const c = cellAt(container, rowIndex, 2);
            expect(a).toHaveAttribute("data-pinned", "start");
            expect(a).not.toHaveAttribute("data-pinned-edge");
            expect(a).toHaveClass("pinned");
            expect(b).toHaveAttribute("data-pinned-edge", "");
            expect(b).toHaveClass("pinned", "edge");
            expect(c).not.toHaveAttribute("data-pinned");
            expect(c).not.toHaveAttribute("data-pinned-edge");
        }
    });

    for (const table of [false, true]) {
        it(`are sticky in their row's flow at the engine's inset, a consumer's transform and insets dropped${table ? ", as table cells" : ""}`, () => {
            const { container } = render(<Grid table={table} />);
            for (const rowIndex of [-1, 0]) {
                const a = cellAt(container, rowIndex, 0);
                const b = cellAt(container, rowIndex, 1);
                expect(a.tagName).toBe(
                    table ? (rowIndex < 0 ? "TH" : "TD") : "DIV",
                );
                expect(a.style.position).toBe("sticky");
                expect(a.style.width).toBe("100px");
                // the rendered columns start at column 2: the layers are moved right by 200px, and
                // the insets are each column's offset less that
                expect(a.style.left).toBe("-200px");
                expect(b.style.left).toBe("-100px");
                for (const property of ["transform", "top", "right"] as const) {
                    expect(a.style[property]).toBe("");
                }
                expect(a.style.color).toBe("red");
                // a cell that scrolls keeps what the consumer gave it, under the structure
                const c = cellAt(container, rowIndex, 2);
                expect(c.style.position).toBe("absolute");
                expect(c.style.transform).toBe("scale(2)");
                // the row starts the pinned and the rendered columns' width (200 + 500) before
                // its layer
                expect(c.style.left).toBe("700px");
            }
            const row = container.querySelector(
                '[data-grid-part="row"]',
            ) as HTMLElement;
            const headerRow = container.querySelector(
                '[data-grid-part="header-row"]',
            ) as HTMLElement;
            expect(row.tagName).toBe(table ? "TR" : "DIV");
            for (const element of [row, headerRow]) {
                expect(element.style.display).toBe("flex");
                expect(element.style.position).toBe("absolute");
            }
        });
    }

    it("are not written while scrolling inside the rendered window, and follow a new one", () => {
        const { container } = render(<Grid />);
        const root = container.querySelector(
            '[data-grid-part="root"]',
        ) as HTMLElement;
        const pinnedCells = [...container.querySelectorAll("[data-pinned]")];
        const writes = new MutationObserver(() => {});
        for (const cell of pinnedCells) {
            writes.observe(cell, { attributeFilter: ["style"] });
        }
        act(() => {
            root.scrollLeft = 40;
            fireEvent.scroll(root);
        });
        expect(writes.takeRecords()).toEqual([]);
        expect(cellAt(container, 0, 0).style.left).toBe("-200px");
        writes.disconnect();
        // far right: a new column window, the layers' x is its base
        act(() => {
            root.scrollLeft = 2_000;
            fireEvent.scroll(root);
        });
        const body = container.querySelector(
            '[data-grid-part="body"]',
        ) as HTMLElement;
        const x = Number(
            /translate3d\(([-\d.]+)px/.exec(body.style.transform)?.[1],
        );
        expect(x).toBeGreaterThan(1_000);
        expect(cellAt(container, 0, 1).style.left).toBe(`${100 - x}px`);
        expect(cellAt(container, -1, 1).style.left).toBe(`${100 - x}px`);
    });

    it("drop a transform and insets on their render element too", () => {
        const { container } = render(
            <DataGrid.Root columns={columns} rows={rows} rowHeight={20}>
                <DataGrid.Grid>
                    <DataGrid.Body>
                        <DataGrid.Rows<Row>>
                            {(row) => (
                                <DataGrid.Row row={row}>
                                    <DataGrid.Cells<Row>>
                                        {(cell) => (
                                            <DataGrid.Cell
                                                cell={cell}
                                                render={
                                                    <div
                                                        style={{
                                                            transform:
                                                                "scale(3)",
                                                            top: 4,
                                                            color: "red",
                                                        }}
                                                    />
                                                }
                                            />
                                        )}
                                    </DataGrid.Cells>
                                </DataGrid.Row>
                            )}
                        </DataGrid.Rows>
                    </DataGrid.Body>
                </DataGrid.Grid>
            </DataGrid.Root>,
        );
        const a = cellAt(container, 0, 0);
        expect(a.style.transform).toBe("");
        expect(a.style.top).toBe("");
        expect(a.style.left).toBe("-200px");
        expect(a.style.color).toBe("red");
        expect(cellAt(container, 0, 2).style.transform).toBe("scale(3)");
    });

    it("render far from the column window, as table cells too", () => {
        const { container } = render(<Grid table />);
        const root = container.querySelector(
            '[data-grid-part="root"]',
        ) as HTMLElement;
        act(() => {
            root.scrollLeft = 2_000;
            fireEvent.scroll(root);
        });
        const a = cellAt(container, 0, 0);
        expect(a.tagName).toBe("TD");
        expect(a).toHaveAttribute("data-pinned", "start");
        expect(a).toHaveAttribute("aria-colindex", "1");
        expect(cellAt(container, -1, 1).tagName).toBe("TH");
    });

    it("mark a pinned group's header cell", () => {
        const { container } = render(
            <Grid
                cells={[
                    {
                        key: "who",
                        name: "Who",
                        children: [pinned("a"), pinned("b")],
                    },
                    ...Array.from({ length: 10 }, (_, i) => plain(`c${i}`)),
                ]}
            />,
        );
        const group = cellAt(container, -2, 0);
        expect(group).toHaveAttribute("data-group", "");
        expect(group).toHaveAttribute("data-pinned", "start");
        expect(group).toHaveAttribute("data-pinned-edge", "");
    });

    it("sit inside their row's box: a row starts the pinned and rendered columns' width before its layer", () => {
        const { container } = render(<Grid />);
        const row = container.querySelector(
            '[data-grid-part="row"][data-row-index="0"]',
        ) as HTMLElement;
        // 200px pinned, columns 2 to 7 rendered (the view's 300px and 2 of overscan)
        expect(row.style.left).toBe("-700px");
        const headerRow = container.querySelector(
            '[data-grid-part="header-row"]',
        ) as HTMLElement;
        expect(headerRow.style.left).toBe("-700px");
        expect(headerRow.style.width).toBe(row.style.width);
    });

    it("get their insets back when the grid is shown again (Activity)", () => {
        const { container, rerender } = render(
            <Activity mode="visible">
                <Grid />
            </Activity>,
        );
        expect(cellAt(container, 0, 0).style.left).toBe("-200px");
        // hidden: the effects and refs are cleaned up while the elements stay; shown: the cells
        // register again before the root attaches its viewport
        rerender(
            <Activity mode="hidden">
                <Grid />
            </Activity>,
        );
        rerender(
            <Activity mode="visible">
                <Grid />
            </Activity>,
        );
        for (const rowIndex of [-1, 0]) {
            expect(cellAt(container, rowIndex, 0).style.left).toBe("-200px");
            expect(cellAt(container, rowIndex, 1).style.left).toBe("-100px");
        }
    });

    it("become cells that scroll once their column is unpinned", () => {
        const { container, rerender } = render(<Grid />);
        expect(cellAt(container, 0, 0).style.position).toBe("sticky");
        rerender(
            <Grid
                cells={[
                    plain("a"),
                    plain("b"),
                    ...Array.from({ length: 30 }, (_, i) => plain(`c${i}`)),
                ]}
            />,
        );
        const a = cellAt(container, 0, 0);
        expect(a).not.toHaveAttribute("data-pinned");
        expect(a.style.position).toBe("absolute");
        expect(a.style.left).toBe("0px");
        expect(cellAt(container, 0, 1).style.left).toBe("100px");
        const row = container.querySelector(
            '[data-grid-part="row"]',
        ) as HTMLElement;
        expect(row.style.display).toBe("");
        expect(row.style.left).toBe("0px");
    });

    it("leave a grid without pinned columns as it was", () => {
        const { container } = render(
            <Grid cells={columns.map(({ pinned: _, ...column }) => column)} />,
        );
        expect(
            container.querySelectorAll("[data-pinned], [data-pinned-edge]"),
        ).toHaveLength(0);
        const a = cellAt(container, 0, 0);
        expect(a.style.transform).toBe("scale(2)");
        expect(a.style.position).toBe("absolute");
        // no new structural key: no `display` on rows
        for (const part of ["row", "header-row"]) {
            const element = container.querySelector(
                `[data-grid-part="${part}"]`,
            ) as HTMLElement;
            expect(element.style.display).toBe("");
            expect(element.style.left).toBe("0px");
        }
    });
});
