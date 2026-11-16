<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import type { VNodeChild } from "vue";
import { formatMoney, type Person, people } from "../_kit/data";
import * as styles from "./styles";

// The parts typed by the row type: a template cannot pass `Person` as a type argument.
const DataGrid = typedDataGrid<Person>();

const rows = people(100);

const columns: Column<Person, VNodeChild>[] = [
    { key: "id", name: "#", width: 64 },
    { key: "name", name: "Name", width: 180 },
    { key: "email", name: "Email", width: 260 },
    { key: "city", name: "City", width: 140 },
    { key: "team", name: "Team", width: 120 },
    {
        key: "salary",
        name: "Salary",
        width: 120,
        renderCell: ({ row }) => formatMoney(row.salary),
    },
];

const rowKey = (row: Person) => row.id;
</script>

<template>
    <div :class="styles.frame">
        <DataGrid.Root
            :columns="columns"
            :rows="rows"
            :row-key="rowKey"
            :row-height="36"
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
    </div>
</template>
