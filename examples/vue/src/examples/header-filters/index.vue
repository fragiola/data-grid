<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import { filtering } from "@fragiola/data-grid-vue/filtering";
import { useLocalRows } from "@fragiola/data-grid-vue/local";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { sorting } from "@fragiola/data-grid-vue/sorting";
import { ref, useId, type VNodeChild } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { Switch } from "#/components/ui/switch";
import { type Task, tasks } from "../_kit/tasks";
import Filter from "./filter.vue";
import HeaderCell from "./header-cell.vue";
import * as styles from "./styles";

// the features the grid installs: sorting (without it, a sortable column never sorts), cell
// navigation (the keys, the active cell, the tab stop)
// and filtering (the column filters): `useLocalRows` applies them to the rows, the grid's
// model holds them
const features = [sorting(), filtering(), navigation()] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Task, typeof features>();

const ROWS = tasks(1_000);

const columns: Column<Task, VNodeChild>[] = [
    { key: "id", name: "#", width: 64, sortable: true },
    { key: "name", name: "Task", width: 220, sortable: true },
    { key: "project", name: "Project", width: 130, sortable: true },
    { key: "priority", name: "Priority", width: 120, sortable: true },
    { key: "status", name: "Status", width: 140, sortable: true },
    { key: "assignee", name: "Assignee", width: 120, sortable: true },
    {
        key: "effectiveness",
        name: "Rating",
        width: 120,
        sortable: true,
        renderCell: ({ row }) => "★".repeat(row.effectiveness),
        // its own filter: a minimum rating, not an equal one
        filter: (value, minimum) =>
            typeof value === "number" &&
            typeof minimum === "number" &&
            value >= minimum,
    },
];

// The filters are controls inside the header cells. The grid keeps a header cell holding
// controls one tab stop: a click on a control (or Enter, F2) hands it the keys, Tab moves among
// a cell's controls and Escape gives them back; a click on a control is never a sort. The rows
// are filtered and sorted in memory by `useLocalRows`, the filters' values kept by it.

const local = useLocalRows(ROWS, columns, { features: features });
const shown = ref(true);
const shownLabel = useId();

const rowKey = (row: Task) => row.id;
const setShown = (value: boolean) => {
    shown.value = value;
};
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <span :class="styles.toggle">
                <Switch.Root
                    :aria-labelledby="shownLabel"
                    :model-value="shown"
                    @update:model-value="setShown"
                >
                    <Switch.Thumb />
                </Switch.Root>
                <span :id="shownLabel">Filters</span>
            </span>
            <Clickable.Button
                size="sm"
                variant="outline"
                @click="local.filter.clear()"
            >
                Clear filters
            </Clickable.Button>
            <span :class="styles.count" data-testid="count">
                {{ local.filteredCount }} of {{ ROWS.length }} tasks
            </span>
        </div>
        <!-- the header row's height: room for the filter under the name -->
        <DataGrid.Root
            :features="features"
            v-bind="local.props"
            :columns="columns"
            :row-key="rowKey"
            :row-height="36"
            :header-row-height="shown ? 72 : 36"
            :class="styles.root"
        >
            <DataGrid.Grid aria-label="Tasks" :class="styles.grid">
                <DataGrid.Header :class="styles.header">
                    <DataGrid.HeaderRow :class="styles.headerRow">
                        <DataGrid.HeaderCells v-slot="{ cell }">
                            <HeaderCell :cell="cell">
                                <Filter
                                    v-if="shown"
                                    :cell="cell"
                                    :value="local.filter.values[cell.key]"
                                    @change="
                                        (value) =>
                                            local.filter.set(cell.key, value)
                                    "
                                />
                            </HeaderCell>
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
                <DataGrid.Empty :class="styles.empty">
                    No task matches these filters.
                </DataGrid.Empty>
            </DataGrid.Grid>
        </DataGrid.Root>
    </div>
</template>
