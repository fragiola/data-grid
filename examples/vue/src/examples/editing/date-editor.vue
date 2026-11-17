<script setup lang="ts" generic="TRow">
import type { EditCellRenderProps } from "@fragiola/data-grid-vue";
import type { VNodeChild } from "vue";
import { Input } from "#/components/atoms/fields";

// A date: the browser's date field. Its look is its caller's (`class`, on the field).

const props = defineProps<{ edit: EditCellRenderProps<TRow, VNodeChild> }>();

function onInput(event: Event) {
    if (event.target instanceof HTMLInputElement) {
        props.edit.onChange(event.target.value);
    }
}
</script>

<template>
    <Input
        type="date"
        :aria-label="edit.column.name"
        :value="String(edit.value ?? '')"
        @input="onInput"
    />
</template>
