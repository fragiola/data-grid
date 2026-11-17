<script setup lang="ts">
import {
    type AxisWindow,
    type Column,
    typedDataGrid,
    useDataGridRef,
} from "@fragiola/data-grid-vue";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { onBeforeUnmount, type VNodeChild } from "vue";
import { formatMoney, type Person, person } from "../_kit/data";
import { createFakeApi } from "../_kit/fake-api";
import { createRangeCache } from "../_kit/range-cache";
import RequestLog from "./request-log.vue";
import * as styles from "./styles";

// cell navigation is a feature the grid installs: the keys, the active cell and the tab stop
const features = [navigation()] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Person, typeof features>();

const TOTAL = 1_000_000;
const BLOCK = 100;

const columns: Column<Person, VNodeChild>[] = [
    { key: "id", name: "#", width: 96 },
    { key: "name", name: "Name", width: 180 },
    { key: "email", name: "Email", width: 280 },
    { key: "city", name: "City", width: 140 },
    {
        key: "salary",
        name: "Salary",
        width: 120,
        renderCell: ({ row }) => formatMoney(row.salary),
    },
];

const api = createFakeApi(500);
// blocks of 100 rows, each requested once: the app's cache, not the grid's
const cache = createRangeCache(TOTAL, BLOCK, (start, end) =>
    api.fetchRows(start, end, person),
);
const gridRef = useDataGridRef<Person>();
// rows that arrive replace their placeholders: the grid is told which, and renders them only
// if they are on screen. The getter stays the same
const unsubscribe = cache.subscribe((range) =>
    gridRef.current?.model.run("rows.changed", range),
);
// load what is rendered once the scroll settles: a thumb dragged across the dataset asks
// only for where it stops, never for the rows it passed
let timer: ReturnType<typeof setTimeout> | undefined;
// a request still waiting when the example goes away is not sent
onBeforeUnmount(() => {
    unsubscribe();
    clearTimeout(timer);
});

function loadRendered({ rendered }: AxisWindow) {
    clearTimeout(timer);
    timer = setTimeout(() => cache.ensure(rendered.start, rendered.end), 80);
}

const rowKey = (row: Person) => row.id;
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.layout">
            <DataGrid.Root
                :features="features"
                :columns="columns"
                :row-count="TOTAL"
                :get-row="cache.get"
                :grid-ref="gridRef"
                :row-key="rowKey"
                :row-height="36"
                :on-row-window-change="loadRendered"
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
                                    >
                                        <!-- a loaded cell keeps its default content -->
                                        <template v-if="!cell.loaded" #default>
                                            <span :class="styles.skeleton" />
                                        </template>
                                    </DataGrid.Cell>
                                </DataGrid.Cells>
                            </DataGrid.Row>
                        </DataGrid.Rows>
                    </DataGrid.Body>
                </DataGrid.Grid>
            </DataGrid.Root>
            <RequestLog :api="api" :block="BLOCK" :total="TOTAL" />
        </div>
    </div>
</template>
