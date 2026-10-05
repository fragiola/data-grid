import { fireEvent, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { type Column, DataGrid, type GridDirection, useDataGrid } from "../src";
import { cellAt, root, rowAt, stubViewportSize, tags } from "./helpers";

// Pinned end columns and right to left (Epic #85, E1.1): a column pinned at the end is sticky in
// its row's flow like one pinned at the start (`data-pinned="end"`, its part's edge on the first);
// right to left, the root carries `dir` and every structural inset the primitives and the engine
// write is on the right, the same numbers as on the left left to right.

interface Row {
    id: number;
}

const rows: Row[] = Array.from({ length: 100 }, (_, id) => ({ id }));

const column = (key: string, pinned?: "start" | "end"): Column<Row> => ({
    key,
    name: key,
    width: 100,
    ...(pinned ? { pinned } : {}),
});

/** "a" pinned at the start, 30 that scroll, "y" and "z" pinned at the end */
const columns: Column<Row>[] = [
    column("a", "start"),
    ...Array.from({ length: 30 }, (_, i) => column(`c${i}`)),
    column("y", "end"),
    column("z", "end"),
];

stubViewportSize(500, 235);

function Grid({
    cells = columns,
    table = false,
    direction,
    expanded = false,
}: {
    cells?: Column<Row>[];
    table?: boolean;
    direction?: GridDirection | undefined;
    expanded?: boolean;
}) {
    const tag = tags(table);
    return (
        <DataGrid.Root
            columns={cells}
            rows={rows}
            rowHeight={20}
            direction={direction}
            defaultExpandedRowKeys={expanded ? [0] : undefined}
        >
            <DataGrid.Grid render={tag.grid}>
                <DataGrid.Header render={tag.header} />
                <DataGrid.Body render={tag.body}>
                    <DataGrid.Rows<Row>>
                        {(row) => (
                            <DataGrid.Row row={row} render={tag.row}>
                                <DataGrid.Cells<Row>>
                                    {(cell) => (
                                        <DataGrid.Cell
                                            cell={cell}
                                            render={tag.cell}
                                        />
                                    )}
                                </DataGrid.Cells>
                                <DataGrid.RowDetail>detail</DataGrid.RowDetail>
                            </DataGrid.Row>
                        )}
                    </DataGrid.Rows>
                </DataGrid.Body>
                <DataGrid.Empty />
            </DataGrid.Grid>
        </DataGrid.Root>
    );
}

const body = (container: ParentNode) =>
    container.querySelector<HTMLElement>('[data-grid-part="body"]');

describe("columns pinned at the end", () => {
    for (const table of [false, true]) {
        it(`are last in each row, sticky in its flow at the engine's inset, the first one their edge${table ? ", as table cells" : ""}`, () => {
            const { container } = render(<Grid table={table} />);
            for (const rowIndex of [-1, 0]) {
                const y = cellAt(container, rowIndex, 31);
                const z = cellAt(container, rowIndex, 32);
                expect(y).toHaveAttribute("data-pinned", "end");
                expect(y).toHaveAttribute("data-pinned-edge", "");
                expect(z).toHaveAttribute("data-pinned", "end");
                expect(z).not.toHaveAttribute("data-pinned-edge");
                expect(cellAt(container, rowIndex, 0)).toHaveAttribute(
                    "data-pinned",
                    "start",
                );
                expect(y.style.position).toBe("sticky");
                // the view's end less their 200px: 300 and 400 from its start, the layers
                // moved by the rendered columns' base (100px)
                expect(y.style.left).toBe(`${3_100 - 100 + 500 - 3_300}px`);
                expect(z.style.left).toBe(`${3_200 - 100 + 500 - 3_300}px`);
                expect(z.parentElement?.lastElementChild).toBe(z);
            }
            expect(rowAt(container, 0).style.display).toBe("flex");
        });
    }

    it("make every row a flex container, with no column pinned at the start", () => {
        const { container } = render(
            <Grid
                cells={columns.filter((entry) => entry.pinned !== "start")}
            />,
        );
        expect(rowAt(container, 0).style.display).toBe("flex");
        expect(cellAt(container, 0, 30)).toHaveAttribute("data-pinned", "end");
    });

    it("put a detail at the row's start, before both pinned parts", () => {
        const { container } = render(<Grid expanded />);
        const detail = container.querySelector<HTMLElement>(
            '[data-grid-part="row-detail"][data-row-index="0"]',
        );
        expect(detail?.style.marginLeft).toBe("-300px");
        expect(detail?.style.marginRight).toBe("");
    });
});

describe("right to left", () => {
    it("carries `dir` on the root only when a direction is given", () => {
        expect(root(render(<Grid />).container)).not.toHaveAttribute("dir");
        expect(
            root(render(<Grid direction="ltr" />).container),
        ).toHaveAttribute("dir", "ltr");
        expect(
            root(render(<Grid direction="rtl" />).container),
        ).toHaveAttribute("dir", "rtl");
    });

    for (const table of [false, true]) {
        it(`places every part from the right, as left to right from the left${table ? ", as table elements" : ""}`, () => {
            const ltr = render(<Grid table={table} expanded />).container;
            const rtl = render(
                <Grid table={table} expanded direction="rtl" />,
            ).container;
            const pairs: [HTMLElement | null, HTMLElement | null][] = [
                [body(ltr), body(rtl)],
                [rowAt(ltr, 1), rowAt(rtl, 1)],
                [cellAt(ltr, 1, 3), cellAt(rtl, 1, 3)],
                [cellAt(ltr, -1, 3), cellAt(rtl, -1, 3)],
                // the engine's insets
                [cellAt(ltr, 1, 0), cellAt(rtl, 1, 0)],
                [cellAt(ltr, -1, 32), cellAt(rtl, -1, 32)],
                [
                    ltr.querySelector('[data-grid-part="row-detail"]'),
                    rtl.querySelector('[data-grid-part="row-detail"]'),
                ],
            ];
            for (const [left, right] of pairs) {
                if (!left || !right) throw new Error("a part is missing");
                expect(left.style.left).toMatch(/px$/);
                expect(right.style.right).toBe(left.style.left);
                expect(right.style.left).toBe("");
            }
            const detail = rtl.querySelector<HTMLElement>(
                '[data-grid-part="row-detail"]',
            );
            expect(detail?.style.marginRight).toBe("-300px");
            expect(detail?.style.marginLeft).toBe("");
            // the layers move toward the start: the left
            expect(body(rtl)?.style.transform).toBe(
                body(ltr)?.style.transform.replace("(", "(-"),
            );
            // ARIA does not change
            expect(cellAt(rtl, 1, 3)).toHaveAttribute("aria-colindex", "4");
        });
    }

    it("takes the page's direction without a prop of its own, adding no `dir`", () => {
        const { container } = render(
            <div style={{ direction: "rtl" }}>
                <Grid />
            </div>,
        );
        expect(root(container)).not.toHaveAttribute("dir");
        expect(cellAt(container, 1, 3).style.right).toMatch(/px$/);
        expect(cellAt(container, 1, 3).style.left).toBe("");
        expect(cellAt(container, 1, 0).style.right).toMatch(/px$/);
    });

    it("lets its prop win over the page's", () => {
        const { container } = render(
            <div style={{ direction: "rtl" }}>
                <Grid direction="ltr" />
            </div>,
        );
        expect(root(container)).toHaveAttribute("dir", "ltr");
        expect(cellAt(container, 1, 3).style.left).toMatch(/px$/);
        expect(cellAt(container, 1, 3).style.right).toBe("");
    });

    it("keeps the empty state at the view's start", () => {
        const empty = render(
            <DataGrid.Root columns={columns} rows={[]} direction="rtl">
                <DataGrid.Grid>
                    <DataGrid.Header />
                    <DataGrid.Body />
                    <DataGrid.Empty />
                </DataGrid.Grid>
            </DataGrid.Root>,
        ).container.querySelector<HTMLElement>('[data-grid-part="empty"]');
        expect(empty?.style.right).toBe("0px");
        expect(empty?.style.left).toBe("");
    });

    it("follows its prop: the parts and the engine's insets change sides", () => {
        const { container, rerender } = render(<Grid />);
        const inset = cellAt(container, 1, 0).style.left;
        rerender(<Grid direction="rtl" />);
        expect(root(container)).toHaveAttribute("dir", "rtl");
        expect(cellAt(container, 1, 0).style.left).toBe("");
        expect(cellAt(container, 1, 0).style.right).toBe(inset);
        expect(cellAt(container, 1, 3).style.left).toBe("");
        expect(cellAt(container, 1, 3).style.right).toMatch(/px$/);
        rerender(<Grid />);
        expect(root(container)).not.toHaveAttribute("dir");
        expect(cellAt(container, 1, 0).style.right).toBe("");
        expect(cellAt(container, 1, 0).style.left).toBe(inset);
    });
});

describe("the root's dir (the epic review)", () => {
    it("is rendered from the direction given, on the server too", () => {
        const html = (direction?: GridDirection) =>
            renderToString(
                <DataGrid.Root
                    columns={columns}
                    rows={[]}
                    direction={direction}
                    data-testid="root"
                />,
            );
        expect(html("rtl")).toMatch(/dir="rtl"/);
        expect(html()).not.toMatch(/dir=/);
    });

    it("follows a direction set by command, and drops it taken back", () => {
        function Commands() {
            const { model } = useDataGrid();
            return (
                <>
                    <button
                        type="button"
                        data-testid="rtl"
                        onClick={() =>
                            model.run("direction.set", { direction: "rtl" })
                        }
                    />
                    <button
                        type="button"
                        data-testid="page"
                        onClick={() =>
                            model.run("direction.set", { direction: null })
                        }
                    />
                </>
            );
        }
        const { container, getByTestId } = render(
            <DataGrid.Root columns={columns} rows={[]}>
                <Commands />
            </DataGrid.Root>,
        );
        expect(root(container)).not.toHaveAttribute("dir");
        fireEvent.click(getByTestId("rtl"));
        expect(root(container)).toHaveAttribute("dir", "rtl");
        fireEvent.click(getByTestId("page"));
        expect(root(container)).not.toHaveAttribute("dir");
    });
});
