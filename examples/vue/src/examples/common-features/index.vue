<script setup lang="ts">
import {
    type CellEditEvent,
    type Column,
    type RowKey,
    typedDataGrid,
} from "@fragiola/data-grid-vue";
import { useLocalRows } from "@fragiola/data-grid-vue/local";
import { sorting } from "@fragiola/data-grid-vue/sorting";
import { Download } from "@lucide/vue";
import { computed, h, provide, shallowRef, type VNodeChild } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { Checkbox } from "#/components/ui/checkbox";
import {
    type BudgetedTask,
    budgetedTasks,
    withField,
} from "../_kit/budgeted-tasks";
import { formatMoney, hash } from "../_kit/data";
import AmountEditor from "../editing/amount-editor.vue";
import DateEditor from "../editing/date-editor.vue";
import StatusEditor from "../editing/status-editor.vue";
import TextEditor from "../editing/text-editor.vue";
import HeaderCell from "./header-cell.vue";
import SelectAll from "./select-all.vue";
import SelectRow from "./select-row.vue";
import { SELECTABLE_IDS } from "./selectable-ids";
import * as styles from "./styles";
import type { Totals } from "./summaries";
import Summary from "./summary.vue";

// React Data Grid's "common features" in one grid: a selection column, columns pinned at the
// start and at the end, every column sortable and resizable, cells edited in place, a summary
// row on top and one at the bottom, and an export. The grid keeps the state that is its own
// (selection, sort, widths); the rows, the edits, the totals and the export are the app's.

interface Job extends BudgetedTask {
    /** whether the assignee can take it now: a checkbox the app writes */
    available: boolean;
}

// sorting is a feature the grid installs: without it, a sortable column never sorts
const features = [sorting()] as const;

const DataGrid = typedDataGrid<Job, typeof features>();

const JOBS: Job[] = budgetedTasks(1_000).map((task) => ({
    ...task,
    available: hash(task.id + 101, 3) > 0,
}));

/** A completed job cannot be selected: the grid skips it in a range and in "select all". */
const isSelectable = (job: Job) => job.status !== "Completed";

/** A column's text in the CSV: its value, quoted when it holds a comma, a quote or a line break. */
function csvField(value: unknown): string {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** A column's text in the export, where it is not the value itself: what the grid shows. */
const EXPORT_TEXT: Partial<Record<string, (job: Job) => string>> = {
    effectiveness: (job) => `${job.effectiveness * 20}%`,
    budget: (job) => formatMoney(job.budget),
    available: (job) => (job.available ? "Yes" : "No"),
};

/**
 * The rows as CSV, in the order shown, with every column but the checkboxes', each cell as the
 * grid shows it. The app has every row: it exports them, not the few the grid renders.
 */
function toCsv(
    columns: readonly Column<Job, VNodeChild>[],
    rows: readonly Job[],
): string {
    const exported = columns.filter((column) => column.key !== "select");
    return [
        exported.map((column) => csvField(column.name)).join(","),
        ...rows.map((row) => {
            // the row's fields by key
            const fields: Record<string, unknown> = { ...row };
            return exported
                .map((column) =>
                    csvField(
                        EXPORT_TEXT[column.key]?.(row) ?? fields[column.key],
                    ),
                )
                .join(",");
        }),
    ].join("\n");
}

/** Hands the reader a file (the browser's download), from text the app made. */
function download(text: string, name: string) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    // released once the browser has taken the file: at once, it could cancel the download
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

const jobs = shallowRef<readonly Job[]>(JOBS);

function setAvailable(id: number, available: boolean) {
    jobs.value = jobs.value.map((job) =>
        job.id === id ? { ...job, available } : job,
    );
}

// made once: the renderers read the app's rows when they run
const columns: Column<Job, VNodeChild>[] = [
    {
        key: "select",
        width: 44,
        pinned: "start",
        renderHeaderCell: () => h(SelectAll),
        renderCell: ({ row, rowIndex }) =>
            h(SelectRow, { rowIndex, name: row.name }),
    },
    {
        key: "name",
        name: "Task",
        width: 200,
        pinned: "start",
        sortable: true,
        resizable: true,
        editable: true,
        renderEditCell: (edit) =>
            h(TextEditor<Job>, { edit, class: styles.editor }),
    },
    {
        key: "project",
        name: "Project",
        width: 120,
        sortable: true,
        resizable: true,
    },
    {
        key: "status",
        name: "Status",
        width: 140,
        sortable: true,
        resizable: true,
        editable: true,
        renderEditCell: (edit) =>
            h(StatusEditor<Job>, { edit, class: styles.select }),
    },
    {
        key: "priority",
        name: "Priority",
        width: 110,
        sortable: true,
        resizable: true,
    },
    {
        key: "assignee",
        name: "Assignee",
        width: 120,
        sortable: true,
        resizable: true,
    },
    {
        key: "effectiveness",
        name: "Completion",
        width: 150,
        sortable: true,
        resizable: true,
        renderCell: ({ row }) =>
            h("span", { class: styles.progress }, [
                h("progress", {
                    max: 5,
                    value: row.effectiveness,
                    "aria-label": `${row.name} completion`,
                    class: styles.bar,
                }),
                `${row.effectiveness * 20}%`,
            ]),
    },
    {
        key: "due",
        name: "Deadline",
        width: 140,
        sortable: true,
        resizable: true,
        editable: true,
        renderEditCell: (edit) =>
            h(DateEditor<Job>, { edit, class: styles.editor }),
    },
    {
        key: "budget",
        name: "Budget",
        width: 120,
        sortable: true,
        resizable: true,
        editable: (job) => job.status !== "Completed",
        renderCell: ({ row }) => formatMoney(row.budget),
        renderEditCell: (edit) =>
            h(AmountEditor<Job>, { edit, class: styles.editor }),
    },
    {
        key: "available",
        name: "Available",
        width: 100,
        pinned: "end",
        sortable: true,
        renderCell: ({ row }) =>
            h(
                Checkbox.Root,
                {
                    "aria-label": `${row.name} available`,
                    checked: row.available,
                    onCheckedChange: (available: boolean) =>
                        setAvailable(row.id, available),
                },
                { default: () => h(Checkbox.Indicator) },
            ),
    },
];

const local = useLocalRows(jobs, columns);
provide(
    SELECTABLE_IDS,
    computed(() => jobs.value.filter(isSelectable).map((job) => job.id)),
);
const totals = computed(
    (): Totals => ({
        count: jobs.value.length,
        budget: jobs.value.reduce((sum, job) => sum + job.budget, 0),
        available: jobs.value.filter((job) => job.available).length,
    }),
);
const selected = shallowRef<readonly RowKey[]>([]);

const rowKey = (row: Job) => row.id;
const setSelected = (keys: readonly RowKey[]) => {
    selected.value = keys;
};

function exportCsv() {
    download(toCsv(columns, local.rows), "jobs.csv");
}

function edited({ row, columnKey, value }: CellEditEvent<Job>) {
    // the app writes the value, through its one rule; a refused one changes nothing
    jobs.value = jobs.value.map((job) => {
        if (job.id !== row.id) return job;
        const next = withField(job, columnKey, value);
        return next ? { ...job, ...next } : job;
    });
}
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <span data-testid="selected-count">{{ selected.length }} selected</span>
            <Clickable.Button size="sm" variant="outline" @click="exportCsv">
                <Download aria-hidden="true" />
                Export to CSV
            </Clickable.Button>
        </div>
        <DataGrid.Root
            :features="features"
            v-bind="local.props"
            :columns="columns"
            :row-key="rowKey"
            :row-height="38"
            row-selection="multiple"
            :is-row-selectable="isSelectable"
            :on-selected-row-keys-change="setSelected"
            :summary-rows="{ top: 1, bottom: 1 }"
            :summary-row-height="38"
            :on-cell-edit="edited"
            :class="styles.root"
        >
            <DataGrid.Grid aria-label="Jobs" :class="styles.grid">
                <DataGrid.Header :class="styles.header">
                    <DataGrid.HeaderRow :class="styles.headerRow">
                        <DataGrid.HeaderCells v-slot="{ cell }">
                            <HeaderCell :cell="cell" />
                        </DataGrid.HeaderCells>
                    </DataGrid.HeaderRow>
                </DataGrid.Header>
                <Summary position="top" :totals="totals" />
                <DataGrid.Body>
                    <DataGrid.Rows v-slot="{ row }">
                        <DataGrid.Row :row="row" :class="styles.row(row)">
                            <DataGrid.Cells v-slot="{ cell }">
                                <DataGrid.Cell :cell="cell">
                                    <template
                                        #render="{ props, state, children }"
                                    >
                                        <div
                                            v-bind="props"
                                            :class="styles.cell(state)"
                                        >
                                            <component :is="children" />
                                        </div>
                                    </template>
                                </DataGrid.Cell>
                            </DataGrid.Cells>
                        </DataGrid.Row>
                    </DataGrid.Rows>
                </DataGrid.Body>
                <!-- after the body: it stays at the view's bottom edge -->
                <Summary position="bottom" :totals="totals" />
            </DataGrid.Grid>
        </DataGrid.Root>
    </div>
</template>
