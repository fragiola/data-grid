<script setup lang="ts">
import { useSelectAll } from "@fragiola/data-grid-vue/selection";
import { computed, inject } from "vue";
import { Checkbox } from "#/components/ui/checkbox";
import { SELECTABLE_IDS } from "./selectable-ids";

// The header's checkbox: every selectable job, some (indeterminate) or none.

const ids = inject(
    SELECTABLE_IDS,
    computed(() => []),
);
const all = useSelectAll(() => ids.value);
</script>

<template>
    <Checkbox.Root
        aria-label="Select all"
        :checked="all.status === 'all'"
        :indeterminate="all.status === 'some'"
        @checked-change="all.toggle"
    >
        <Checkbox.Indicator />
    </Checkbox.Root>
</template>
