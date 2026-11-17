<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import type { VNodeChild } from "vue";
import { type Person, people } from "../_kit/data";
import * as styles from "./styles";

// cell navigation is a feature the grid installs: the keys, the active cell and the tab stop
const features = [navigation()] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Person, typeof features>();

const rows = people(1_000);

const columns: Column<Person, VNodeChild>[] = [
    { key: "id", name: "#", width: 60 },
    { key: "name", name: "Name", width: 180 },
    { key: "email", name: "Email", width: 260 },
    { key: "city", name: "City", width: 140 },
];
</script>

<template>
    <!-- No class on any part: the default children render the header names and the values. The
         only class sizes the frame, because a scroll container needs a size. -->
    <div :class="styles.frame">
        <DataGrid.Root
            :features="features"
            :columns="columns"
            :rows="rows"
            :class="styles.root"
        >
            <DataGrid.Grid aria-label="People">
                <DataGrid.Header />
                <DataGrid.Body />
            </DataGrid.Grid>
        </DataGrid.Root>
    </div>
</template>
