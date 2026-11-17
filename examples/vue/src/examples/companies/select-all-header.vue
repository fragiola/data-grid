<script setup lang="ts">
import { useSelectAll } from "@fragiola/data-grid-vue/row-selection";
import { inject } from "vue";
import { Checkbox } from "#/components/ui/checkbox";
import { COMPANY_IDS } from "./state";

// The header's checkbox over every company: every row, some (indeterminate) or none.

const ids = inject(COMPANY_IDS);
const all = useSelectAll(() => ids?.value ?? []);
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
