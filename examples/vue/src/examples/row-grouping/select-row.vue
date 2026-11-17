<script setup lang="ts">
import {
    type DataGridFeature,
    useDataGrid,
    useGridView,
} from "@fragiola/data-grid-vue";
import type { RowSelectionTypes } from "@fragiola/data-grid-vue/row-selection";
import { computed } from "vue";
import { Checkbox } from "#/components/ui/checkbox";
import type { Person } from "../_kit/data";

// A person's checkbox: the grid toggles the row.

const props = defineProps<{ rowIndex: number; name: string }>();

// the grid's model, typed by the feature this part reads (row selection, installed by the grid)
const { model } = useDataGrid<Person, [DataGridFeature<RowSelectionTypes>]>();
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

const toggle = () =>
    model.run("selected-rows.toggle", { rowIndex: props.rowIndex });
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
