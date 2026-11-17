<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { h, shallowRef, type VNodeChild } from "vue";
import { Input } from "#/components/atoms/fields";
import { Checkbox } from "#/components/ui/checkbox";
import { type Task, tasks } from "../_kit/tasks";
import RowActions from "./row-actions.vue";
import StatusSelect from "./status-select.vue";
import * as styles from "./styles";

// cell navigation is a feature the grid installs: the keys, the active cell and the tab stop
const features = [navigation()] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Task, typeof features>();

/** What the app does to a task: rename it, change its status, copy it, delete it. */
interface Actions {
    update: (id: number, change: Partial<Task>) => void;
    duplicate: (id: number) => void;
    remove: (id: number) => void;
}

/** A field's text, from its input event. */
const textOf = (event: Event) =>
    event.target instanceof HTMLInputElement ? event.target.value : "";

/**
 * Every cell holds controls, and the grid stays one tab stop: it keeps them out of the tab order
 * and hands a cell's keys to them on Enter or F2 (or a click); Escape comes back.
 */
function columnsFor({
    update,
    duplicate,
    remove,
}: Actions): Column<Task, VNodeChild>[] {
    return [
        {
            key: "done",
            name: "Done",
            width: 64,
            renderCell: ({ row }) =>
                h(
                    Checkbox.Root,
                    {
                        "aria-label": `${row.name} done`,
                        checked: row.status === "Completed",
                        onCheckedChange: (checked: boolean) =>
                            update(row.id, {
                                status: checked ? "Completed" : "In Progress",
                            }),
                    },
                    () => h(Checkbox.Indicator),
                ),
        },
        {
            key: "name",
            name: "Task",
            width: 240,
            renderCell: ({ row }) =>
                h(Input, {
                    "aria-label": `Name of task ${row.id}`,
                    value: row.name,
                    onInput: (event: Event) =>
                        update(row.id, { name: textOf(event) }),
                    class: styles.field,
                }),
        },
        {
            key: "status",
            name: "Status",
            width: 170,
            renderCell: ({ row }) =>
                h(StatusSelect, {
                    task: row,
                    onChange: (status: Task["status"]) =>
                        update(row.id, { status }),
                }),
        },
        {
            key: "assignee",
            name: "Assignee",
            width: 150,
            renderCell: ({ row }) =>
                h(
                    "a",
                    {
                        class: styles.link,
                        href: `mailto:${row.assignee.toLowerCase()}@example.com`,
                    },
                    row.assignee,
                ),
        },
        {
            key: "actions",
            name: "Actions",
            width: 110,
            renderCell: ({ row }) =>
                h(RowActions, {
                    name: row.name,
                    onDuplicate: () => duplicate(row.id),
                    onRemove: () => remove(row.id),
                }),
        },
    ];
}

const rows = shallowRef<readonly Task[]>(tasks(60));

const columns = columnsFor({
    update: (id, change) => {
        rows.value = rows.value.map((row) =>
            row.id === id ? { ...row, ...change } : row,
        );
    },
    duplicate: (id) => {
        const current = rows.value;
        const index = current.findIndex((row) => row.id === id);
        const original = current[index];
        if (!original) return;
        const copy = {
            ...original,
            id: Math.max(...current.map((row) => row.id)) + 1,
            name: `${original.name} (copy)`,
        };
        rows.value = [
            ...current.slice(0, index + 1),
            copy,
            ...current.slice(index + 1),
        ];
    },
    remove: (id) => {
        rows.value = rows.value.filter((row) => row.id !== id);
    },
});

const rowKey = (row: Task) => row.id;
</script>

<template>
    <div :class="styles.frame">
        <p :class="styles.hint">
            <span>
                <kbd :class="styles.key">Enter</kbd> or
                <kbd :class="styles.key">F2</kbd> into a cell's controls
            </span>
            <span><kbd :class="styles.key">Tab</kbd> its next control</span>
            <span><kbd :class="styles.key">Esc</kbd> back to the grid</span>
            <span :class="styles.count" data-testid="count">
                {{ rows.length }} tasks
            </span>
        </p>
        <DataGrid.Root
            :features="features"
            :columns="columns"
            :rows="rows"
            :row-key="rowKey"
            :row-height="44"
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
