<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import { h, type VNodeChild } from "vue";
import { formatMoney } from "../_kit/data";
import {
    ITEM_HEADER,
    ITEM_ROW,
    type Item,
    itemsHeight,
    type Order,
} from "./orders";
import * as styles from "./styles";

// An order's items: a grid of its own in the detail (its own active cell, keys and focus). A grid
// nested in another is in the tab order only while the orders grid's active cell is in its row:
// Tab goes from that row into its items, and Shift+Tab comes back.

const DataGrid = typedDataGrid<Item>();

defineProps<{ order: Order }>();

const itemColumns: Column<Item, VNodeChild>[] = [
    { key: "product", name: "Product", width: 150 },
    { key: "quantity", name: "Qty", width: 56 },
    {
        key: "price",
        name: "Price",
        width: 90,
        renderCell: ({ row }) =>
            h("span", { class: styles.money }, formatMoney(row.price)),
    },
    {
        key: "subtotal",
        name: "Subtotal",
        width: 100,
        renderCell: ({ row }) =>
            h(
                "span",
                { class: styles.money },
                formatMoney(row.quantity * row.price),
            ),
    },
];
const ITEMS_WIDTH = itemColumns.reduce((sum, column) => sum + column.width, 2);
</script>

<template>
    <DataGrid.Root
        :columns="itemColumns"
        :rows="order.items"
        :row-height="ITEM_ROW"
        :header-row-height="ITEM_HEADER"
        :class="styles.innerRoot"
        :style="{
            width: `${ITEMS_WIDTH}px`,
            height: `${itemsHeight(order)}px`,
        }"
    >
        <DataGrid.Grid :aria-label="`Items of order ${order.id}`">
            <DataGrid.Header :class="styles.innerHeader">
                <DataGrid.HeaderRow :class="styles.innerHeaderRow">
                    <DataGrid.HeaderCells v-slot="{ cell }">
                        <DataGrid.HeaderCell
                            :cell="cell"
                            :class="styles.innerHeaderCell"
                        />
                    </DataGrid.HeaderCells>
                </DataGrid.HeaderRow>
            </DataGrid.Header>
            <DataGrid.Body>
                <DataGrid.Rows v-slot="{ row }">
                    <DataGrid.Row :row="row" :class="styles.innerRow">
                        <DataGrid.Cells v-slot="{ cell }">
                            <DataGrid.Cell
                                :cell="cell"
                                :class="styles.innerCell"
                            />
                        </DataGrid.Cells>
                    </DataGrid.Row>
                </DataGrid.Rows>
            </DataGrid.Body>
        </DataGrid.Grid>
    </DataGrid.Root>
</template>
