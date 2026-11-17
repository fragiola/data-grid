<script setup lang="ts">
import type { RowKey } from "@fragiola/data-grid-vue";
import { useSelectAll } from "@fragiola/data-grid-vue/row-selection";
import { Checkbox } from "#/components/ui/checkbox";

// The header's checkbox: every selectable row, some (indeterminate) or none.

const props = defineProps<{ rowKeys: readonly RowKey[] }>();

const all = useSelectAll(() => props.rowKeys);
</script>

<template>
    <!-- one row at a time: it only clears -->
    <Checkbox.Root
        aria-label="Select all"
        :checked="all.status === 'all'"
        :indeterminate="all.status === 'some'"
        :disabled="!all.canToggle"
        @checked-change="all.toggle"
    >
        <Checkbox.Indicator />
    </Checkbox.Root>
</template>
