<script setup lang="ts">
import { computed, inject } from "vue";
import { Checkbox } from "#/components/ui/checkbox";
import { SELECT_ALL } from "./select-all";

// The header's checkbox: every row of the server's, some (indeterminate) or none.

const props = defineProps<{ total: number }>();

const state = inject(SELECT_ALL);
const count = computed(() => state?.value.count ?? 0);

function toggle(checked: boolean) {
    state?.value.toggle(checked);
}
</script>

<template>
    <Checkbox.Root
        aria-label="Select all"
        :checked="count === props.total"
        :indeterminate="count > 0 && count < props.total"
        @checked-change="toggle"
    >
        <Checkbox.Indicator />
    </Checkbox.Root>
</template>
