<script setup lang="ts">
import {
    type CellEditEvent,
    type CellInfo,
    type Column,
    typedDataGrid,
} from "@fragiola/data-grid-vue";
import { useLocalRows } from "@fragiola/data-grid-vue/local";
import { h, ref, type VNodeChild } from "vue";
import { type Task, tasks } from "../_kit/tasks";
import TextEditor from "../editing/text-editor.vue";
import HeaderCell from "./header-cell.vue";
import SelectAll from "./select-all.vue";
import SelectRow from "./select-row.vue";
import * as styles from "./styles";

// React Data Grid has a renderer for each piece (`renderCheckbox`, `renderSortStatus`,
// `renderCell`, `renderRow`). Here there is nothing else: the checkbox, the sort indicator, a
// cell's and a row's look are the app's markup and classes, from the parts' state and the row.

// The parts typed by the row type: a template cannot pass `Task` as a type argument.
const DataGrid = typedDataGrid<Task>();

const ROWS = tasks(500);
const IDS = ROWS.map((task) => task.id);

const columns: Column<Task, VNodeChild>[] = [
    {
        key: "select",
        width: 44,
        renderHeaderCell: () => h(SelectAll, { rowKeys: IDS }),
        renderCell: ({ row, rowIndex }) =>
            h(SelectRow, { rowIndex, name: row.name }),
    },
    { key: "id", name: "#", width: 64, sortable: true },
    {
        key: "name",
        name: "Title",
        width: 220,
        sortable: true,
        editable: true,
        renderEditCell: (edit) =>
            h(TextEditor<Task>, { edit, class: styles.editor }),
    },
    { key: "priority", name: "Priority", width: 110, sortable: true },
    { key: "status", name: "Status", width: 130, sortable: true },
    { key: "assignee", name: "Assignee", width: 110, sortable: true },
    { key: "due", name: "Due", width: 120, sortable: true },
];

/** A row styled from its data: a completed task. */
const completed = (task: Task | undefined) => task?.status === "Completed";

/** A cell styled from its value: a high priority. */
const highPriority = (cell: CellInfo<Task>) =>
    cell.column.key === "priority" && cell.value === "High";

const rows = ref<readonly Task[]>(ROWS);
const local = useLocalRows(rows, columns);

const rowKey = (row: Task) => row.id;

function onCellEdit({ row, value }: CellEditEvent<Task>) {
    // the app writes the title: the grid never writes a row
    rows.value = rows.value.map((task) =>
        task.id === row.id && typeof value === "string"
            ? { ...task, name: value.trim() || task.name }
            : task,
    );
}
</script>

<template>
    <div :class="styles.frame">
        <DataGrid.Root
            v-bind="local.props"
            :columns="columns"
            :row-key="rowKey"
            :row-height="36"
            row-selection="multiple"
            :on-cell-edit="onCellEdit"
            :class="styles.root"
        >
            <DataGrid.Grid aria-label="Tasks" :class="styles.grid">
                <DataGrid.Header :class="styles.header">
                    <DataGrid.HeaderRow :class="styles.headerRow">
                        <DataGrid.HeaderCells v-slot="{ cell }">
                            <HeaderCell :cell="cell" />
                        </DataGrid.HeaderCells>
                    </DataGrid.HeaderRow>
                </DataGrid.Header>
                <DataGrid.Body>
                    <DataGrid.Rows v-slot="{ row }">
                        <!-- a row styled from its data: a completed task is tinted -->
                        <DataGrid.Row
                            :row="row"
                            :class="styles.row(row, completed(row.row))"
                        >
                            <DataGrid.Cells v-slot="{ cell }">
                                <!-- a cell styled from its value: a high priority stands out -->
                                <DataGrid.Cell
                                    :cell="cell"
                                    :class="styles.cell(cell, highPriority(cell))"
                                />
                            </DataGrid.Cells>
                        </DataGrid.Row>
                    </DataGrid.Rows>
                </DataGrid.Body>
            </DataGrid.Grid>
        </DataGrid.Root>
    </div>
</template>
