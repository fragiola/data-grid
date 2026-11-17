<script setup lang="ts">
import { type HeaderCellInfo, typedDataGrid } from "@fragiola/data-grid-vue";
import { ArrowDown, ArrowUp } from "@lucide/vue";
import type { Task } from "../_kit/tasks";
import * as styles from "./styles";

// A header cell: its name and sort arrow on top, its filter (the default slot) below.

const DataGrid = typedDataGrid<Task>();

defineProps<{ cell: HeaderCellInfo<Task> }>();
</script>

<template>
    <DataGrid.HeaderCell :cell="cell" :class="styles.headerCell">
        <template #render="{ props, state, children }">
            <div v-bind="props">
                <span :class="styles.title">
                    <!-- the column's name -->
                    <component :is="children" />
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
                </span>
                <slot />
            </div>
        </template>
    </DataGrid.HeaderCell>
</template>
