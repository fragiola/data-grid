<script setup lang="ts">
import type { RowKey } from "@fragiola/data-grid-vue";
import { useSelectAll } from "@fragiola/data-grid-vue/row-selection";
import Checkbox from "./checkbox.vue";

const props = defineProps<{ rowKeys: readonly RowKey[] }>();

const all = useSelectAll(() => props.rowKeys);
</script>

<template>
    <Checkbox
        label="Select all"
        :checked="all.status === 'all'"
        :indeterminate="all.status === 'some'"
        @toggle="all.toggle()"
    />
</template>
