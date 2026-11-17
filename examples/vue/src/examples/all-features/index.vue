<script setup lang="ts">
import { repeatedFill } from "@fragiola/data-grid/fill";
import {
    type CellEditEvent,
    type Column,
    type RangeFill,
    type RangePaste,
    typedDataGrid,
    useDataGridRef,
} from "@fragiola/data-grid-vue";
import { useLocalRows } from "@fragiola/data-grid-vue/local";
import { sorting } from "@fragiola/data-grid-vue/sorting";
import { ArrowDown, ArrowUp } from "@lucide/vue";
import { h, ref, shallowRef, type VNodeChild } from "vue";
import {
    type BudgetedTask,
    budgetedTasks,
    withField,
} from "../_kit/budgeted-tasks";
import { formatMoney } from "../_kit/data";
import AmountEditor from "../editing/amount-editor.vue";
import DateEditor from "../editing/date-editor.vue";
import StatusEditor from "../editing/status-editor.vue";
import TextEditor from "../editing/text-editor.vue";
import FillHandle from "./fill-handle.vue";
import Resizer from "./resizer.vue";
import * as styles from "./styles";

// Everything a sheet does, together: cells edited in place, ranges selected, copied as TSV and
// pasted, filled from a handle, rows sorted, the first column pinned and the others resized. The
// grid owns the keys, the pointer and the clipboard; every value is written by the app, through
// one rule (`withField`), whether typed, pasted or filled.

// sorting is a feature the grid installs: without it, a sortable column never sorts
const features = [sorting()] as const;

const DataGrid = typedDataGrid<BudgetedTask, typeof features>();

const columns: Column<BudgetedTask, VNodeChild>[] = [
    {
        key: "name",
        name: "Task",
        width: 220,
        pinned: "start",
        sortable: true,
        resizable: true,
        editable: true,
        renderEditCell: (edit) =>
            h(TextEditor<BudgetedTask>, { edit, class: styles.editor }),
    },
    {
        key: "project",
        name: "Project",
        width: 120,
        sortable: true,
        resizable: true,
    },
    {
        key: "budget",
        name: "Budget",
        width: 120,
        sortable: true,
        resizable: true,
        editable: (task) => task.status !== "Completed",
        renderCell: ({ row }) => formatMoney(row.budget),
        renderEditCell: (edit) =>
            h(AmountEditor<BudgetedTask>, { edit, class: styles.editor }),
    },
    {
        key: "status",
        name: "Status",
        width: 150,
        sortable: true,
        resizable: true,
        editable: true,
        renderEditCell: (edit) =>
            h(StatusEditor<BudgetedTask>, { edit, class: styles.select }),
    },
    {
        key: "due",
        name: "Due",
        width: 140,
        sortable: true,
        resizable: true,
        editable: true,
        renderEditCell: (edit) =>
            h(DateEditor<BudgetedTask>, { edit, class: styles.editor }),
    },
    {
        key: "assignee",
        name: "Assignee",
        width: 120,
        sortable: true,
        resizable: true,
    },
];

/** A change the app writes: a shown row, a column, the value typed, pasted or filled. */
interface Change {
    readonly rowIndex: number;
    readonly columnKey: string;
    readonly value: unknown;
}

// the app's rows: the grid never writes them
const tasks = shallowRef<readonly BudgetedTask[]>(budgetedTasks(300));
const announcement = ref("");
// sorted in memory: the grid's indexes are the rows shown
const local = useLocalRows(tasks, columns);
// the grid's model from outside its root: a fill repeats the values it reads
const gridRef = useDataGridRef<BudgetedTask>();

const taskKey = (task: BudgetedTask) => task.id;

/** Writes changes to the shown rows through the app's one rule, and says what it did. */
function write(changes: readonly Change[], what: string) {
    const byId = new Map<number, BudgetedTask>();
    let refused = 0;
    for (const { rowIndex, columnKey, value } of changes) {
        const shown = local.rows[rowIndex];
        if (!shown) continue;
        const next = withField(byId.get(shown.id) ?? shown, columnKey, value);
        if (next) byId.set(shown.id, next);
        else refused += 1;
    }
    tasks.value = tasks.value.map((task) => byId.get(task.id) ?? task);
    const written = changes.length - refused;
    announcement.value = `${what}: ${written} ${written === 1 ? "cell" : "cells"} written${
        refused > 0 ? `, ${refused} refused` : ""
    }.`;
}

function edited(edit: CellEditEvent<BudgetedTask>) {
    write([edit], `Saved ${columns[edit.columnIndex]?.name}`);
}

function pasted({ range, values }: RangePaste) {
    write(
        values.flatMap((texts, row) =>
            texts.map((value, column) => ({
                rowIndex: range.anchor.rowIndex + row,
                columnKey:
                    columns[range.anchor.columnIndex + column]?.key ?? "",
                value,
            })),
        ),
        "Pasted",
    );
}

function filled(fill: RangeFill) {
    write(
        repeatedFill(fill, (at) =>
            gridRef.current?.model.get("cell-value-by", at),
        ).map((cell) => ({
            rowIndex: cell.rowIndex,
            columnKey: columns[cell.columnIndex]?.key ?? "",
            value: cell.value,
        })),
        "Filled",
    );
}
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <span>
                <kbd :class="styles.key">Enter</kbd> edits,
                <kbd :class="styles.key">Shift</kbd> + arrows select,
                <kbd :class="styles.key">Ctrl/⌘</kbd>
                <kbd :class="styles.key">C</kbd>
                <kbd :class="styles.key">V</kbd> copy and paste, the corner's
                square fills
            </span>
            <!-- the app's live region: a polite status, its text the app's own -->
            <span role="status" :class="styles.status">{{ announcement }}</span>
        </div>
        <DataGrid.Root
            :features="features"
            v-bind="local.props"
            :grid-ref="gridRef"
            :columns="columns"
            :row-key="taskKey"
            :row-height="38"
            cell-selection="range"
            :on-cell-edit="edited"
            :on-range-paste="pasted"
            :on-fill="filled"
            :class="styles.root"
        >
            <DataGrid.Grid aria-label="Tasks" :class="styles.grid">
                <DataGrid.Header :class="styles.header">
                    <DataGrid.HeaderRow :class="styles.headerRow">
                        <DataGrid.HeaderCells v-slot="{ cell }">
                            <DataGrid.HeaderCell :cell="cell">
                                <template #render="{ props, state, children }">
                                    <div
                                        v-bind="props"
                                        :class="styles.headerCell(state)"
                                    >
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
                                        <Resizer :cell="cell" />
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
                                <!-- its own content (the value, or its editor while edited),
                                     then, at the range's corner, the fill handle -->
                                <DataGrid.Cell :cell="cell">
                                    <template
                                        #render="{ props, state, children }"
                                    >
                                        <div
                                            v-bind="props"
                                            :class="styles.cell(state)"
                                        >
                                            <component :is="children" />
                                            <FillHandle :cell="cell" />
                                        </div>
                                    </template>
                                </DataGrid.Cell>
                            </DataGrid.Cells>
                        </DataGrid.Row>
                    </DataGrid.Rows>
                </DataGrid.Body>
            </DataGrid.Grid>
        </DataGrid.Root>
    </div>
</template>
