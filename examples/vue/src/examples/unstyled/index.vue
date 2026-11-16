<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import type { VNodeChild } from "vue";
import { type Person, people } from "../_kit/data";
import * as styles from "./styles";

// The parts typed by the row type: a template cannot pass `Person` as a type argument.
const DataGrid = typedDataGrid<Person>();

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
        <DataGrid.Root :columns="columns" :rows="rows" :class="styles.root">
            <DataGrid.Grid aria-label="People">
                <DataGrid.Header />
                <DataGrid.Body />
            </DataGrid.Grid>
        </DataGrid.Root>
    </div>
</template>
