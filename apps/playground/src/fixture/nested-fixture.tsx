import { type Column, DataGrid } from "@fragiola/data-grid-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// The unstyled nested grid Playwright drives (#17): an outer grid of orders whose "Items" cells
// each hold an inner grid. Every cell says which grid it belongs to (`data-grid-name`), so a spec
// can tell an outer cell from an inner one at the same indexes. An inner grid is in the tab order
// only while the outer cell holding it is active (Epic #89, E5.2); `?ownTabStop=1` gives each one
// a tab stop of its own.

const ownTabStop =
    new URLSearchParams(location.search).get("ownTabStop") === "1";

interface Item {
    name: string;
    quantity: number;
}

interface Order {
    id: number;
    customer: string;
    items: Item[];
}

const orders: Order[] = Array.from({ length: 50 }, (_, index) => ({
    id: index + 1,
    customer: `Customer ${index + 1}`,
    items: Array.from({ length: 3 + (index % 4) }, (_, item) => ({
        name: `Item ${index + 1}.${item + 1}`,
        quantity: 1 + ((index + item) % 5),
    })),
}));

const itemColumns: Column<Item>[] = [
    { key: "name", name: "Item", width: 140 },
    { key: "quantity", name: "Qty", width: 60 },
];

function Items({ order }: { order: Order }) {
    return (
        <DataGrid.Root
            columns={itemColumns}
            rows={order.items}
            rowHeight={24}
            headerRowHeight={24}
            style={{ width: 220, height: 104 }}
            ownTabStop={ownTabStop}
        >
            <DataGrid.Grid aria-label={`Items of order ${order.id}`}>
                <DataGrid.Header style={{ background: "white" }} />
                <DataGrid.Body>
                    <DataGrid.Rows<Item>>
                        {(row) => (
                            <DataGrid.Row row={row}>
                                <DataGrid.Cells<Item>>
                                    {(cell) => (
                                        <DataGrid.Cell
                                            cell={cell}
                                            data-grid-name="inner"
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

const orderColumns: Column<Order>[] = [
    { key: "id", name: "#", width: 60 },
    { key: "customer", name: "Customer", width: 160 },
    {
        key: "items",
        name: "Items",
        width: 240,
        renderCell: ({ row }) => <Items order={row} />,
    },
    {
        key: "count",
        name: "Count",
        width: 80,
        getValue: (row) => row.items.length,
    },
];

function Fixture() {
    return (
        <>
            <button type="button" data-testid="before">
                before
            </button>
            <DataGrid.Root
                columns={orderColumns}
                rows={orders}
                rowHeight={120}
                data-testid="outer"
                style={{ width: 700, height: 520 }}
            >
                <DataGrid.Grid aria-label="Orders">
                    <DataGrid.Header style={{ background: "white" }} />
                    <DataGrid.Body>
                        <DataGrid.Rows<Order>>
                            {(row) => (
                                <DataGrid.Row row={row}>
                                    <DataGrid.Cells<Order>>
                                        {(cell) => (
                                            <DataGrid.Cell
                                                cell={cell}
                                                data-grid-name="outer"
                                            />
                                        )}
                                    </DataGrid.Cells>
                                </DataGrid.Row>
                            )}
                        </DataGrid.Rows>
                    </DataGrid.Body>
                </DataGrid.Grid>
            </DataGrid.Root>
            <button type="button" data-testid="after">
                after
            </button>
        </>
    );
}

export function mountNestedFixture() {
    const root = document.getElementById("root");
    if (!root) throw new Error("#root is missing");
    createRoot(root).render(
        <StrictMode>
            <Fixture />
        </StrictMode>,
    );
}
