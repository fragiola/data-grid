<script setup lang="ts">
import {
    type HeaderCellInfo,
    headerCellContent,
    typedDataGrid,
} from "@fragiola/data-grid-vue";
import { ArrowDown, ArrowUp, GripVertical } from "@lucide/vue";
import type { Person } from "../_kit/data";
import Resizer from "./resizer.vue";
import * as styles from "./styles";

// A header cell: a grip where it can be dragged, its label, the sort's arrow and the resize
// handle. The drop indicator and the dimmed dragged cell are its classes, from its `data-*`.

const DataGrid = typedDataGrid<Person>();

const props = defineProps<{ cell: HeaderCellInfo<Person> }>();

/** its own content: its group's or column's `renderHeaderCell`, else its name */
const Content = () => headerCellContent(props.cell);
</script>

<template>
    <DataGrid.HeaderCell :cell="cell" :class="styles.headerCell(cell)">
        <template #render="{ props: cellProps, state }">
            <div v-bind="cellProps">
                <GripVertical
                    v-if="state.reorderable"
                    aria-hidden="true"
                    :class="styles.grip"
                />
                <span :class="styles.label"><Content /></span>
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
