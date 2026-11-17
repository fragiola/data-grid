<script setup lang="ts" generic="TRow">
import type { EditCellRenderProps } from "@fragiola/data-grid-vue";
import { computed, type VNodeChild } from "vue";
import { Numeric } from "#/components/atoms/fields";
import { amountOf } from "../_kit/budgeted-tasks";
import { useStartKey } from "./use-start-key";

// An amount: a number. A value that is no amount keeps the edit open: the editor prevents Enter
// and Tab (its own listener runs before the grid's), and says so. Its look is its caller's
// (`class`, on the field).

const props = defineProps<{ edit: EditCellRenderProps<TRow, VNodeChild> }>();

useStartKey(
    () => {
        const key = props.edit.startKey;
        return key !== undefined && /\d/.test(key) ? key : undefined;
    },
    (value) => props.edit.onChange(value),
);

const valid = computed(() => amountOf(props.edit.value) !== undefined);

function onInput(event: Event) {
    if (event.target instanceof HTMLInputElement) {
        props.edit.onChange(event.target.value);
    }
}

function onKeydown(event: KeyboardEvent) {
    if (!valid.value && (event.key === "Enter" || event.key === "Tab")) {
        event.preventDefault();
    }
}
</script>

<template>
    <Numeric
        :aria-label="edit.column.name"
        :aria-invalid="!valid"
        :min="0"
        :step="100"
        :value="String(edit.value ?? '')"
        @input="onInput"
        @keydown="onKeydown"
    />
</template>
