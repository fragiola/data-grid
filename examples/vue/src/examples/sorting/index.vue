<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import { useLocalRows } from "@fragiola/data-grid-vue/local";
import { sorting } from "@fragiola/data-grid-vue/sorting";
import type { VNodeChild } from "vue";
import { formatMoney, type Person, people } from "../_kit/data";
import HeaderCell from "./header-cell.vue";
import * as styles from "./styles";

// sorting is a feature the grid installs: without it, a sortable column never sorts
const features = [sorting()] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Person, typeof features>();

const all = people(200);

function lastName(person: Person): string {
    return person.name.split(" ").at(-1) ?? person.name;
}

const columns: Column<Person, VNodeChild>[] = [
    {
        key: "name",
        name: "Name",
        width: 180,
        sortable: true,
        // its own order: by last name (the others compare their values by type)
        compare: (a, b) => lastName(a).localeCompare(lastName(b)),
    },
    { key: "email", name: "Email", width: 260 },
    { key: "city", name: "City", width: 140, sortable: true },
    { key: "team", name: "Team", width: 130, sortable: true },
    {
        key: "salary",
        name: "Salary",
        width: 130,
        sortable: true,
        renderCell: ({ row }) => formatMoney(row.salary),
    },
];

// the rows in memory, sorted by one composable: its props give the grid the sorted rows and its
// sort (a click, Enter or Space on a header cell; Ctrl or ⌘ adds a column)
const local = useLocalRows(all, columns, {
    defaultSortColumns: [{ columnKey: "team", direction: "ascending" }],
});

const rowKey = (row: Person) => row.id;
</script>

<template>
    <div :class="styles.frame">
        <DataGrid.Root
            :features="features"
            :columns="columns"
            :row-key="rowKey"
            :row-height="36"
            :class="styles.root"
            v-bind="local.props"
        >
            <DataGrid.Grid aria-label="People" :class="styles.grid">
                <DataGrid.Header :class="styles.header">
                    <DataGrid.HeaderRow :class="styles.headerRow">
                        <DataGrid.HeaderCells v-slot="{ cell }">
                            <HeaderCell :cell="cell" />
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
