import { act, fireEvent, render } from "@testing-library/react";
import { createRef, useState } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
    type Column,
    DataGrid,
    type RowDetailState,
    type RowKey,
    useDataGrid,
} from "../src";

// Row details (Epic #41, M1–M4): `Root` maps the expansion (controlled or not) and `detailHeight`
// onto the model; `DataGrid.RowDetail` renders inside its row, after its cells, only while the
// row is expanded: one cell spanning every column, sticky at the view's start (the engine writes
// its `left`), below the row's own height. A grid without expanded rows renders as before.

interface Row {
    id: string;
    total: number;
}

const rows: Row[] = Array.from({ length: 50 }, (_, i) => ({
    id: `r${i}`,
    total: i,
}));

const columns: Column<Row>[] = Array.from({ length: 6 }, (_, i) => ({
    key: `c${i}`,
    name: `C${i}`,
    width: 100,
}));

/** The structural style keys a detail may carry (AGENTS.md, the primitive contract). */
const DETAIL_STRUCTURAL = new Set([
    "position",
    "left",
    "display",
    "margin-top",
    "margin-left",
    "flex-shrink",
    "width",
    "height",
    "box-sizing",
]);

beforeAll(() => {
    for (const [property, size] of [
        ["clientWidth", 400],
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

type GridProps = {
    table?: boolean;
    cells?: Column<Row>[];
    expandedRowKeys?: readonly RowKey[];
    defaultExpandedRowKeys?: readonly RowKey[];
    onExpandedRowKeysChange?: (keys: readonly RowKey[]) => void;
    detailHeight?: number | ((row: Row) => number);
    detail?: Partial<DataGrid.RowDetailProps>;
    withDetail?: boolean;
};

/** A button that toggles its row, as an app's expander cell would. */
function Toggle({ rowIndex }: { rowIndex: number }) {
    const { model } = useDataGrid<Row>();
    return (
        <button
            type="button"
            data-testid={`toggle-${rowIndex}`}
            onClick={() => model.run("expanded-rows.toggle", { rowIndex })}
        />
    );
}

function Grid({
    table = false,
    cells = columns,
    withDetail = true,
    detail,
    ...props
}: GridProps) {
    return (
        <DataGrid.Root
            columns={cells}
            rows={rows}
            rowKey={(row) => row.id}
            rowHeight={20}
            {...props}
        >
            <DataGrid.Grid render={table ? <table /> : undefined}>
                <DataGrid.Body render={table ? <tbody /> : undefined}>
                    <DataGrid.Rows<Row>>
                        {(row) => (
                            <DataGrid.Row
                                row={row}
                                render={table ? <tr /> : undefined}
                                className={(state) =>
                                    state.expanded ? "open" : undefined
                                }
                            >
                                <DataGrid.Cells<Row>>
                                    {(cell) => (
                                        <DataGrid.Cell
                                            cell={cell}
                                            render={table ? <td /> : undefined}
                                        >
                                            {cell.columnIndex === 0 ? (
                                                <Toggle
                                                    rowIndex={cell.rowIndex}
                                                />
                                            ) : null}
                                        </DataGrid.Cell>
                                    )}
                                </DataGrid.Cells>
                                {withDetail ? (
                                    <DataGrid.RowDetail
                                        render={table ? <td /> : undefined}
                                        {...detail}
                                    >
                                        <p
                                            data-testid={`detail-${row.rowIndex}`}
                                        >
                                            {row.row?.id}
                                        </p>
                                    </DataGrid.RowDetail>
                                ) : null}
                            </DataGrid.Row>
                        )}
                    </DataGrid.Rows>
                </DataGrid.Body>
            </DataGrid.Grid>
        </DataGrid.Root>
    );
}

const rowElement = (container: HTMLElement, rowIndex: number) =>
    container.querySelector<HTMLElement>(
        `[data-grid-part="row"][data-row-index="${rowIndex}"]`,
    );
const detailOf = (container: HTMLElement, rowIndex: number) =>
    container.querySelector<HTMLElement>(
        `[data-grid-part="row-detail"][data-row-index="${rowIndex}"]`,
    );

describe("DataGrid.RowDetail", () => {
    it("renders nothing, and changes nothing, while no row is expanded", () => {
        const { container } = render(<Grid />);
        expect(
            container.querySelector('[data-grid-part="row-detail"]'),
        ).toBeNull();
        expect(container.querySelector("[data-expanded]")).toBeNull();
        const row = rowElement(container, 1);
        expect(row?.style.height).toBe("20px");
        const without = render(<Grid withDetail={false} />).container;
        expect(rowElement(without, 1)?.getAttribute("style")).toBe(
            row?.getAttribute("style"),
        );
    });

    it("renders below its cells while the row is expanded, uncontrolled", () => {
        const onChange = vi.fn();
        const { container, getByTestId } = render(
            <Grid detailHeight={100} onExpandedRowKeysChange={onChange} />,
        );
        fireEvent.click(getByTestId("toggle-2"));
        expect(onChange).toHaveBeenLastCalledWith(["r2"]);
        const row = rowElement(container, 2);
        const detail = detailOf(container, 2);
        expect(row?.hasAttribute("data-expanded")).toBe(true);
        expect(row?.className).toBe("open");
        // the row's box holds its detail; its cells keep their own height
        expect(row?.style.height).toBe("120px");
        expect(
            row?.querySelector<HTMLElement>('[data-grid-part="cell"]')?.style
                .height,
        ).toBe("20px");
        expect(rowElement(container, 3)?.style.top).toBe("160px");
        // after its cells, in its row
        expect(row?.lastElementChild).toBe(detail);
        expect(detail?.textContent).toBe("r2");
        expect(detail?.style.position).toBe("sticky");
        expect(detail?.style.marginTop).toBe("20px");
        expect(detail?.style.width).toBe("400px");
        expect(detail?.style.height).toBe("100px");
        // the engine's inset: the view's start
        expect(detail?.style.left).toBe("0px");
        fireEvent.click(getByTestId("toggle-2"));
        expect(detailOf(container, 2)).toBeNull();
        expect(rowElement(container, 2)?.hasAttribute("data-expanded")).toBe(
            false,
        );
        expect(onChange).toHaveBeenLastCalledWith([]);
    });

    it("is one cell of its row spanning every column, with no row count change", () => {
        const { container } = render(<Grid defaultExpandedRowKeys={["r1"]} />);
        const grid = container.querySelector('[data-grid-part="grid"]');
        const detail = detailOf(container, 1);
        expect(detail?.getAttribute("role")).toBe("gridcell");
        expect(detail?.getAttribute("aria-colindex")).toBe("1");
        expect(detail?.getAttribute("aria-colspan")).toBe("6");
        expect(detail?.hasAttribute("data-column-index")).toBe(false);
        expect(detail?.hasAttribute("aria-label")).toBe(false);
        expect(grid?.getAttribute("aria-rowcount")).toBe("51");
        // the header row first: row 2 is the fourth, as without a detail
        expect(rowElement(container, 2)?.getAttribute("aria-rowindex")).toBe(
            "4",
        );
    });

    it("follows the controlled keys, and asks for a toggle", () => {
        function Controlled() {
            const [keys, setKeys] = useState<readonly RowKey[]>(["r0"]);
            return (
                <Grid
                    expandedRowKeys={keys}
                    onExpandedRowKeysChange={setKeys}
                />
            );
        }
        const { container, getByTestId } = render(<Controlled />);
        expect(detailOf(container, 0)).not.toBeNull();
        fireEvent.click(getByTestId("toggle-3"));
        expect(detailOf(container, 3)).not.toBeNull();
        fireEvent.click(getByTestId("toggle-0"));
        expect(detailOf(container, 0)).toBeNull();
    });

    it("stays as the parent holds it when the parent declines", () => {
        const onChange = vi.fn();
        const { container, getByTestId } = render(
            <Grid expandedRowKeys={[]} onExpandedRowKeysChange={onChange} />,
        );
        fireEvent.click(getByTestId("toggle-1"));
        expect(onChange).toHaveBeenCalledWith(["r1"]);
        expect(detailOf(container, 1)).toBeNull();
    });

    it("takes its height from its row", () => {
        const { container } = render(
            <Grid
                defaultExpandedRowKeys={["r4"]}
                detailHeight={(row) => 50 + row.total}
            />,
        );
        expect(detailOf(container, 4)?.style.height).toBe("54px");
        expect(rowElement(container, 4)?.style.height).toBe("74px");
    });

    it("follows the primitive contract: render, ref, className and style functions", () => {
        const ref = createRef<HTMLElement>();
        const { container } = render(
            <Grid
                table
                defaultExpandedRowKeys={["r1"]}
                detail={{
                    ref,
                    className: (state: RowDetailState) => `d${state.height}`,
                    style: () => ({
                        left: 99,
                        top: 5,
                        marginTop: 1,
                        color: "red",
                    }),
                    "aria-label": "details",
                }}
                detailHeight={80}
            />,
        );
        const detail = detailOf(container, 1);
        expect(detail?.tagName).toBe("TD");
        expect(detail?.getAttribute("colspan")).toBe("6");
        expect(ref.current).toBe(detail);
        expect(detail?.className).toBe("d80");
        expect(detail?.getAttribute("aria-label")).toBe("details");
        // structural keys win, the engine's inset stays, the consumer's colour is merged in
        expect(detail?.style.marginTop).toBe("20px");
        expect(detail?.style.left).toBe("0px");
        expect(detail?.style.top).toBe("");
        expect(detail?.style.color).toBe("red");
        expect(detail?.style.display).toBe("block");
    });

    it("applies only structural inline style, pinned columns too", () => {
        const pinnedColumns: Column<Row>[] = columns.map((column, i) =>
            i === 0 ? { ...column, pinned: "start" } : column,
        );
        for (const cells of [columns, pinnedColumns]) {
            const { container, unmount } = render(
                <Grid cells={cells} defaultExpandedRowKeys={["r1"]} />,
            );
            const detail = detailOf(container, 1);
            expect(detail).not.toBeNull();
            for (const property of Array.from(detail?.style ?? [])) {
                expect(DETAIL_STRUCTURAL.has(property), property).toBe(true);
            }
            if (cells === pinnedColumns) {
                // from the row's start, before the pinned cells, never shrunk by the flex row
                expect(detail?.style.marginLeft).toBe("-100px");
                expect(detail?.style.flexShrink).toBe("0");
            } else {
                expect(detail?.style.marginLeft).toBe("");
            }
            unmount();
        }
    });

    it("leaves the grid's keys alone inside a detail", () => {
        const { container } = render(<Grid defaultExpandedRowKeys={["r0"]} />);
        const cell = container.querySelector<HTMLElement>(
            '[data-row-index="1"][data-column-index="1"]',
        );
        act(() => cell?.focus());
        const inside = container.querySelector<HTMLElement>(
            '[data-testid="detail-0"]',
        );
        const event = new KeyboardEvent("keydown", {
            key: "ArrowDown",
            bubbles: true,
            cancelable: true,
        });
        act(() => {
            inside?.dispatchEvent(event);
        });
        expect(event.defaultPrevented).toBe(false);
        expect(
            container
                .querySelector('[data-active][data-grid-part="cell"]')
                ?.getAttribute("data-row-index"),
        ).toBe("1");
    });
});
