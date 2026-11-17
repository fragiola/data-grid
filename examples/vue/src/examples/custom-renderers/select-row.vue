<script setup lang="ts">
import {
    type DataGridFeature,
    useDataGrid,
    useGridView,
} from "@fragiola/data-grid-vue";
import type { RowSelectionTypes } from "@fragiola/data-grid-vue/row-selection";
import { computed } from "vue";
import type { Task } from "../_kit/tasks";
import Checkbox from "./checkbox.vue";

const props = defineProps<{ rowIndex: number; name: string }>();

// the grid's model, typed by the feature this part reads (row selection, installed by the grid)
const { model } = useDataGrid<Task, [DataGridFeature<RowSelectionTypes>]>();
// the view moves with the selection: the box follows
const view = useGridView();
const checked = computed(() => {
    void view.value;
    return model.is("row-selected", { rowIndex: props.rowIndex });
});

function toggle(extend: boolean) {
    model.run("selected-rows.toggle", { rowIndex: props.rowIndex, extend });
}
</script>

<template>
    <Checkbox :label="`Select ${name}`" :checked="checked" @toggle="toggle" />
</template>
