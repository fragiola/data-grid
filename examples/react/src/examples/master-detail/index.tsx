"use client";

import {
    type CellPosition,
    type Column,
    DataGrid,
    useDataGrid,
    useGridView,
} from "@fragiola/data-grid-react";
import { ChevronRight } from "lucide-react";
import type * as React from "react";
import { useId, useState } from "react";
import { Switch } from "#/components/ui/switch";
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
    email: string;
    city: string;
    placed: string;
    status: string;
    carrier: string;
    payment: string;
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
const STATUSES = ["Placed", "Packed", "Shipped", "Delivered"];
const CARRIERS = ["Post", "Courier", "Freight", "Pickup"];
const PAYMENTS = ["Card", "Invoice", "Transfer"];

const orders: Order[] = Array.from({ length: 200 }, (_, index) => {
    const customer = person(index);
    return {
        id: 1001 + index,
        customer: customer.name,
        email: customer.email,
        city: customer.city,
        placed: `2026-${String(1 + hash(index + 5, 9)).padStart(2, "0")}-${String(1 + hash(index + 9, 28)).padStart(2, "0")}`,
        status: STATUSES[hash(index + 1, STATUSES.length)] ?? "Placed",
        carrier: CARRIERS[hash(index + 2, CARRIERS.length)] ?? "Post",
        payment: PAYMENTS[hash(index + 4, PAYMENTS.length)] ?? "Card",
        items: Array.from({ length: 2 + hash(index + 3, 5) }, (_, item) => ({
            product:
                PRODUCTS[hash(index * 11 + item, PRODUCTS.length)] ?? "Cable",
            quantity: 1 + hash(index * 13 + item, 4),
            price: 20 + hash(index * 17 + item, 30) * 10,
        })),
    };
});

const total = (order: Order) =>
    order.items.reduce((sum, item) => sum + item.quantity * item.price, 0);

const ITEM_ROW = 24;
const ITEM_HEADER = 26;
/** the items grid as tall as its rows (and its border) */
const itemsHeight = (order: Order) =>
    ITEM_HEADER + order.items.length * ITEM_ROW + 2;
/** a detail's height, from its order: the taller of the summary and the items, and padding */
const detailHeight = (order: Order) => 24 + Math.max(112, itemsHeight(order));

const itemColumns: Column<Item>[] = [
    { key: "product", name: "Product", width: 150 },
    { key: "quantity", name: "Qty", width: 56 },
    {
        key: "price",
        name: "Price",
        width: 90,
        renderCell: ({ row }) => (
            <span className={styles.money}>{formatMoney(row.price)}</span>
        ),
    },
    {
        key: "subtotal",
        name: "Subtotal",
        width: 100,
        renderCell: ({ row }) => (
            <span className={styles.money}>
                {formatMoney(row.quantity * row.price)}
            </span>
        ),
    },
];
const ITEMS_WIDTH = itemColumns.reduce((sum, column) => sum + column.width, 2);

/** Expands or collapses an order: the app's control, the grid's state (M1). */
function useToggle(rowIndex: number) {
    const { model } = useDataGrid<Order>();
    return {
        expanded: model.is("row-expanded", { rowIndex }),
        toggle: () => model.run("expanded-rows.toggle", { rowIndex }),
    };
}

/**
 * The expander in an order's first cell. The cell is the tab stop (the grid's roving tabindex),
 * so the button never is: a click toggles, and Enter or Space on the cell does (`onExpanderKey`).
 */
function Expander({ order, rowIndex }: { order: Order; rowIndex: number }) {
    const { expanded, toggle } = useToggle(rowIndex);
    return (
        <button
            type="button"
            tabIndex={-1}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Hide" : "Show"} the items of order ${order.id}`}
            className={styles.expander}
            onClick={toggle}
        >
            <ChevronRight size={14} aria-hidden />
        </button>
    );
}

/** Enter or Space on an order's expander cell toggles it (and is not the browser's scroll). */
function onExpanderKey(event: React.KeyboardEvent, toggle: () => void) {
    if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
        event.preventDefault();
        toggle();
    }
}

const orderColumns: Column<Order>[] = [
    {
        key: "expand",
        width: 44,
        pinned: "start",
        renderCell: ({ row, rowIndex }) => (
            <Expander order={row} rowIndex={rowIndex} />
        ),
    },
    { key: "id", name: "Order", width: 84, pinned: "start" },
    { key: "customer", name: "Customer", width: 170 },
    {
        key: "status",
        name: "Status",
        width: 110,
        renderCell: ({ row }) => (
            <span className={styles.status(row.status)}>{row.status}</span>
        ),
    },
    {
        key: "count",
        name: "Items",
        width: 70,
        getValue: (row) => row.items.length,
    },
    {
        key: "total",
        name: "Total",
        width: 110,
        renderCell: ({ row }) => (
            <span className={styles.money}>{formatMoney(total(row))}</span>
        ),
    },
    { key: "placed", name: "Placed", width: 110 },
    { key: "city", name: "Ship to", width: 130 },
    { key: "carrier", name: "Carrier", width: 100 },
    { key: "payment", name: "Payment", width: 100 },
    { key: "email", name: "Email", width: 260 },
];

/** An order at a glance: the detail's first part, any component of the app's. */
function Summary({ order }: { order: Order }) {
    return (
        <div className={styles.summary}>
            <span className={styles.summaryTitle}>{order.customer}</span>
            <span className={styles.summaryLine}>
                Order <span className={styles.summaryValue}>#{order.id}</span>
            </span>
            <span className={styles.summaryLine}>
                Items{" "}
                <span className={styles.summaryValue}>
                    {order.items.length}
                </span>
            </span>
            <span className={styles.summaryLine}>
                Total{" "}
                <span className={styles.summaryValue}>
                    {formatMoney(total(order))}
                </span>
            </span>
            <span className={styles.summaryLine}>
                Status{" "}
                <span className={styles.summaryValue}>{order.status}</span>
            </span>
        </div>
    );
}

/**
 * An order's items: a grid of its own in the detail (its own active cell, keys and focus). Every
 * grid is a tab stop, so this one stays in the tab order only while its order's row holds the
 * orders grid's active cell (a `tabIndex` of the app's overrides the grid's): Tab goes from that
 * row into its items, and Shift+Tab comes back.
 */
function Items({ order, rowIndex }: { order: Order; rowIndex: number }) {
    // the orders grid's view: the detail renders in its row, outside the items' root
    const { active } = useGridView();
    const tabIndex = active?.rowIndex === rowIndex ? undefined : -1;
    return (
        <DataGrid.Root
            columns={itemColumns}
            rows={order.items}
            rowHeight={ITEM_ROW}
            headerRowHeight={ITEM_HEADER}
            className={styles.innerRoot}
            style={{ width: ITEMS_WIDTH, height: itemsHeight(order) }}
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

/** Escape in a detail returns to its order: the row's expander cell takes focus. */
function backToOrder(
    event: React.KeyboardEvent<HTMLElement>,
    at: CellPosition,
) {
    if (event.key !== "Escape") return;
    const cell = event.currentTarget
        .closest('[data-grid-part="row"]')
        ?.querySelector<HTMLElement>(
            `[data-grid-part="cell"][data-column-index="${at.columnIndex}"]`,
        );
    if (cell) {
        event.preventDefault();
        cell.focus();
    }
}

function Orders() {
    const { model } = useDataGrid<Order>();
    return (
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
                                        className={styles.cell}
                                        onKeyDown={
                                            cell.column.key === "expand"
                                                ? (event) =>
                                                      onExpanderKey(event, () =>
                                                          model.run(
                                                              "expanded-rows.toggle",
                                                              {
                                                                  rowIndex:
                                                                      cell.rowIndex,
                                                              },
                                                          ),
                                                      )
                                                : undefined
                                        }
                                    />
                                )}
                            </DataGrid.Cells>
                            <DataGrid.RowDetail
                                className={styles.detail}
                                onKeyDown={(event) =>
                                    backToOrder(event, {
                                        rowIndex: row.rowIndex,
                                        columnIndex: 0,
                                    })
                                }
                            >
                                {row.row ? (
                                    // the part is a block: the layout inside it is the app's
                                    <div className={styles.detailContent}>
                                        <Summary order={row.row} />
                                        <Items
                                            order={row.row}
                                            rowIndex={row.rowIndex}
                                        />
                                    </div>
                                ) : null}
                            </DataGrid.RowDetail>
                        </DataGrid.Row>
                    )}
                </DataGrid.Rows>
            </DataGrid.Body>
        </DataGrid.Grid>
    );
}

export default function MasterDetail() {
    // the details' heights: computed from each order, or measured from what they render
    const [measured, setMeasured] = useState(false);
    const measuredLabel = useId();
    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <span className={styles.option}>
                    <Switch.Root
                        aria-labelledby={measuredLabel}
                        checked={measured}
                        onCheckedChange={setMeasured}
                    >
                        <Switch.Thumb />
                    </Switch.Root>
                    <span id={measuredLabel}>Measure the details</span>
                </span>
            </div>
            <DataGrid.Root
                columns={orderColumns}
                rows={orders}
                rowKey={(row) => row.id}
                rowHeight={40}
                // each order's detail is as tall as its items need: computed from the order, or
                // measured once rendered ("auto", about 160px until then)
                detailHeight={measured ? "auto" : detailHeight}
                estimatedDetailHeight={160}
                defaultExpandedRowKeys={[1001]}
                className={styles.root}
            >
                <Orders />
            </DataGrid.Root>
        </div>
    );
}
