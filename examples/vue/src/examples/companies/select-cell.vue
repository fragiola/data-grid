<script setup lang="ts">
import { useDataGrid, useGridView } from "@fragiola/data-grid-vue";
import { computed } from "vue";
import { Checkbox, type CheckedChangeDetails } from "#/components/ui/checkbox";

// A row's checkbox: the grid toggles it, a Shift+click selects the rows since the last one.

const props = defineProps<{ rowIndex: number; name: string }>();

const { model } = useDataGrid();
// the view moves with the selection: the box follows
const view = useGridView();
const checked = computed(() => {
    void view.value;
    return model.is("row-selected", { rowIndex: props.rowIndex });
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
        @checked-change="toggle"
    >
        <Checkbox.Indicator />
    </Checkbox.Root>
</template>
