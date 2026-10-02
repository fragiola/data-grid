import { act, fireEvent, render } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Column, type ColumnOrGroup, DataGrid } from "../src";

// Pinned columns (Epic #31, P3 and P5): pinned cells and header cells carry `data-pinned` and
// `data-pinned-edge`, the engine writes their transform (a consumer's is dropped), and a grid
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

beforeAll(() => {
    for (const [property, size] of [
        ["clientWidth", 500],
        ["clientHeight", 235],
    ] as const) {
        Object.defineProperty(HTMLElement.prototype, property, {
            configurable: true,
            get(this: HTMLElement) {
                return this.dataset.gridPart === "root" ? size : 0;
            },
        });
    }
});

afterAll(() => {
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
    delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
});

function Grid({
    cells = columns,
    table = false,
}: {
    cells?: ColumnOrGroup<Row>[];
    table?: boolean;
}) {
    return (
        <DataGrid.Root columns={cells} rows={rows} rowHeight={20}>
            <DataGrid.Grid render={table ? <table /> : undefined}>
                <DataGrid.Header render={table ? <thead /> : undefined}>
                    <DataGrid.HeaderRows<Row>>
                        {(row) => (
                            <DataGrid.HeaderRow
                                row={row}
                                render={table ? <tr /> : undefined}
                            >
                                <DataGrid.HeaderCells<Row>>
                                    {(cell) => (
                                        <DataGrid.HeaderCell
                                            cell={cell}
                                            render={table ? <th /> : undefined}
                                            style={{ transform: "scale(2)" }}
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
                <DataGrid.Body render={table ? <tbody /> : undefined}>
                    <DataGrid.Rows<Row>>
                        {(row) => (
                            <DataGrid.Row
                                row={row}
                                render={table ? <tr /> : undefined}
                            >
                                <DataGrid.Cells<Row>>
                                    {(cell) => (
                                        <DataGrid.Cell
                                            cell={cell}
                                            render={table ? <td /> : undefined}
                                            style={{ transform: "scale(2)" }}
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

const cellAt = (
    container: HTMLElement,
    rowIndex: number,
    columnIndex: number,
) => {
    const element = container.querySelector(
        `[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`,
    );
    if (!(element instanceof HTMLElement)) {
        throw new Error(`no cell ${rowIndex}:${columnIndex}`);
    }
    return element;
};

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

    it("are written by the engine: their transform follows the scroll, a consumer's is dropped", () => {
        const { container } = render(<Grid />);
        const root = container.querySelector(
            '[data-grid-part="root"]',
        ) as HTMLElement;
        // the rendered columns start at column 2: the layers are moved right by 200px
        expect(cellAt(container, 0, 0).style.transform).toBe(
            "translate3d(-200px, 0px, 0px)",
        );
        expect(cellAt(container, -1, 1).style.transform).toBe(
            "translate3d(-200px, 0px, 0px)",
        );
        // an unpinned cell keeps what the consumer gave it
        expect(cellAt(container, 0, 2).style.transform).toBe("scale(2)");
        act(() => {
            root.scrollLeft = 40;
            fireEvent.scroll(root);
        });
        expect(cellAt(container, 0, 0).style.transform).toBe(
            "translate3d(-160px, 0px, 0px)",
        );
        expect(cellAt(container, -1, 0).style.transform).toBe(
            "translate3d(-160px, 0px, 0px)",
        );
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

    it("sit inside their row's box: a row starts the pinned width before its layer", () => {
        const { container } = render(<Grid />);
        const row = container.querySelector(
            '[data-grid-part="row"][data-row-index="0"]',
        ) as HTMLElement;
        expect(row.style.left).toBe("-200px");
        // C0 and C1 pinned at 200 and 300 in the row, C2 (the first that scrolls) at 200 + 0
        expect(cellAt(container, 0, 0).style.left).toBe("200px");
        expect(cellAt(container, 0, 2).style.left).toBe("200px");
        const headerRow = container.querySelector(
            '[data-grid-part="header-row"]',
        ) as HTMLElement;
        expect(headerRow.style.left).toBe("-200px");
    });

    it("keep no engine transform once their column is unpinned", () => {
        const { container, rerender } = render(<Grid />);
        expect(cellAt(container, 0, 0).style.transform).toContain(
            "translate3d",
        );
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
        expect(a.style.transform).not.toContain("translate3d");
    });

    it("leave a grid without pinned columns as it was", () => {
        const { container } = render(
            <Grid cells={columns.map(({ pinned: _, ...column }) => column)} />,
        );
        expect(
            container.querySelectorAll("[data-pinned], [data-pinned-edge]"),
        ).toHaveLength(0);
        expect(cellAt(container, 0, 0).style.transform).toBe("scale(2)");
    });
});
