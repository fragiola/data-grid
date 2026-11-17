<script setup lang="ts">
import {
    type CellEditEvent,
    type Column,
    typedDataGrid,
} from "@fragiola/data-grid-vue";
import { h, ref, shallowRef, type VNodeChild } from "vue";
import {
    budgetedTasks,
    type BudgetedTask as Row,
    withField,
} from "../_kit/budgeted-tasks";
import { formatMoney } from "../_kit/data";
import AmountEditor from "./amount-editor.vue";
import DateEditor from "./date-editor.vue";
import StatusEditor from "./status-editor.vue";
import * as styles from "./styles";
import TextEditor from "./text-editor.vue";

// Tasks edited in place: the grid edits a cell (the keys, the draft, the commit), the editors are
// the app's (a text field, a number, a select, a date: the `*-editor.vue` files, each given the
// edit, its draft and the ways to change, commit and cancel it, its look by its caller's `class`)
// and so is the data: each commit is told, and the app writes it into its rows.

const DataGrid = typedDataGrid<Row>();

const initialRows = budgetedTasks(120);

const columns: Column<Row, VNodeChild>[] = [
    {
        key: "name",
        name: "Task",
        width: 220,
        editable: true,
        renderEditCell: (edit) =>
            h(TextEditor<Row>, { edit, class: styles.editor }),
    },
    { key: "project", name: "Project", width: 120 },
    {
        key: "budget",
        name: "Budget",
        width: 120,
        // a completed task's budget is closed
        editable: (row) => row.status !== "Completed",
        renderCell: ({ row }) =>
            h(
                "span",
                { class: styles.budget(row.status) },
                formatMoney(row.budget),
            ),
        renderEditCell: (edit) =>
            h(AmountEditor<Row>, { edit, class: styles.editor }),
    },
    {
        key: "status",
        name: "Status",
        width: 160,
        editable: true,
        renderEditCell: (edit) =>
            h(StatusEditor<Row>, { edit, class: styles.select }),
    },
    {
        key: "due",
        name: "Due",
        width: 150,
        editable: true,
        renderEditCell: (edit) =>
            h(DateEditor<Row>, { edit, class: styles.editor }),
    },
    { key: "assignee", name: "Assignee", width: 120 },
];

// the app's rows: the grid never writes them, a commit is told
const rows = shallowRef<readonly Row[]>(initialRows);
const announcement = ref("");

const rowKey = (row: Row) => row.id;

function onCellEdit(edit: CellEditEvent<Row>) {
    const next = withField(edit.row, edit.columnKey, edit.value);
    const column = columns[edit.columnIndex];
    if (!next) {
        announcement.value = `${column?.name} of ${edit.row.name} was not saved: not a valid value.`;
        return;
    }
    rows.value = rows.value.map((row) => (row.id === next.id ? next : row));
    announcement.value = `Saved ${column?.name} of ${next.name}.`;
}
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <span>
                <kbd :class="styles.key">Enter</kbd>
                <kbd :class="styles.key">F2</kbd> or typing edit;
                <kbd :class="styles.key">Enter</kbd>
                <kbd :class="styles.key">Tab</kbd> save,
                <kbd :class="styles.key">Esc</kbd> cancels
            </span>
            <!-- the app's live region: a polite status, its text the app's own -->
            <span role="status" :class="styles.status">{{ announcement }}</span>
        </div>
        <DataGrid.Root
            :columns="columns"
            :rows="rows"
            :row-key="rowKey"
            :row-height="38"
            :on-cell-edit="onCellEdit"
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
                        <DataGrid.Row :row="row" :class="styles.row(row)">
                            <DataGrid.Cells v-slot="{ cell }">
                                <DataGrid.Cell
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
