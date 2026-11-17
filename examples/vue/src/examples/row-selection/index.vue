<script setup lang="ts">
import {
    type Column,
    type RowKey,
    type RowSelection,
    typedDataGrid,
} from "@fragiola/data-grid-vue";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { rowSelection } from "@fragiola/data-grid-vue/row-selection";
import { h, ref, useId, type VNodeChild } from "vue";
import { Switch } from "#/components/ui/switch";
import { type Task, tasks } from "../_kit/tasks";
import SelectAll from "./select-all.vue";
import SelectRow from "./select-row.vue";
import * as styles from "./styles";

// the features the grid installs: cell navigation (the keys, the active cell, the tab stop), row
// selection
const features = [navigation(), rowSelection()] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Task, typeof features>();

const ROWS = tasks(200);

/** A completed task cannot be selected: the grid skips it in a range and in "select all". */
const isSelectable = (task: Task) => task.status !== "Completed";

/** The rows "select all" covers: the ones that can be selected. */
const SELECTABLE_IDS = ROWS.filter(isSelectable).map((task) => task.id);

const columns: Column<Task, VNodeChild>[] = [
    {
        key: "select",
        width: 48,
        renderHeaderCell: () => h(SelectAll, { rowKeys: SELECTABLE_IDS }),
        renderCell: ({ row, rowIndex }) =>
            h(SelectRow, { rowIndex, name: row.name }),
    },
    { key: "name", name: "Task", width: 240 },
    { key: "status", name: "Status", width: 130 },
    { key: "assignee", name: "Assignee", width: 110 },
    { key: "priority", name: "Priority", width: 100 },
    { key: "due", name: "Due", width: 120 },
];

const mode = ref<RowSelection>("multiple");
// the grid selects; the app keeps the keys (here, to count them)
const selected = ref<readonly RowKey[]>([]);
const modeLabel = useId();

const rowKey = (row: Task) => row.id;
const setSelected = (keys: readonly RowKey[]) => {
    selected.value = keys;
};
const setSingle = (single: boolean) => {
    mode.value = single ? "single" : "multiple";
};
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <span :class="styles.mode">
                <Switch.Root
                    :aria-labelledby="modeLabel"
                    :model-value="mode === 'single'"
                    @update:model-value="setSingle"
                >
                    <Switch.Thumb />
                </Switch.Root>
                <span :id="modeLabel">One at a time</span>
            </span>
            <span>
                <kbd :class="styles.key">Shift</kbd>+<kbd :class="styles.key"
                    >Space</kbd
                >
                a row
            </span>
            <template v-if="mode === 'multiple'">
                <span>
                    <kbd :class="styles.key">Shift</kbd>+<kbd
                        :class="styles.key"
                        >↓</kbd
                    >
                    extend
                </span>
                <span>
                    <kbd :class="styles.key">Ctrl</kbd>+<kbd
                        :class="styles.key"
                        >A</kbd
                    >
                    every row
                </span>
            </template>
            <span :class="styles.count" data-testid="selected-count">
                {{ selected.length }} selected
            </span>
        </div>
        <DataGrid.Root
            :features="features"
            :columns="columns"
            :rows="ROWS"
            :row-key="rowKey"
            :row-height="40"
            :row-selection="mode"
            :is-row-selectable="isSelectable"
            :selected-row-keys="selected"
            :on-selected-row-keys-change="setSelected"
            :class="styles.root"
        >
            <DataGrid.Grid aria-label="Tasks" :class="styles.grid">
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
                        <DataGrid.Row
                            :row="row"
                            :class="
                                styles.row(
                                    row,
                                    row.row !== undefined &&
                                        !isSelectable(row.row),
                                )
                            "
                        >
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
