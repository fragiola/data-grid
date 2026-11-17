<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import { columnPinning } from "@fragiola/data-grid-vue/column-pinning";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { h, ref, useId, type VNodeChild } from "vue";
import { Switch } from "#/components/ui/switch";
import { formatMoney } from "../_kit/data";
import Expander from "./expander.vue";
import { detailHeight, type Order, orders, total } from "./orders";
import OrdersGrid from "./orders-grid.vue";
import * as styles from "./styles";

// the features the grid installs: cell navigation (the keys, the active cell, the tab stop), pinned
// columns (without it, every column scrolls)
const features = [navigation(), columnPinning()] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Order, typeof features>();

const orderColumns: Column<Order, VNodeChild>[] = [
    {
        key: "expand",
        width: 44,
        pinned: "start",
        renderCell: ({ row, rowIndex }) =>
            h(Expander, { order: row, rowIndex }),
    },
    { key: "id", name: "Order", width: 84, pinned: "start" },
    { key: "customer", name: "Customer", width: 170 },
    {
        key: "status",
        name: "Status",
        width: 110,
        renderCell: ({ row }) =>
            h("span", { class: styles.status(row.status) }, row.status),
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
        renderCell: ({ row }) =>
            h("span", { class: styles.money }, formatMoney(total(row))),
    },
    { key: "placed", name: "Placed", width: 110 },
    { key: "city", name: "Ship to", width: 130 },
    { key: "carrier", name: "Carrier", width: 100 },
    { key: "payment", name: "Payment", width: 100 },
    { key: "email", name: "Email", width: 260 },
];

const EXPANDED = [1001];

// the details' heights: computed from each order, or measured from what they render
const measured = ref(false);
const measuredLabel = useId();

const rowKey = (row: Order) => row.id;
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <span :class="styles.option">
                <Switch.Root
                    v-model="measured"
                    :aria-labelledby="measuredLabel"
                >
                    <Switch.Thumb />
                </Switch.Root>
                <span :id="measuredLabel">Measure the details</span>
            </span>
        </div>
        <!--
            each order's detail is as tall as its items need: computed from the order, or
            measured once rendered ("auto", about 160px until then)
        -->
        <DataGrid.Root
            :features="features"
            :columns="orderColumns"
            :rows="orders"
            :row-key="rowKey"
            :row-height="40"
            :detail-height="measured ? 'auto' : detailHeight"
            :estimated-detail-height="160"
            :default-expanded-row-keys="EXPANDED"
            :class="styles.root"
        >
            <OrdersGrid />
        </DataGrid.Root>
    </div>
</template>
