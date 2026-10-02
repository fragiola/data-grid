"use client";

import { type Column, DataGrid, useGridView } from "@fragiola/data-grid-react";
import { formatMoney, hash, person } from "../_kit/data";
import * as styles from "./styles";

interface Item {
    product: string;
    quantity: number;
    price: number;
}

interface Order {
    id: number;
    customer: string;
    items: Item[];
}

const PRODUCTS = [
    "Keyboard",
    "Monitor",
    "Dock",
    "Webcam",
    "Headset",
    "Chair",
    "Lamp",
    "Cable",
];

const orders: Order[] = Array.from({ length: 200 }, (_, index) => ({
    id: 1001 + index,
    customer: person(index).name,
    items: Array.from({ length: 2 + hash(index + 3, 5) }, (_, item) => ({
        product: PRODUCTS[hash(index * 11 + item, PRODUCTS.length)] ?? "Cable",
        quantity: 1 + hash(index * 13 + item, 4),
        price: 20 + hash(index * 17 + item, 30) * 10,
    })),
}));

const total = (order: Order) =>
    order.items.reduce((sum, item) => sum + item.quantity * item.price, 0);

const itemColumns: Column<Item>[] = [
    { key: "product", name: "Product", width: 130 },
    { key: "quantity", name: "Qty", width: 56 },
    {
        key: "price",
        name: "Price",
        width: 90,
        renderCell: ({ row }) => (
            <span className={styles.money}>{formatMoney(row.price)}</span>
        ),
    },
];

/**
 * An order's items: a grid of its own, nested in the order's cell. Every grid is a tab stop, so
 * Tab would visit each rendered order's items; this one stays in the tab order only while the
 * orders grid's active cell is the one holding it (a `tabIndex` of the app's overrides the
 * grid's), and Tab goes from that cell into its items.
 */
function Items({
    order,
    rowIndex,
    columnIndex,
}: {
    order: Order;
    rowIndex: number;
    columnIndex: number;
}) {
    // the orders grid's view: this component renders inside its cell, outside the items' root
    const { active } = useGridView();
    const reachable =
        active?.rowIndex === rowIndex && active.columnIndex === columnIndex;
    const tabIndex = reachable ? undefined : -1;
    return (
        <DataGrid.Root
            columns={itemColumns}
            rows={order.items}
            rowHeight={24}
            headerRowHeight={26}
            className={styles.innerRoot}
        >
            <DataGrid.Grid
                aria-label={`Items of order ${order.id}`}
                tabIndex={tabIndex}
            >
                <DataGrid.Header className={styles.innerHeader}>
                    <DataGrid.HeaderRow className={styles.innerHeaderRow}>
                        <DataGrid.HeaderCells<Item>>
                            {(cell) => (
                                <DataGrid.HeaderCell
                                    cell={cell}
                                    tabIndex={tabIndex}
                                    className={styles.innerHeaderCell}
                                />
                            )}
                        </DataGrid.HeaderCells>
                    </DataGrid.HeaderRow>
                </DataGrid.Header>
                <DataGrid.Body>
                    <DataGrid.Rows<Item>>
                        {(row) => (
                            <DataGrid.Row row={row} className={styles.innerRow}>
                                <DataGrid.Cells<Item>>
                                    {(cell) => (
                                        <DataGrid.Cell
                                            cell={cell}
                                            tabIndex={tabIndex}
                                            className={styles.innerCell}
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
    { key: "id", name: "Order", width: 90 },
    { key: "customer", name: "Customer", width: 180 },
    {
        key: "items",
        name: "Items",
        width: 320,
        renderCell: ({ row, rowIndex, columnIndex }) => (
            <Items order={row} rowIndex={rowIndex} columnIndex={columnIndex} />
        ),
    },
    {
        key: "total",
        name: "Total",
        width: 120,
        renderCell: ({ row }) => (
            <span className={styles.money}>{formatMoney(total(row))}</span>
        ),
    },
];

export default function NestedGrid() {
    return (
        <div className={styles.frame}>
            <DataGrid.Root
                columns={orderColumns}
                rows={orders}
                rowKey={(row) => row.id}
                // tall rows: each holds a grid of up to four visible items
                rowHeight={124}
                className={styles.root}
            >
                <DataGrid.Grid aria-label="Orders" className={styles.grid}>
                    <DataGrid.Header className={styles.header}>
                        <DataGrid.HeaderRow className={styles.headerRow}>
                            <DataGrid.HeaderCells<Order>>
                                {(cell) => (
                                    <DataGrid.HeaderCell
                                        cell={cell}
                                        className={styles.headerCell}
                                    />
                                )}
                            </DataGrid.HeaderCells>
                        </DataGrid.HeaderRow>
                    </DataGrid.Header>
                    <DataGrid.Body>
                        <DataGrid.Rows<Order>>
                            {(row) => (
                                <DataGrid.Row row={row} className={styles.row}>
                                    <DataGrid.Cells<Order>>
                                        {(cell) => (
                                            <DataGrid.Cell
                                                cell={cell}
                                                className={styles.cellFor(
                                                    cell.column.key,
                                                )}
                                            />
                                        )}
                                    </DataGrid.Cells>
                                </DataGrid.Row>
                            )}
                        </DataGrid.Rows>
                    </DataGrid.Body>
                </DataGrid.Grid>
            </DataGrid.Root>
        </div>
    );
}
