<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { ref, type VNodeChild } from "vue";
import { type Person, people } from "../_kit/data";
import Grid from "./grid.vue";
import type { Mode } from "./navigation";
import * as styles from "./styles";

// cell navigation is a feature the grid installs: the keys, the active cell and the tab stop
const features = [navigation()] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Person, typeof features>();

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
            :features="features"
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
