<script setup lang="ts">
import {
    type Column,
    type RowMove,
    typedDataGrid,
} from "@fragiola/data-grid-vue";
import { columnPinning } from "@fragiola/data-grid-vue/column-pinning";
import { useLocalRows } from "@fragiola/data-grid-vue/local";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { sorting } from "@fragiola/data-grid-vue/sorting";
import { ArrowDown, ArrowUp, RotateCcw, Search } from "@lucide/vue";
import { computed, h, shallowRef, type VNodeChild } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { Input } from "#/components/atoms/fields";
import { type Task, tasks } from "../_kit/tasks";
import Handle from "./handle.vue";
import * as styles from "./styles";

// the features the grid installs: sorting (without it, a sortable column never sorts), cell
// navigation (the keys, the active cell, the tab stop), pinned columns (without it, every column
// scrolls)
const features = [sorting(), navigation(), columnPinning()] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Task, typeof features>();

const backlog = tasks(200);

// "#" is the task's place in the backlog: the app's own order, which a drag or the keys change
const columns: Column<Task, VNodeChild>[] = [
    { key: "rank", name: "#", width: 84, pinned: "start" },
    { key: "name", name: "Task", width: 220, sortable: true },
    { key: "project", name: "Project", width: 130, sortable: true },
    { key: "priority", name: "Priority", width: 110 },
    { key: "status", name: "Status", width: 130 },
    { key: "assignee", name: "Assignee", width: 120 },
    { key: "due", name: "Due", width: 120, sortable: true },
];

/** What the live region says of a move: the app's words, from its own rows. */
function describeMove(rows: readonly Task[], move: RowMove): string {
    const task = rows[move.fromIndex];
    return task
        ? `Moved ${task.name} to position ${move.toIndex + 1} of ${rows.length}.`
        : "";
}

// the app's rows, in its own order: the grid never orders them, it tells each move
const rows = shallowRef<readonly Task[]>(backlog);
const announcement = shallowRef("");
// searched and sorted in memory; a move lands beside the row it was dropped on, searched too
const local = useLocalRows(rows, columns);
const sorted = computed(() => local.sort.columns.length > 0);
// each task's place in the backlog, searched or sorted alike
const ranks = computed(
    () => new Map(rows.value.map((task, index) => [task.id, index + 1])),
);

const searchInset = {
    start: h(Search, { "aria-hidden": "true", class: styles.icon }),
};

const rowKey = (row: Task) => row.id;

function setSearch(event: Event) {
    if (event.target instanceof HTMLInputElement) {
        local.filter.setSearch(event.target.value);
    }
}

function resetOrder() {
    rows.value = backlog;
    announcement.value = "Backlog back in its first order.";
}

function onRowMove(move: RowMove) {
    announcement.value = describeMove(local.rows, move);
    rows.value = local.moveRow(move);
}
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <Input.Template.Simple
                aria-label="Search every column"
                placeholder="Search"
                :value="local.filter.search"
                :inset="searchInset"
                :class="styles.search"
                @input="setSearch"
            />
            <span>
                Drag a handle, or <kbd :class="styles.key">Ctrl/⌘</kbd
                ><kbd :class="styles.key">Shift</kbd
                ><kbd :class="styles.key">↑</kbd
                ><kbd :class="styles.key">↓</kbd> on a row
            </span>
            <!-- the app's live region: a polite status, its text the app's own -->
            <span role="status" :class="styles.status">{{
                sorted
                    ? "Sorted rows keep the sort's order: clear it to reorder."
                    : announcement
            }}</span>
            <Clickable.Button
                v-if="sorted"
                size="sm"
                variant="outline"
                @click="local.sort.clear()"
            >
                Clear sort
            </Clickable.Button>
            <Clickable.Button
                size="sm"
                variant="outline"
                :disabled="rows === backlog"
                @click="resetOrder"
            >
                <RotateCcw aria-hidden="true" />
                Reset order
            </Clickable.Button>
        </div>
        <DataGrid.Root
            :features="features"
            v-bind="local.props"
            :columns="columns"
            :row-key="rowKey"
            :row-height="38"
            :on-row-move="onRowMove"
            :class="styles.root"
        >
            <DataGrid.Grid aria-label="Backlog" :class="styles.grid">
                <DataGrid.Header :class="styles.header">
                    <DataGrid.HeaderRow :class="styles.headerRow">
                        <DataGrid.HeaderCells v-slot="{ cell }">
                            <DataGrid.HeaderCell
                                :cell="cell"
                                :class="styles.headerCell"
                            >
                                <!-- `children` is the cell's content (the column's name) -->
                                <template #render="{ props, state, children }">
                                    <div v-bind="props">
                                        <component :is="children" />
                                        <ArrowUp
                                            v-if="
                                                state.sortDirection ===
                                                'ascending'
                                            "
                                            aria-hidden="true"
                                            :class="styles.sortIcon"
                                        />
                                        <ArrowDown
                                            v-else-if="
                                                state.sortDirection ===
                                                'descending'
                                            "
                                            aria-hidden="true"
                                            :class="styles.sortIcon"
                                        />
                                    </div>
                                </template>
                            </DataGrid.HeaderCell>
                        </DataGrid.HeaderCells>
                    </DataGrid.HeaderRow>
                </DataGrid.Header>
                <DataGrid.Body>
                    <DataGrid.Rows v-slot="{ row }">
                        <DataGrid.Row :row="row" :class="styles.row(row)">
                            <DataGrid.Cells v-slot="{ cell }">
                                <!-- the rank's cell: the handle, then the task's place -->
                                <DataGrid.Cell
                                    v-if="cell.column.key === 'rank'"
                                    :cell="cell"
                                    :class="styles.cell(cell)"
                                >
                                    <Handle :cell="cell" />
                                    <span :class="styles.rank">{{
                                        cell.row && ranks.get(cell.row.id)
                                    }}</span>
                                </DataGrid.Cell>
                                <DataGrid.Cell
                                    v-else
                                    :cell="cell"
                                    :class="styles.cell(cell)"
                                />
                            </DataGrid.Cells>
                        </DataGrid.Row>
                    </DataGrid.Rows>
                </DataGrid.Body>
            </DataGrid.Grid>
        </DataGrid.Root>
    </div>
</template>
