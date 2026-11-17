<script setup lang="ts">
import {
    type HeaderCellInfo,
    typedDataGrid,
    useGridView,
} from "@fragiola/data-grid-vue";
import { sortColumnsOf } from "@fragiola/data-grid-vue/sorting";
import { ArrowDown, ArrowUp, ArrowUpDown } from "@lucide/vue";
import { computed } from "vue";
import type { Person } from "../_kit/data";
import * as styles from "./styles";

// A header cell and the app's own indicator, drawn from the cell's state: an arrow for the
// direction and, with more than one sorted column, its priority.

const DataGrid = typedDataGrid<Person>();

defineProps<{ cell: HeaderCellInfo<Person> }>();

const view = useGridView();
const sortedColumns = computed(() => sortColumnsOf(view.value).length);
</script>

<template>
    <DataGrid.HeaderCell :cell="cell" :class="styles.headerCell">
        <template #render="{ props, state, children }">
            <div v-bind="props">
                <span :class="styles.headerLabel">
                    <component :is="children" />
                </span>
                <ArrowUp
                    v-if="state.sortDirection === 'ascending'"
                    aria-hidden="true"
                    :class="styles.sortIcon"
                />
                <ArrowDown
                    v-else-if="state.sortDirection === 'descending'"
                    aria-hidden="true"
                    :class="styles.sortIcon"
                />
                <ArrowUpDown
                    v-else-if="state.sortable"
                    aria-hidden="true"
                    :class="styles.unsorted"
                />
                <span
                    v-if="sortedColumns > 1 && state.sortPriority !== undefined"
                    :class="styles.priority"
                >
                    {{ state.sortPriority }}
                </span>
            </div>
        </template>
    </DataGrid.HeaderCell>
</template>
