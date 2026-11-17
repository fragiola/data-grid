<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import { Star } from "@lucide/vue";
import { computed, h, shallowRef, type VNodeChild } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { Checkbox } from "#/components/ui/checkbox";
import { type Task, tasks } from "../_kit/tasks";
import {
    type Checked,
    counts,
    FACETS,
    type FacetKey,
    filter,
    NONE,
    toggle,
} from "./facets";
import * as styles from "./styles";

// The parts typed by the row type: a template cannot pass `Task` as a type argument.
const DataGrid = typedDataGrid<Task>();

const all = tasks(200);

const DATE = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
});

const columns: Column<Task, VNodeChild>[] = [
    { key: "name", name: "Name", width: 220 },
    { key: "project", name: "Project", width: 110 },
    {
        key: "priority",
        name: "Priority",
        width: 110,
        renderCell: ({ row }) =>
            h("span", { class: styles.priority(row.priority) }, row.priority),
    },
    { key: "status", name: "Status", width: 130 },
    { key: "assignee", name: "Assigned to", width: 120 },
    {
        key: "due",
        name: "Due date",
        width: 120,
        renderCell: ({ row }) => DATE.format(new Date(row.due)),
    },
    {
        key: "effectiveness",
        name: "Effectiveness",
        width: 140,
        renderCell: ({ row }) =>
            h(
                "span",
                {
                    class: styles.stars,
                    role: "img",
                    "aria-label": `${row.effectiveness} of 5`,
                },
                [1, 2, 3, 4, 5].map((star) =>
                    h(Star, {
                        key: star,
                        "aria-hidden": "true",
                        class: styles.star(star <= row.effectiveness),
                    }),
                ),
            ),
    },
];

const checked = shallowRef<Checked>(NONE);
// the grid gets the filtered rows: filtering is the app's (the external mode)
const rows = computed(() => filter(all, checked.value));
const facetCounts = computed(() => counts(all, checked.value));
const anyChecked = computed(() =>
    FACETS.some(({ key }) => checked.value[key].size > 0),
);

const rowKey = (row: Task) => row.id;

function clear() {
    checked.value = NONE;
}

function toggleValue(key: FacetKey, value: string) {
    checked.value = toggle(checked.value, key, value);
}
</script>

<template>
    <div :class="styles.frame">
        <aside :class="styles.sidebar" aria-label="Filters">
            <div :class="styles.sidebarHeader">
                <span :class="styles.shown" data-testid="shown">
                    {{ rows.length }} of {{ all.length }} tasks
                </span>
                <Clickable.Button
                    size="sm"
                    variant="ghost"
                    :disabled="!anyChecked"
                    @click="clear"
                >
                    Clear
                </Clickable.Button>
            </div>
            <fieldset
                v-for="facet in FACETS"
                :key="facet.key"
                :class="styles.facet"
            >
                <legend :class="styles.facetTitle">{{ facet.title }}</legend>
                <!-- Checkbox.Root renders the control the label wraps -->
                <label
                    v-for="value in facet.values"
                    :key="value"
                    :class="styles.option"
                >
                    <Checkbox.Root
                        :checked="checked[facet.key].has(value)"
                        @checked-change="toggleValue(facet.key, value)"
                    >
                        <Checkbox.Indicator />
                    </Checkbox.Root>
                    <span :class="styles.optionLabel">{{ value }}</span>
                    <span :class="styles.optionCount">
                        {{ facetCounts[facet.key].get(value) ?? 0 }}
                    </span>
                </label>
            </fieldset>
        </aside>
        <DataGrid.Root
            :columns="columns"
            :rows="rows"
            :row-key="rowKey"
            :row-height="40"
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
                        <DataGrid.Row :row="row" :class="styles.row">
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
