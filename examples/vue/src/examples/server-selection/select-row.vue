<script setup lang="ts">
import { useDataGrid, useGridView } from "@fragiola/data-grid-vue";
import { computed } from "vue";
import { Checkbox } from "#/components/ui/checkbox";
import type { Person } from "../_kit/data";

// A row's checkbox: the grid toggles the row.

const props = defineProps<{ rowIndex: number; name: string }>();

const { model } = useDataGrid<Person>();
// the view moves with the selection: the box follows
const view = useGridView();
const checked = computed(() => {
    void view.value;
    return model.is("row-selected", { rowIndex: props.rowIndex });
});

function toggle() {
    model.run("selected-rows.toggle", { rowIndex: props.rowIndex });
}
</script>

<template>
    <Checkbox.Root
        :aria-label="`Select ${name}`"
        :checked="checked"
        @checked-change="toggle"
    >
        <Checkbox.Indicator />
    </Checkbox.Root>
</template>
