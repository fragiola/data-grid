<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { onMounted, ref, shallowRef, type VNodeChild } from "vue";
import { formatMoney, formatNumber, type Person, person } from "../_kit/data";
import { createFakeApi } from "../_kit/fake-api";
import * as styles from "./styles";

// cell navigation is a feature the grid installs: the keys, the active cell and the tab stop
const features = [navigation()] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Person, typeof features>();

const TOTAL = 1_000;
const PAGE = 50;

const columns: Column<Person, VNodeChild>[] = [
    { key: "id", name: "#", width: 72 },
    { key: "name", name: "Name", width: 180 },
    { key: "email", name: "Email", width: 260 },
    { key: "city", name: "City", width: 140 },
    {
        key: "salary",
        name: "Salary",
        width: 120,
        renderCell: ({ row }) => formatMoney(row.salary),
    },
];

const api = createFakeApi(600);
const rows = shallowRef<Person[]>([]);
const loading = ref(false);
// what is in flight and what comes next: plain state, read by the callback the grid calls
const next = { page: 0, busy: false, done: false };

function loadMore() {
    if (next.busy || next.done) return;
    next.busy = true;
    loading.value = true;
    api.fetchPage(next.page, PAGE, TOTAL, person).then((page) => {
        next.page += 1;
        next.busy = false;
        next.done = page.length < PAGE || next.page * PAGE >= TOTAL;
        rows.value = [...rows.value, ...page];
        loading.value = false;
    });
}

// the first page
onMounted(loadMore);

const rowKey = (row: Person) => row.id;
</script>

<template>
    <div :class="styles.frame">
        <!-- the grid tells when the view's last row is within 15 rows of the end -->
        <DataGrid.Root
            :features="features"
            :columns="columns"
            :rows="rows"
            :row-key="rowKey"
            :row-height="36"
            :on-rows-end-reached="loadMore"
            :end-reached-threshold="15"
            :class="styles.root"
        >
            <DataGrid.Grid aria-label="People" :class="styles.grid">
                <DataGrid.Header :class="styles.header">
                    <DataGrid.HeaderRow :class="styles.headerRow">
                        <DataGrid.HeaderCells v-slot="{ cell }">
                            <DataGrid.HeaderCell
                                :cell="cell"
                                :class="styles.headerCell"
                            />
                        </DataGrid.HeaderCells>
                    </DataGrid.HeaderRow>
                </DataGrid.Header>
                <DataGrid.Body>
                    <DataGrid.Rows v-slot="{ row }">
                        <DataGrid.Row :row="row" :class="styles.row(row)">
                            <DataGrid.Cells v-slot="{ cell }">
                                <DataGrid.Cell
                                    :cell="cell"
                                    :class="styles.cell"
                                />
                            </DataGrid.Cells>
                        </DataGrid.Row>
                    </DataGrid.Rows>
                </DataGrid.Body>
            </DataGrid.Grid>
        </DataGrid.Root>
        <p :class="styles.status" role="status" data-testid="status">
            <span v-if="loading" :class="styles.spinner" aria-hidden="true" />
            <span>
                Loaded
                <span :class="styles.figure" data-testid="loaded">{{
                    formatNumber(rows.length)
                }}</span>
                of {{ formatNumber(TOTAL) }} rows{{
                    loading ? " · loading the next page…" : ""
                }}
            </span>
        </p>
    </div>
</template>
