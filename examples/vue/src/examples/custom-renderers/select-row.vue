<script setup lang="ts">
import { useDataGrid, useGridView } from "@fragiola/data-grid-vue";
import { computed } from "vue";
import type { Task } from "../_kit/tasks";
import Checkbox from "./checkbox.vue";

const props = defineProps<{ rowIndex: number; name: string }>();

const { model } = useDataGrid<Task>();
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
