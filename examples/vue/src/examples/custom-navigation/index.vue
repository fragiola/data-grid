<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import { ref, type VNodeChild } from "vue";
import { type Person, people } from "../_kit/data";
import Grid from "./grid.vue";
import type { Mode } from "./navigation";
import * as styles from "./styles";

// The parts typed by the row type: a template cannot pass `Person` as a type argument.
const DataGrid = typedDataGrid<Person>();

const rows = people(1_000);

const columns: Column<Person, VNodeChild>[] = [
    { key: "id", name: "#", width: 72 },
    { key: "name", name: "Name", width: 180 },
    { key: "city", name: "City", width: 140 },
    { key: "team", name: "Team", width: 120 },
];

const MODES: { mode: Mode; label: string }[] = [
    { mode: "leave", label: "Tab leaves the grid" },
    {
        mode: "change-row",
        label: "Tab and the arrows go on to the next row",
    },
    { mode: "loop-over-row", label: "Tab and the arrows loop over the row" },
    { mode: "loop-over-column", label: "Tab moves down the column" },
];

const mode = ref<Mode>("change-row");

const rowKey = (row: Person) => row.id;
</script>

<template>
    <div :class="styles.frame">
        <fieldset :class="styles.modes">
            <legend :class="styles.panel">Cell navigation</legend>
            <label
                v-for="option in MODES"
                :key="option.mode"
                :class="styles.mode"
            >
                <input
                    type="radio"
                    name="navigation-mode"
                    :value="option.mode"
                    :checked="mode === option.mode"
                    @change="mode = option.mode"
                />
                {{ option.label }}
            </label>
        </fieldset>
        <DataGrid.Root
            :columns="columns"
            :rows="rows"
            :row-key="rowKey"
            :row-height="36"
            :default-active-position="{ rowIndex: 0, columnIndex: 0 }"
            :class="styles.root"
        >
            <Grid :mode="mode" />
        </DataGrid.Root>
    </div>
</template>
