<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import type { VNodeChild } from "vue";
import { formatMoney, type Person, people } from "../_kit/data";
import * as styles from "./styles";

// The parts typed by the row type: a template cannot pass `Person` as a type argument.
const DataGrid = typedDataGrid<Person>();

const rows = people(10_000);

const columns: Column<Person, VNodeChild>[] = [
    { key: "id", name: "#", width: 72 },
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
    <!--
        Every part takes `as`: here each one becomes the table element it stands for. The grid
        keeps role="grid" (an interactive table), and the primitives set the structural style that
        lets table parts be positioned like any other element.
    -->
    <div :class="styles.frame">
        <DataGrid.Root
            :columns="columns"
            :rows="rows"
            :row-key="rowKey"
            :row-height="36"
            :class="styles.root"
        >
            <DataGrid.Grid
                aria-label="People"
                as="table"
                :class="styles.grid"
            >
                <DataGrid.Header as="thead" :class="styles.header">
                    <DataGrid.HeaderRow as="tr" :class="styles.headerRow">
                        <DataGrid.HeaderCells v-slot="{ cell }">
                            <DataGrid.HeaderCell
                                :cell="cell"
                                as="th"
                                :class="styles.headerCell"
                            />
                        </DataGrid.HeaderCells>
                    </DataGrid.HeaderRow>
                </DataGrid.Header>
                <DataGrid.Body as="tbody">
                    <DataGrid.Rows v-slot="{ row }">
                        <DataGrid.Row
                            :row="row"
                            as="tr"
                            :class="styles.row(row)"
                        >
                            <DataGrid.Cells v-slot="{ cell }">
                                <DataGrid.Cell
                                    :cell="cell"
                                    as="td"
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
