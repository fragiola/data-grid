<script setup lang="ts">
import {
    type DataGridFeature,
    useDataGrid,
    useGridView,
} from "@fragiola/data-grid-vue";
import type { RowSelectionTypes } from "@fragiola/data-grid-vue/row-selection";
import { computed } from "vue";
import { Checkbox, type CheckedChangeDetails } from "#/components/ui/checkbox";
import type { Task } from "../_kit/tasks";

// A row's checkbox: the grid toggles the row, a Shift+click selects since the last one.

const props = defineProps<{ rowIndex: number; name: string }>();

// the grid's model, typed by the feature this part reads (row selection, installed by the grid)
const { model } = useDataGrid<Task, [DataGridFeature<RowSelectionTypes>]>();
// the view moves with the selection: the box follows
const view = useGridView();
const checked = computed(() => {
    void view.value;
    return model.is("row-selected", { rowIndex: props.rowIndex });
});
const selectable = computed(() => {
    void view.value;
    return model.is("row-selectable", { rowIndex: props.rowIndex });
});

function toggle(_: boolean, { event }: CheckedChangeDetails) {
    model.run("selected-rows.toggle", {
        rowIndex: props.rowIndex,
        extend: event instanceof MouseEvent && event.shiftKey,
    });
}
</script>

<template>
    <Checkbox.Root
        :aria-label="`Select ${name}`"
        :checked="checked"
        :disabled="!selectable"
        @checked-change="toggle"
    >
        <Checkbox.Indicator />
    </Checkbox.Root>
</template>
