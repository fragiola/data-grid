<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { h, type VNodeChild } from "vue";
import { hash, type Person, people } from "../_kit/data";
import * as styles from "./styles";

// cell navigation is a feature the grid installs: the keys, the active cell and the tab stop
const features = [navigation()] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Person, typeof features>();

const rows = people(100_000);

/** How many lines of notes a row has: its height follows. */
const lines = (index: number) => 1 + hash(index + 99, 4);

/** A row's height in pixels, from its index: the grid sums these to place every row. */
const rowHeight = (index: number) => 16 + lines(index) * 20;

const NOTES = [
    "Prefers asynchronous reviews.",
    "Owns the release checklist this quarter.",
    "Mentoring two new hires.",
    "On call next week.",
];

const columns: Column<Person, VNodeChild>[] = [
    { key: "id", name: "#", width: 80 },
    { key: "name", name: "Name", width: 180 },
    { key: "team", name: "Team", width: 120 },
    {
        key: "notes",
        name: "Notes",
        width: 360,
        renderCell: ({ rowIndex }) =>
            NOTES.slice(0, lines(rowIndex)).map((note) =>
                h("span", { key: note, class: styles.note }, note),
            ),
    },
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
            :row-height="rowHeight"
            :class="styles.root"
        >
            <DataGrid.Grid aria-label="People and notes" :class="styles.grid">
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
