<script setup lang="ts">
import {
    type Column,
    type ColumnOrGroup,
    typedDataGrid,
} from "@fragiola/data-grid-vue";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import type { VNodeChild } from "vue";
import { formatMoney, measurement, type Person, people } from "../_kit/data";
import GroupLabel from "./group-label.vue";
import * as styles from "./styles";

// cell navigation is a feature the grid installs: the keys, the active cell and the tab stop
const features = [navigation()] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Person, typeof features>();

const rows = people(1_000);

const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

/** A month's score, one column per month. */
function month(year: number, monthIndex: number): Column<Person, VNodeChild> {
    const columnIndex = (year - 2025) * 12 + monthIndex;
    return {
        key: `${year}-${monthIndex + 1}`,
        name: MONTHS[monthIndex],
        width: 84,
        getValue: (row) => measurement(row.id, columnIndex),
        renderCell: ({ value }) =>
            typeof value === "number" ? value.toFixed(1) : null,
        meta: { numeric: true },
    };
}

/** A quarter: a group of its three months. */
function quarter(
    year: number,
    index: number,
): ColumnOrGroup<Person, VNodeChild> {
    return {
        key: `${year}-q${index + 1}`,
        name: `Q${index + 1} ${year}`,
        children: [0, 1, 2].map((m) => month(year, index * 3 + m)),
    };
}

// a column, two groups of columns, then eight quarters of monthly scores: 2 header rows
const columns: ColumnOrGroup<Person, VNodeChild>[] = [
    { key: "id", name: "#", width: 64, meta: { numeric: true } },
    {
        key: "person",
        name: "Person",
        children: [
            { key: "name", name: "Name", width: 180 },
            { key: "email", name: "Email", width: 260 },
        ],
    },
    {
        key: "work",
        name: "Work",
        children: [
            { key: "team", name: "Team", width: 120 },
            { key: "city", name: "City", width: 140 },
            { key: "joined", name: "Joined", width: 120 },
            {
                key: "salary",
                name: "Salary",
                width: 120,
                renderCell: ({ row }) => formatMoney(row.salary),
                meta: { numeric: true },
            },
        ],
    },
    ...[2025, 2026].flatMap((year) =>
        [0, 1, 2, 3].map((index) => quarter(year, index)),
    ),
];

const rowKey = (row: Person) => row.id;
</script>

<template>
    <div :class="styles.frame">
        <DataGrid.Root
            :features="features"
            :columns="columns"
            :rows="rows"
            :row-key="rowKey"
            :row-height="34"
            :class="styles.root"
        >
            <DataGrid.Grid aria-label="People" :class="styles.grid">
                <DataGrid.Header :class="styles.header">
                    <DataGrid.HeaderRows v-slot="{ row }">
                        <DataGrid.HeaderRow
                            :row="row"
                            :class="styles.headerRow(row)"
                        >
                            <DataGrid.HeaderCells v-slot="{ cell }">
                                <DataGrid.HeaderCell
                                    :cell="cell"
                                    :class="styles.headerCell(cell)"
                                >
                                    <!-- a group's name sticks in view; a column keeps its own content -->
                                    <template v-if="cell.group" #default>
                                        <GroupLabel :cell="cell" />
                                    </template>
                                </DataGrid.HeaderCell>
                            </DataGrid.HeaderCells>
                        </DataGrid.HeaderRow>
                    </DataGrid.HeaderRows>
                </DataGrid.Header>
                <DataGrid.Body>
                    <DataGrid.Rows v-slot="{ row }">
                        <DataGrid.Row :row="row" :class="styles.row(row)">
                            <DataGrid.Cells v-slot="{ cell }">
                                <DataGrid.Cell
                                    :cell="cell"
                                    :class="
                                        cell.column.meta?.numeric
                                            ? styles.numeric
                                            : styles.cell
                                    "
                                />
                            </DataGrid.Cells>
                        </DataGrid.Row>
                    </DataGrid.Rows>
                </DataGrid.Body>
            </DataGrid.Grid>
        </DataGrid.Root>
    </div>
</template>
