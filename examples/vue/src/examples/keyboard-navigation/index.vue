<script setup lang="ts">
import {
    type CellPosition,
    type Column,
    typedDataGrid,
} from "@fragiola/data-grid-vue";
import { computed, ref, type VNodeChild } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { formatMoney, formatNumber, type Person, people } from "../_kit/data";
import * as styles from "./styles";

// The parts typed by the row type: a template cannot pass `Person` as a type argument.
const DataGrid = typedDataGrid<Person>();

const rows = people(5_000);

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

const KEYS = [
    "←↑→↓",
    "Home",
    "End",
    "Ctrl+Home",
    "Ctrl+End",
    "PageUp",
    "PageDown",
];

// controlled: the grid asks (onActivePositionChange), the app decides
const active = ref<CellPosition | null>({ rowIndex: 0, columnIndex: 1 });
const column = computed(() =>
    active.value ? columns[active.value.columnIndex] : undefined,
);

const rowKey = (row: Person) => row.id;
const setActive = (position: CellPosition | null) => {
    active.value = position;
};
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.panel">
            <p data-testid="active">
                <template v-if="active && column">
                    Active:
                    <span :class="styles.figure">{{
                        active.rowIndex < 0
                            ? "header"
                            : `row ${formatNumber(active.rowIndex + 1)}`
                    }}</span
                    >, {{ column.name }}
                </template>
                <template v-else>No active cell</template>
            </p>
            <span :class="styles.keys">
                <kbd v-for="key in KEYS" :key="key" :class="styles.key">{{
                    key
                }}</kbd>
            </span>
            <span :class="styles.actions">
                <Clickable.Button
                    size="sm"
                    variant="outline"
                    @click="setActive({ rowIndex: 0, columnIndex: 0 })"
                >
                    First row
                </Clickable.Button>
                <Clickable.Button
                    size="sm"
                    variant="outline"
                    @click="
                        setActive({
                            rowIndex: rows.length - 1,
                            columnIndex: columns.length - 1,
                        })
                    "
                >
                    Last row
                </Clickable.Button>
            </span>
        </div>
        <DataGrid.Root
            :columns="columns"
            :rows="rows"
            :row-key="rowKey"
            :row-height="36"
            :active-position="active"
            :on-active-position-change="setActive"
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
