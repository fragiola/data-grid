<script setup lang="ts">
import {
    type HeaderCellInfo,
    typedDataGrid,
    useGridView,
} from "@fragiola/data-grid-vue";
import { sortColumnsOf } from "@fragiola/data-grid-vue/sorting";
import { computed } from "vue";
import type { Task } from "../_kit/tasks";
import * as styles from "./styles";

// A header cell with the app's own sort status: a triangle, and the column's place in the sort.
// The `render` slot's `children` is the cell's content (the column's name).

const DataGrid = typedDataGrid<Task>();

defineProps<{ cell: HeaderCellInfo<Task> }>();

const view = useGridView();
const sortedColumns = computed(() => sortColumnsOf(view.value).length);
</script>

<template>
    <DataGrid.HeaderCell :cell="cell" :class="styles.headerCell(cell)">
        <template #render="{ props, state, children }">
            <div v-bind="props">
                <component :is="children" />
                <span
                    v-if="state.sortDirection"
                    aria-hidden="true"
                    :class="styles.sortStatus"
                >
                    {{ state.sortDirection === "ascending" ? "▲" : "▼"
                    }}<span v-if="sortedColumns > 1" :class="styles.priority">{{
                        state.sortPriority
                    }}</span>
                </span>
            </div>
        </template>
    </DataGrid.HeaderCell>
</template>
