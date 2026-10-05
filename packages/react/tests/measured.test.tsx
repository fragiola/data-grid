import { act, render } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    type Column,
    createDataGridRef,
    DataGrid,
    type DetailHeight,
    type GridDirection,
    type RowHeight,
    type RowInfo,
    useRow,
} from "../src";
import { cellAt, rowAt, stubViewportSize, tags } from "./helpers";

// Measured heights (Epic #86, E2.2): with `rowHeight="auto"` a loaded row has no height of its
// own: a grid whose one area its cells share (each at its inline start margin, as tall as the
// tallest), its detail in the area below, registered for the engine to read. A row not loaded
// keeps the estimate's height. With `detailHeight="auto"` a detail has no height either. A grid
// of given heights renders as before.

interface Row {
    id: number;
}

const rows: Row[] = Array.from({ length: 200 }, (_, id) => ({ id }));

const columns: Column<Row>[] = Array.from({ length: 6 }, (_, i) => ({
    key: `c${i}`,
    name: `C${i}`,
    width: 100,
    ...(i === 0 ? { pinned: "start" as const } : {}),
}));

/** A row's content height in these tests: 20 to 50 by index. */
const heightOf = (rowIndex: number) => 20 + (rowIndex % 4) * 10;

/** The structural style keys a measured row's cell may carry. */
const CELL_STRUCTURAL = new Set([
    "position",
    "grid-area",
    "grid-row-start",
    "grid-column-start",
    "grid-row-end",
    "grid-column-end",
    "margin-left",
    "margin-right",
    "width",
    "box-sizing",
    "left",
    "right",
]);

stubViewportSize(400, 235);

// jsdom lays nothing out: a row's box is its content's height by index, a detail's 120
const original = HTMLElement.prototype.getBoundingClientRect;
beforeAll(() => {
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
        const part = this.dataset.gridPart;
        const index = Number(this.dataset.rowIndex);
        if (part === "row-detail") return DOMRect.fromRect({ height: 120 });
        if (part === "row") {
            const detail = this.querySelector('[data-grid-part="row-detail"]');
            return DOMRect.fromRect({
                height: heightOf(index) + (detail ? 120 : 0),
            });
        }
        return original.call(this);
    };
});
afterAll(() => {
    HTMLElement.prototype.getBoundingClientRect = original;
});

function Grid({
    table = false,
    rowHeight = "auto",
    detailHeight,
    expanded = [],
    direction,
    loaded = true,
}: {
    table?: boolean;
    rowHeight?: RowHeight;
    detailHeight?: DetailHeight<Row>;
    expanded?: readonly number[];
    direction?: GridDirection;
    loaded?: boolean;
}) {
    const tag = tags(table);
    return (
        <DataGrid.Root
            columns={columns}
            {...(loaded
                ? { rows }
                : {
                      rowCount: rows.length,
                      getRow: (index: number) =>
                          index === 3 ? undefined : rows[index],
                  })}
            rowKey={(row) => row.id}
            rowHeight={rowHeight}
            estimatedRowHeight={30}
            detailHeight={detailHeight}
            estimatedDetailHeight={80}
            defaultExpandedRowKeys={expanded}
            direction={direction}
        >
            <DataGrid.Grid render={tag.grid}>
                <DataGrid.Body render={tag.body}>
                    <DataGrid.Rows<Row>>
                        {(row) => (
                            <DataGrid.Row
                                row={row}
                                render={tag.row}
                                style={{ display: "block", top: 7 }}
                            >
                                <DataGrid.Cells<Row>>
                                    {(cell) => (
                                        <DataGrid.Cell
                                            cell={cell}
                                            render={tag.cell}
                                            style={{
                                                position: "absolute",
                                                gridArea: "3 / 3",
                                                top: 5,
                                                left: 9,
                                                insetInlineStart: 3,
                                                bottom: 2,
                                            }}
                                        />
                                    )}
                                </DataGrid.Cells>
                                <DataGrid.RowDetail render={tag.cell}>
                                    <p>{row.row?.id}</p>
                                </DataGrid.RowDetail>
                            </DataGrid.Row>
                        )}
                    </DataGrid.Rows>
                </DataGrid.Body>
            </DataGrid.Grid>
        </DataGrid.Root>
    );
}

/** Renders, then lets the engine's commit read the rows and render again. */
async function mount(element: React.ReactElement) {
    const result = render(element);
    await act(async () => {});
    return result;
}

describe("measured rows", () => {
    for (const table of [false, true]) {
        it(`take their cells' height, laid out end to end (${table ? "table" : "div"})`, async () => {
            const { container } = await mount(<Grid table={table} />);
            const row = rowAt(container, 1);
            expect(row.style.display).toBe("grid");
            expect(row.style.height).toBe("");
            // the consumer's style sits under the structural one
            expect(rowAt(container, 0).style.top).toBe("0px");
            expect(row.style.top).toBe(`${heightOf(0)}px`);
            expect(rowAt(container, 3).style.top).toBe(
                `${heightOf(0) + heightOf(1) + heightOf(2)}px`,
            );
            const cell = cellAt(container, 1, 2);
            expect(cell.style.position).toBe("relative");
            expect(cell.style.gridArea).toBe("1 / 1");
            // at its column's place from the row's start, as an absolute cell's `left`
            expect(
                Number.parseFloat(cell.style.marginLeft) -
                    Number.parseFloat(cellAt(container, 1, 1).style.marginLeft),
            ).toBe(100);
            expect(cell.style.height).toBe("");
            // pinned: sticky in the same area, at its own margin (0)
            expect(cell.style.left).toBe("");
            const pinned = cellAt(container, 1, 0);
            expect(pinned.style.position).toBe("sticky");
            expect(pinned.style.gridArea).toBe("1 / 1");
            for (const element of [cell, pinned]) {
                for (const property of Array.from(element.style)) {
                    expect(CELL_STRUCTURAL.has(property), property).toBe(true);
                }
                // the consumer's insets are dropped: the grid places the cell (a pinned
                // cell's `left` is the engine's)
                for (const inset of [
                    "top",
                    "bottom",
                    "insetInlineStart",
                ] as const) {
                    expect(element.style[inset], inset).toBe("");
                }
            }
        });
    }

    it("place their cells from the right right to left", async () => {
        const { container } = await mount(<Grid direction="rtl" />);
        const cell = cellAt(container, 1, 2);
        expect(
            Number.parseFloat(cell.style.marginRight) -
                Number.parseFloat(cellAt(container, 1, 1).style.marginRight),
        ).toBe(100);
        expect(cell.style.marginLeft).toBe("");
    });

    it("keep the estimate's height for a row not loaded", async () => {
        const { container } = await mount(<Grid loaded={false} />);
        const row = rowAt(container, 3);
        expect(row.dataset.loading).toBe("");
        expect(row.style.height).toBe("30px");
        expect(row.style.display).toBe("flex");
        expect(rowAt(container, 4).style.top).toBe(
            `${heightOf(0) + heightOf(1) + heightOf(2) + 30}px`,
        );
    });

    it("give the hook's props the row's ref only while measured", () => {
        let props: Record<string, unknown> = {};
        function Probe({ row }: { row: RowInfo<Row> }) {
            props = useRow(row).props;
            return null;
        }
        for (const rowHeight of ["auto", 20] as const) {
            const { unmount } = render(
                <DataGrid.Root
                    columns={columns}
                    rows={rows}
                    rowHeight={rowHeight}
                >
                    <DataGrid.Grid>
                        <DataGrid.Body>
                            <DataGrid.Rows<Row>>
                                {(row) => <Probe row={row} />}
                            </DataGrid.Rows>
                        </DataGrid.Body>
                    </DataGrid.Grid>
                </DataGrid.Root>,
            );
            expect(typeof props.ref).toBe(
                rowHeight === "auto" ? "function" : "undefined",
            );
            unmount();
        }
    });

    it("hold a detail in the area below their cells", async () => {
        const { container } = await mount(
            <Grid expanded={[1]} detailHeight="auto" />,
        );
        const detail = container.querySelector<HTMLElement>(
            '[data-grid-part="row-detail"]',
        );
        expect(detail?.style.gridArea).toBe("2 / 1");
        expect(detail?.style.height).toBe("");
        expect(detail?.style.marginTop).toBe("");
        // the row's own height is its element's less its detail's
        expect(rowAt(container, 2).style.top).toBe(
            `${heightOf(0) + heightOf(1) + 120}px`,
        );
    });
});

describe("estimates", () => {
    it("refuse one that is no size above 0 without holding the other sizes back", () => {
        const gridRef = createDataGridRef<Row>();
        const grid = (rowHeight: RowHeight, estimate: number) => (
            <DataGrid.Root
                columns={columns}
                rows={rows}
                rowHeight={rowHeight}
                estimatedRowHeight={estimate}
                gridRef={gridRef}
            >
                <DataGrid.Grid />
            </DataGrid.Root>
        );
        const { rerender } = render(grid("auto", -5));
        const state = () => gridRef.current?.model.state;
        // refused as an option too: the default stays
        expect(state()?.estimatedRowHeight).toBe(35);
        rerender(grid(24, -5));
        expect(state()?.rowHeight).toBe(24);
        expect(state()?.estimatedRowHeight).toBe(35);
        rerender(grid(24, 50));
        expect(state()?.estimatedRowHeight).toBe(50);
    });
});

describe("measured details", () => {
    it("have no height of their own in a row of a given height, and add theirs", async () => {
        const { container } = await mount(
            <Grid rowHeight={20} expanded={[1]} detailHeight="auto" />,
        );
        const detail = container.querySelector<HTMLElement>(
            '[data-grid-part="row-detail"]',
        );
        expect(detail?.style.height).toBe("");
        expect(detail?.style.marginTop).toBe("20px");
        // in a row of pinned cells (flex): its content's height, never the row's
        expect(detail?.style.alignSelf).toBe("flex-start");
        expect(rowAt(container, 1).style.height).toBe(`${20 + 120}px`);
        expect(rowAt(container, 2).style.top).toBe(`${40 + 120}px`);
    });

    it("render as before with a given height", async () => {
        const { container } = await mount(
            <Grid rowHeight={20} expanded={[1]} detailHeight={90} />,
        );
        const detail = container.querySelector<HTMLElement>(
            '[data-grid-part="row-detail"]',
        );
        expect(detail?.style.height).toBe("90px");
        expect(rowAt(container, 1).style.display).toBe("flex");
        expect(rowAt(container, 1).style.height).toBe("110px");
        expect(cellAt(container, 1, 2).style.height).toBe("20px");
        // an absolute cell: its structural `top`, the consumer's `left` its own (as before)
        expect(cellAt(container, 1, 2).style.top).toBe("0px");
        expect(cellAt(container, 1, 2).style.marginLeft).toBe("");
    });
});

describe("the sizes a root sends", () => {
    it("are the three sizes together for a grid of given heights, as before; the rest on their own", () => {
        const gridRef = createDataGridRef<Row>();
        const Plain = ({
            rowHeight,
            summaryRowHeight,
            estimatedRowHeight,
        }: {
            rowHeight: number;
            summaryRowHeight?: number;
            estimatedRowHeight?: number;
        }) => (
            <DataGrid.Root
                columns={columns}
                rows={rows}
                rowHeight={rowHeight}
                summaryRowHeight={summaryRowHeight}
                estimatedRowHeight={estimatedRowHeight}
                gridRef={gridRef}
            />
        );
        const { rerender } = render(<Plain rowHeight={20} />);
        const sent: unknown[] = [];
        gridRef.current?.model.use((ctx, next) => {
            if (ctx.command === "sizes.set") sent.push(ctx.payload);
            return next();
        });
        rerender(<Plain rowHeight={30} />);
        expect(sent).toEqual([
            { rowHeight: 30, headerRowHeight: 35, detailHeight: 300 },
        ]);
        rerender(<Plain rowHeight={30} />);
        expect(sent).toHaveLength(1);
        rerender(
            <Plain
                rowHeight={30}
                summaryRowHeight={40}
                estimatedRowHeight={50}
            />,
        );
        expect(sent.slice(1)).toEqual([
            { summaryRowHeight: 40 },
            { estimatedRowHeight: 50 },
        ]);
    });
});
