import { act, fireEvent, render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import {
    type Column,
    DataGrid,
    type DataGridContextValue,
    useDataGrid,
} from "../src";
import { cellAt, root, stubViewportSize, tags } from "./helpers";

// Summary rows (Epic #86, E2.1): `Summary` renders a position's rows sticky (the top ones under the
// header, the bottom ones at the visible body's bottom edge), each a `SummaryRow` of
// `SummaryCell`s drawn by the columns' `renderSummaryCell` from the app's own values. Nothing
// renders without them, and a grid without them renders as before.

interface Row {
    id: number;
    amount: number;
}

const rows: Row[] = Array.from({ length: 20 }, (_, id) => ({
    id,
    amount: id * 10,
}));
const total = rows.reduce((sum, row) => sum + row.amount, 0);

const columns: Column<Row>[] = [
    {
        key: "id",
        name: "Id",
        width: 100,
        pinned: "start",
        renderSummaryCell: ({ position }) =>
            position === "top" ? "Top" : "Total",
    },
    {
        key: "amount",
        name: "Amount",
        width: 100,
        renderSummaryCell: ({ summaryIndex }) =>
            summaryIndex === 0 ? String(total) : "average",
        colSpan: (args) =>
            args.type === "summary" && args.summaryIndex === 1 ? 2 : undefined,
    },
    { key: "c", name: "C", width: 100 },
];

// a 35px header, two 30px summary rows: 300 − 35 − 30 − 60 = 175 for the body
stubViewportSize(800, 300);

let grid: DataGridContextValue<Row> | null = null;

function Expose() {
    grid = useDataGrid<Row>();
    return null;
}

const TABLE_SUMMARY = {
    top: <tbody />,
    bottom: <tfoot />,
    row: <tr />,
    cell: <td />,
};

function Grid({
    table = false,
    summaryRows,
}: {
    table?: boolean;
    summaryRows: { top?: number; bottom?: number } | undefined;
}) {
    const tag = tags(table);
    const summary = table ? TABLE_SUMMARY : undefined;
    return (
        <DataGrid.Root
            columns={columns}
            rows={rows}
            rowHeight={20}
            summaryRows={summaryRows}
            summaryRowHeight={30}
        >
            <Expose />
            <DataGrid.Grid render={tag.grid}>
                <DataGrid.Header render={tag.header} />
                <DataGrid.Summary position="top" render={summary?.top}>
                    <DataGrid.SummaryRows>
                        {(row) => (
                            <DataGrid.SummaryRow
                                row={row}
                                render={summary?.row}
                            >
                                <DataGrid.SummaryCells<Row>>
                                    {(cell) => (
                                        <DataGrid.SummaryCell
                                            cell={cell}
                                            render={summary?.cell}
                                        />
                                    )}
                                </DataGrid.SummaryCells>
                            </DataGrid.SummaryRow>
                        )}
                    </DataGrid.SummaryRows>
                </DataGrid.Summary>
                <DataGrid.Body render={tag.body} />
                <DataGrid.Summary position="bottom" render={summary?.bottom}>
                    <DataGrid.SummaryRows>
                        {(row) => (
                            <DataGrid.SummaryRow
                                row={row}
                                render={summary?.row}
                            >
                                <DataGrid.SummaryCells<Row>>
                                    {(cell) => (
                                        <DataGrid.SummaryCell
                                            cell={cell}
                                            render={summary?.cell}
                                        />
                                    )}
                                </DataGrid.SummaryCells>
                            </DataGrid.SummaryRow>
                        )}
                    </DataGrid.SummaryRows>
                </DataGrid.Summary>
            </DataGrid.Grid>
        </DataGrid.Root>
    );
}

const summaryCell = (
    container: ParentNode,
    rowIndex: number,
    columnIndex: number,
) =>
    container.querySelector<HTMLElement>(
        `[data-grid-part="summary-cell"][data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`,
    );

const part = (container: ParentNode, position: string) =>
    container.querySelector<HTMLElement>(
        `[data-grid-part="summary"][data-summary="${position}"]`,
    );

describe("summary rows", () => {
    for (const table of [false, true]) {
        it(`render sticky, with the app's values, ARIA and data-summary${table ? ", as table parts" : ""}`, () => {
            const { container } = render(
                <Grid table={table} summaryRows={{ top: 1, bottom: 2 }} />,
            );
            const top = part(container, "top");
            const bottom = part(container, "bottom");
            expect(top?.tagName).toBe(table ? "TBODY" : "DIV");
            expect(bottom?.tagName).toBe(table ? "TFOOT" : "DIV");
            expect(top).toHaveAttribute("role", "rowgroup");
            expect(top?.style.position).toBe("sticky");
            expect(top?.style.top).toBe("35px");
            expect(top?.style.height).toBe("30px");
            // stuck at the view's bottom edge: a percentage of its height, no measure
            expect(bottom?.style.top).toBe("calc(100% - 60px)");
            expect(bottom?.style.height).toBe("60px");
            // the top one's row before the header's: -2; the bottom ones after the body's
            expect(summaryCell(container, -2, 0)).toHaveTextContent("Top");
            expect(summaryCell(container, -2, 1)).toHaveTextContent(
                String(total),
            );
            expect(summaryCell(container, 20, 0)).toHaveTextContent("Total");
            expect(summaryCell(container, 21, 1)).toHaveTextContent("average");
            const row = container.querySelector(
                '[data-grid-part="summary-row"][data-row-index="21"]',
            );
            expect(row).toHaveAttribute("role", "row");
            expect(row).toHaveAttribute("aria-rowindex", "24");
            expect(row).toHaveAttribute("data-summary", "bottom");
            expect((row as HTMLElement).style.top).toBe("30px");
            expect(
                container.querySelector(
                    '[data-grid-part="summary-row"][data-row-index="-2"]',
                ),
            ).toHaveAttribute("aria-rowindex", "2");
            expect(
                cellAt(container, 0, 0).closest('[role="row"]'),
            ).toHaveAttribute("aria-rowindex", "3");
            expect(
                root(container).querySelector('[role="grid"]'),
            ).toHaveAttribute("aria-rowcount", String(1 + 1 + 20 + 2));
            const own = summaryCell(container, 20, 1);
            expect(own).toHaveAttribute("role", "gridcell");
            expect(own).toHaveAttribute("aria-colindex", "2");
            expect(own).toHaveAttribute("data-summary", "bottom");
            expect(own?.style.height).toBe("30px");
            // pinned with the body's
            expect(summaryCell(container, 20, 0)).toHaveAttribute(
                "data-pinned",
                "start",
            );
            expect(summaryCell(container, 20, 0)?.style.position).toBe(
                "sticky",
            );
            // spanning with its column's colSpan
            const span = summaryCell(container, 21, 1);
            expect(span).toHaveAttribute("aria-colspan", "2");
            expect(span?.style.width).toBe("200px");
            if (table) expect(span).toHaveAttribute("colspan", "2");
            expect(summaryCell(container, 21, 2)).toBeNull();
            // the body sits below the header and the top summary row
            const body = container.querySelector<HTMLElement>(
                '[data-grid-part="body"]',
            );
            expect(body?.style.top).toBe("65px");
            const sizer = container.querySelector<HTMLElement>(
                '[data-grid-part="grid"]',
            );
            expect(sizer?.style.height).toBe(`${35 + 90 + 20 * 20}px`);
        });
    }

    it("render nothing without summary rows, the grid as before", () => {
        const { container } = render(<Grid summaryRows={undefined} />);
        expect(part(container, "top")).toBeNull();
        expect(part(container, "bottom")).toBeNull();
        expect(container.querySelector('[data-grid-part="body"]')).toHaveStyle({
            top: "35px",
        });
        expect(
            container.querySelector('[data-grid-part="grid"]'),
        ).toHaveAttribute("aria-rowcount", "21");
    });

    it("follow the prop: new counts, and none once it is removed", () => {
        const { container, rerender } = render(
            <Grid summaryRows={{ bottom: 1 }} />,
        );
        expect(part(container, "top")).toBeNull();
        expect(grid?.model.get("summary-rows")).toEqual({ top: 0, bottom: 1 });
        rerender(<Grid summaryRows={{ top: 2, bottom: 1 }} />);
        expect(grid?.model.get("summary-rows")).toEqual({ top: 2, bottom: 1 });
        expect(summaryCell(container, -3, 0)).toHaveTextContent("Top");
        rerender(<Grid summaryRows={undefined} />);
        expect(grid?.model.get("summary-rows")).toEqual({ top: 0, bottom: 0 });
        expect(part(container, "bottom")).toBeNull();
    });

    it("make a summary cell the roving tab stop, and take the keys", () => {
        const { container } = render(
            <Grid summaryRows={{ top: 1, bottom: 2 }} />,
        );
        act(() => {
            grid?.model.run("active-position.set", {
                rowIndex: 20,
                columnIndex: 2,
            });
        });
        const active = summaryCell(container, 20, 2);
        expect(active).toHaveAttribute("tabindex", "0");
        expect(active).toHaveAttribute("data-active", "");
        expect(
            container.querySelector(
                '[data-grid-part="summary-row"][data-row-index="20"]',
            ),
        ).toHaveAttribute("data-active", "");
        if (!active) throw new Error("no active cell");
        fireEvent.keyDown(active, { key: "ArrowUp" });
        expect(grid?.model.get("active-position")).toEqual({
            rowIndex: 19,
            columnIndex: 2,
        });
        fireEvent.keyDown(cellAt(container, 19, 2), { key: "ArrowDown" });
        fireEvent.keyDown(summaryCell(container, 20, 2) as HTMLElement, {
            key: "ArrowDown",
        });
        // into the span: it is active on any of its columns
        expect(grid?.model.get("active-position")).toEqual({
            rowIndex: 21,
            columnIndex: 1,
        });
    });

    it("follow the primitive contract: render, ref, className and style functions, forwarded props", () => {
        const ref = createRef<HTMLDivElement>();
        const { container } = render(
            <DataGrid.Root
                columns={columns}
                rows={rows}
                summaryRows={{ top: 1 }}
            >
                <DataGrid.Grid>
                    <DataGrid.Summary
                        position="top"
                        ref={ref}
                        data-testid="summary"
                        className={(state) => `summary-${state.position}`}
                        // structural keys win
                        style={{ top: 3, color: "red" }}
                    >
                        <DataGrid.SummaryRows>
                            {(row) => (
                                <DataGrid.SummaryRow
                                    row={row}
                                    className={(state) =>
                                        `row-${state.summaryIndex}`
                                    }
                                    style={{ transform: "none" }}
                                >
                                    <DataGrid.SummaryCells<Row>>
                                        {(cell) => (
                                            <DataGrid.SummaryCell
                                                cell={cell}
                                                render={(props, state) => (
                                                    <span
                                                        {...props}
                                                        data-position={
                                                            state.position
                                                        }
                                                    />
                                                )}
                                            >
                                                {cell.columnIndex}
                                            </DataGrid.SummaryCell>
                                        )}
                                    </DataGrid.SummaryCells>
                                </DataGrid.SummaryRow>
                            )}
                        </DataGrid.SummaryRows>
                    </DataGrid.Summary>
                </DataGrid.Grid>
            </DataGrid.Root>,
        );
        const summary = ref.current;
        expect(summary).toHaveAttribute("data-testid", "summary");
        expect(summary).toHaveClass("summary-top");
        expect(summary?.style.top).toBe("35px");
        expect(summary?.style.color).toBe("red");
        const row = container.querySelector<HTMLElement>(
            '[data-grid-part="summary-row"]',
        );
        expect(row).toHaveClass("row-0");
        // the layer's transform is the engine's
        expect(row?.style.transform).not.toBe("none");
        const own = summaryCell(container, -2, 1);
        expect(own?.tagName).toBe("SPAN");
        expect(own).toHaveAttribute("data-position", "top");
        expect(own).toHaveTextContent("1");
        // no name of its own
        expect(summary).not.toHaveAttribute("aria-label");
        expect(own).not.toHaveAttribute("aria-label");
    });

    it("render a summary cell empty without renderSummaryCell, and keep a nested grid's rows its own", () => {
        const plain: Column<Row>[] = [{ key: "id", width: 100 }];
        const { container } = render(
            <DataGrid.Root
                columns={plain}
                rows={rows}
                summaryRows={{ bottom: 1 }}
            >
                <DataGrid.Grid>
                    <DataGrid.Summary position="bottom" />
                </DataGrid.Grid>
            </DataGrid.Root>,
        );
        const own = summaryCell(container, 20, 0);
        expect(own).toBeEmptyDOMElement();
        expect(() =>
            render(
                <DataGrid.Root columns={plain} rows={rows}>
                    <DataGrid.SummaryCells />
                </DataGrid.Root>,
            ),
        ).toThrow(/SummaryRow/);
    });

    it("tell a controlled parent where its active summary row went when the rows change", () => {
        const changes: unknown[] = [];
        function Controlled({ count }: { count: number }) {
            return (
                <DataGrid.Root
                    columns={columns}
                    rows={rows.slice(0, count)}
                    summaryRows={{ bottom: 1 }}
                    activePosition={{ rowIndex: 20, columnIndex: 2 }}
                    onActivePositionChange={(position) =>
                        changes.push(position)
                    }
                >
                    <Expose />
                    <DataGrid.Grid>
                        <DataGrid.Body />
                        <DataGrid.Summary position="bottom" />
                    </DataGrid.Grid>
                </DataGrid.Root>
            );
        }
        const { rerender } = render(<Controlled count={20} />);
        expect(changes).toEqual([]);
        rerender(<Controlled count={5} />);
        // the bottom summary row is at 5 now: the parent is told
        expect(grid?.model.get("active-position")).toEqual({
            rowIndex: 5,
            columnIndex: 2,
        });
        expect(changes.length).toBeGreaterThan(0);
        for (const change of changes) {
            expect(change).toEqual({ rowIndex: 5, columnIndex: 2 });
        }
    });

    it("draw their cells again for summary-rows.changed, and with the app's own children", () => {
        const figures = { total: 1 };
        const live: Column<Row>[] = [
            {
                key: "id",
                width: 100,
                renderSummaryCell: () => `total ${figures.total}`,
            },
        ];
        function Live({ note }: { note: string }) {
            return (
                <DataGrid.Root
                    columns={live}
                    rows={rows}
                    summaryRows={{ top: 1 }}
                >
                    <Expose />
                    <DataGrid.Grid>
                        <DataGrid.Summary position="top">
                            <DataGrid.SummaryRows>
                                {(row) => (
                                    <DataGrid.SummaryRow row={row}>
                                        <DataGrid.SummaryCells<Row>>
                                            {(cell) => (
                                                <DataGrid.SummaryCell
                                                    cell={cell}
                                                >
                                                    {note}{" "}
                                                    {cell.column.renderSummaryCell?.(
                                                        cell,
                                                    )}
                                                </DataGrid.SummaryCell>
                                            )}
                                        </DataGrid.SummaryCells>
                                    </DataGrid.SummaryRow>
                                )}
                            </DataGrid.SummaryRows>
                        </DataGrid.Summary>
                    </DataGrid.Grid>
                </DataGrid.Root>
            );
        }
        const { container, rerender } = render(<Live note="a" />);
        const own = () => summaryCell(container, -2, 0);
        expect(own()).toHaveTextContent("a total 1");
        // the app's state, read where it renders the cell
        rerender(<Live note="b" />);
        expect(own()).toHaveTextContent("b total 1");
        // data behind the same columns: told to the grid
        figures.total = 2;
        act(() => {
            grid?.model.run("summary-rows.changed");
        });
        expect(own()).toHaveTextContent("b total 2");
    });
});
