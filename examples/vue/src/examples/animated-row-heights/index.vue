<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { h, ref, type VNodeChild, watch } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { type Task, tasks } from "../_kit/tasks";
import * as styles from "./styles";

// cell navigation is a feature the grid installs: the keys, the active cell and the tab stop
const features = [navigation()] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Task, typeof features>();

const ROWS = tasks(500);

const HEIGHTS = [
    { label: "Small", height: 32 },
    { label: "Medium", height: 52 },
    { label: "Large", height: 76 },
] as const;

const columns: Column<Task, VNodeChild>[] = [
    { key: "id", name: "#", width: 64 },
    {
        key: "name",
        name: "Task",
        width: 240,
        // two lines: the project shows as the row grows tall enough for it
        renderCell: ({ row }) =>
            h("span", { class: styles.stack }, [
                h("span", row.name),
                h("span", { class: styles.secondary }, row.project),
            ]),
    },
    { key: "priority", name: "Priority", width: 110 },
    { key: "status", name: "Status", width: 130 },
    { key: "assignee", name: "Assignee", width: 110 },
    { key: "due", name: "Due", width: 120 },
];

// The grid positions each row (its top and height, structural style) from `rowHeight`: a new
// height lays every row out again in one render. While that change is in flight (`easingTo`,
// set with the new height and cleared once the transition is over), the rows' own CSS
// transition on `top` and `height` (styles.ts) eases them there. Only then: a scroll that
// renders other rows, or moves them, never animates. With reduced motion they move at once.

/** How long the rows ease, in ms: the rows' `duration-300` (styles.ts). */
const DURATION = 300;

const rowHeight = ref<number>(HEIGHTS[0].height);
// the height the rows are easing to, until the transition is over
const easingTo = ref<number | null>(null);
watch(easingTo, (height, _, onCleanup) => {
    if (height === null) return;
    // a little past the transition's end, so it is never cut short
    const timer = setTimeout(() => {
        easingTo.value = null;
    }, DURATION + 50);
    onCleanup(() => clearTimeout(timer));
});

function choose(height: number) {
    rowHeight.value = height;
    // the same render: the transition applies to this change
    easingTo.value = height;
}

const rowKey = (row: Task) => row.id;
</script>

<template>
    <div :class="styles.frame">
        <fieldset :class="styles.toolbar">
            <legend :class="styles.legend">Row height</legend>
            <Clickable.Button
                v-for="option in HEIGHTS"
                :key="option.label"
                size="sm"
                :variant="rowHeight === option.height ? 'solid' : 'outline'"
                :aria-pressed="rowHeight === option.height"
                @click="choose(option.height)"
            >
                {{ option.label }}
            </Clickable.Button>
        </fieldset>
        <DataGrid.Root
            :features="features"
            :columns="columns"
            :rows="ROWS"
            :row-key="rowKey"
            :row-height="rowHeight"
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
                            :class="styles.row(row, easingTo !== null)"
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
