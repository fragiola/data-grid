import { act, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
    type CellInfo,
    type Column,
    DataGrid,
    type RowKey,
    useGroupToggle,
} from "../src";
import { groupKeyOf, type LocalRowsResult, useLocalRows } from "../src/local";
import { cellAt, root, rowAt, stubViewportSize, tags } from "./helpers";

// Row groups in React (Epic #87, E3.1–E3.2): `useLocalRows` groups by columns and hands the root
// the rows shown with their kinds; the grid is a treegrid, group rows render their value and the
// app's aggregates, the app's toggle and the keys expand them, and a group row selects its rows.

interface Sale {
    id: number;
    country: string;
    city: string;
    amount: number;
}

const sales: Sale[] = [
    { id: 1, country: "France", city: "Paris", amount: 10 },
    { id: 2, country: "Brazil", city: "Recife", amount: 5 },
    { id: 3, country: "France", city: "Lyon", amount: 7 },
    { id: 4, country: "Brazil", city: "Natal", amount: 3 },
];

const columns: Column<Sale>[] = [
    { key: "country", name: "Country", width: 120 },
    { key: "city", name: "City", width: 120 },
    {
        key: "amount",
        name: "Amount",
        width: 100,
        renderGroupCell: ({ value }) => `Σ ${String(value)}`,
    },
];

const aggregates = {
    amount: (rows: readonly Sale[]) =>
        rows.reduce((total, row) => total + row.amount, 0),
};
const rowKey = (row: Sale) => row.id;

const BRAZIL = groupKeyOf([["country", "Brazil"]]);
const FRANCE = groupKeyOf([["country", "France"]]);

stubViewportSize(600, 400);

let latest: LocalRowsResult<Sale> | undefined;

/** The app's toggle: a button in the group row's cell of its column. */
function Toggle({ cell }: { cell: CellInfo<Sale> }) {
    const { state, props } = useGroupToggle(cell);
    if (!state.expandable) return null;
    return (
        <button
            type="button"
            aria-label={state.expanded ? "Collapse" : "Expand"}
            {...props}
        />
    );
}

function Sales({
    groupBy = ["country"],
    table = false,
    expandedGroupKeys,
    onExpandedGroupKeysChange,
    rowSelection,
}: {
    groupBy?: string[];
    table?: boolean;
    expandedGroupKeys?: readonly RowKey[];
    onExpandedGroupKeysChange?: (keys: readonly RowKey[]) => void;
    rowSelection?: "multiple";
}) {
    const local = useLocalRows(sales, columns, {
        groupBy,
        aggregates,
        rowKey,
        expandedGroupKeys,
        onExpandedGroupKeysChange,
    });
    latest = local;
    const tag = tags(table);
    return (
        <DataGrid.Root
            columns={columns}
            rowHeight={20}
            rowSelection={rowSelection}
            {...local.props}
        >
            <DataGrid.Grid render={tag.grid}>
                <DataGrid.Header render={tag.header} />
                <DataGrid.Body render={tag.body}>
                    <DataGrid.Rows<Sale>>
                        {(row) => (
                            <DataGrid.Row row={row} render={tag.row}>
                                <DataGrid.Cells<Sale>>
                                    {(cell) =>
                                        cell.group &&
                                        cell.column.key ===
                                            cell.group.columnKey ? (
                                            <DataGrid.Cell
                                                cell={cell}
                                                render={tag.cell}
                                            >
                                                <Toggle cell={cell} />
                                                {String(cell.value)} (
                                                {cell.group.childCount})
                                            </DataGrid.Cell>
                                        ) : (
                                            <DataGrid.Cell
                                                cell={cell}
                                                render={tag.cell}
                                            />
                                        )
                                    }
                                </DataGrid.Cells>
                            </DataGrid.Row>
                        )}
                    </DataGrid.Rows>
                </DataGrid.Body>
            </DataGrid.Grid>
        </DataGrid.Root>
    );
}

const grid = (container: HTMLElement) =>
    root(container).querySelector('[data-grid-part="grid"]');

const rowCount = (container: HTMLElement) =>
    container.querySelectorAll('[data-grid-part="row"]').length;

describe.each([false, true])("row groups (table: %s)", (table) => {
    it("makes a treegrid of group rows, with their value and aggregates", () => {
        const { container } = render(<Sales table={table} />);
        expect(grid(container)?.getAttribute("role")).toBe("treegrid");
        expect(rowCount(container)).toBe(2);
        const brazil = rowAt(container, 0);
        expect(brazil.hasAttribute("data-group-row")).toBe(true);
        expect(brazil.hasAttribute("data-loading")).toBe(false);
        expect(brazil.hasAttribute("data-group-expanded")).toBe(false);
        expect(brazil.getAttribute("aria-level")).toBe("1");
        expect(brazil.getAttribute("aria-expanded")).toBe("false");
        expect(brazil.getAttribute("aria-setsize")).toBe("2");
        expect(brazil.getAttribute("aria-posinset")).toBe("1");
        expect(brazil.getAttribute("data-depth")).toBe("0");
        expect(cellAt(container, 0, 0).textContent).toBe("Brazil (2)");
        // the column's renderGroupCell, given the aggregate
        expect(cellAt(container, 0, 2).textContent).toBe("Σ 8");
        // a column with no aggregate shows nothing
        expect(cellAt(container, 0, 1).textContent).toBe("");
    });

    it("expands a group by the app's toggle: its rows under it", () => {
        const { container } = render(<Sales table={table} />);
        const toggle = cellAt(container, 1, 0).querySelector("button");
        if (!toggle) throw new Error("no toggle");
        expect(toggle.getAttribute("aria-expanded")).toBe("false");
        act(() => {
            fireEvent.click(toggle);
        });
        expect(latest?.group.expandedKeys).toEqual([FRANCE]);
        expect(rowCount(container)).toBe(4);
        const france = rowAt(container, 1);
        expect(france.getAttribute("aria-expanded")).toBe("true");
        expect(france.hasAttribute("data-group-expanded")).toBe(true);
        const paris = rowAt(container, 2);
        expect(paris.getAttribute("aria-level")).toBe("2");
        expect(paris.hasAttribute("data-group-row")).toBe(false);
        expect(cellAt(container, 2, 1).textContent).toBe("Paris");
        expect(
            cellAt(container, 1, 0).querySelector("button")?.dataset.expanded,
        ).toBe("");
    });

    it("toggles a group row with Enter, and goes up the tree with ←", () => {
        const { container } = render(<Sales table={table} />);
        act(() => {
            cellAt(container, 0, 1).focus();
            fireEvent.click(cellAt(container, 0, 1));
        });
        act(() => {
            fireEvent.keyDown(cellAt(container, 0, 1), { key: "Enter" });
        });
        expect(latest?.group.expandedKeys).toEqual([BRAZIL]);
        expect(rowCount(container)).toBe(4);
        act(() => {
            cellAt(container, 2, 0).focus();
        });
        act(() => {
            fireEvent.keyDown(cellAt(container, 2, 0), { key: "ArrowLeft" });
        });
        expect(document.activeElement).toBe(cellAt(container, 0, 0));
        act(() => {
            fireEvent.keyDown(cellAt(container, 0, 0), { key: "ArrowLeft" });
        });
        expect(latest?.group.expandedKeys).toEqual([]);
        expect(rowCount(container)).toBe(2);
    });

    it("selects a group row's rows", () => {
        const { container } = render(
            <Sales table={table} rowSelection="multiple" />,
        );
        const brazil = rowAt(container, 0);
        expect(brazil.getAttribute("aria-selected")).toBe("false");
        act(() => {
            cellAt(container, 0, 1).focus();
        });
        act(() => {
            fireEvent.keyDown(cellAt(container, 0, 1), {
                key: " ",
                shiftKey: true,
            });
        });
        expect(rowAt(container, 0).getAttribute("aria-selected")).toBe("true");
        expect(rowAt(container, 0).hasAttribute("data-selected")).toBe(true);
    });
});

describe("row groups", () => {
    it("leave a grid without groups as it was: a grid, rows without levels", () => {
        const { container } = render(<Sales groupBy={[]} />);
        expect(grid(container)?.getAttribute("role")).toBe("grid");
        expect(rowCount(container)).toBe(4);
        const row = rowAt(container, 0);
        for (const name of [
            "aria-level",
            "aria-expanded",
            "aria-setsize",
            "aria-posinset",
            "data-depth",
            "data-group-row",
        ]) {
            expect(row.hasAttribute(name), name).toBe(false);
        }
        expect(latest?.props).not.toHaveProperty("getRowMeta");
        expect(cellAt(container, 0, 0).querySelector("button")).toBeNull();
    });

    it("follow controlled keys, and ask for the toggle's", () => {
        const asked = vi.fn();
        function Controlled() {
            const [keys, setKeys] = useState<readonly RowKey[]>([BRAZIL]);
            return (
                <Sales
                    expandedGroupKeys={keys}
                    onExpandedGroupKeysChange={(next) => {
                        asked(next);
                        setKeys(next);
                    }}
                />
            );
        }
        const { container } = render(<Controlled />);
        expect(rowCount(container)).toBe(4);
        const toggle = cellAt(container, 3, 0).querySelector("button");
        act(() => {
            if (toggle) fireEvent.click(toggle);
        });
        expect(asked).toHaveBeenLastCalledWith([BRAZIL, FRANCE]);
        expect(rowCount(container)).toBe(6);
    });

    it("keep the selection by the app's keys once the grouping is off", () => {
        const { container, rerender } = render(
            <Sales rowSelection="multiple" />,
        );
        act(() => {
            cellAt(container, 0, 1).focus();
        });
        act(() => {
            fireEvent.keyDown(cellAt(container, 0, 1), {
                key: " ",
                shiftKey: true,
            });
        });
        // Brazil: the sales 2 and 4
        rerender(<Sales rowSelection="multiple" groupBy={[]} />);
        const second = sales[1];
        if (!second) throw new Error("no sale");
        expect(latest?.props.rowKey?.(second, 1)).toBe(2);
        const selected = [0, 1, 2, 3].map(
            (rowIndex) =>
                rowAt(container, rowIndex).getAttribute("aria-selected") ===
                "true",
        );
        expect(selected).toEqual([false, true, false, true]);
    });

    it("drop the row kinds when getRowMeta is removed from the root", () => {
        const getRowMeta = () => ({ depth: 0 });
        const plain = (props: { meta?: boolean }) => (
            <DataGrid.Root
                columns={columns}
                rows={sales}
                rowHeight={20}
                getRowMeta={props.meta ? getRowMeta : undefined}
            >
                <DataGrid.Grid />
            </DataGrid.Root>
        );
        const { container, rerender } = render(plain({ meta: true }));
        expect(grid(container)?.getAttribute("role")).toBe("treegrid");
        rerender(plain({}));
        expect(grid(container)?.getAttribute("role")).toBe("grid");
    });

    it("nest by two columns, and expand them all", () => {
        const { container } = render(<Sales groupBy={["country", "city"]} />);
        act(() => latest?.group.expandAll());
        // Brazil, Natal, #4, Recife, #2, France, Lyon, #3, Paris, #1
        expect(rowCount(container)).toBe(10);
        expect(rowAt(container, 2).getAttribute("aria-level")).toBe("3");
        act(() => latest?.group.collapseAll());
        expect(rowCount(container)).toBe(2);
    });
});
