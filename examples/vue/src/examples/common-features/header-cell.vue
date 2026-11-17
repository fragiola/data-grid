<script setup lang="ts" generic="TRow">
import { type HeaderCellInfo, typedDataGrid } from "@fragiola/data-grid-vue";
import { ArrowDown, ArrowUp } from "@lucide/vue";
import Resizer from "./resizer.vue";
import * as styles from "./styles";

// A header cell: its content, the app's sort arrow and a resize handle.

const DataGrid = typedDataGrid<TRow>();

defineProps<{ cell: HeaderCellInfo<TRow> }>();
</script>

<template>
    <DataGrid.HeaderCell :cell="cell">
        <template #render="{ props, state, children }">
            <div v-bind="props" :class="styles.headerCell(state)">
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
                <Resizer :cell="cell" />
            </div>
        </template>
    </DataGrid.HeaderCell>
</template>
