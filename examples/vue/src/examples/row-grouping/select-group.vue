<script setup lang="ts">
import {
    type DataGridFeature,
    type GroupRow,
    type RowKey,
    useDataGrid,
} from "@fragiola/data-grid-vue";
import {
    type RowSelectionTypes,
    useSelectAll,
} from "@fragiola/data-grid-vue/row-selection";
import { Checkbox } from "#/components/ui/checkbox";
import type { Person } from "../_kit/data";

// A group's checkbox: all of its people, some of them (indeterminate) or none.

const props = defineProps<{ rowIndex: number; group: GroupRow }>();

const NO_KEYS: readonly RowKey[] = [];

// the grid's model, typed by the feature this part reads (row selection, installed by the grid)
const { model } = useDataGrid<Person, [DataGridFeature<RowSelectionTypes>]>();
const all = useSelectAll(() => props.group.rowKeys ?? NO_KEYS);

// the grid selects the group's rows, or clears them all
const toggle = () =>
    model.run("selected-rows.toggle", { rowIndex: props.rowIndex });
</script>

<template>
    <Checkbox.Root
        :aria-label="`Select ${String(group.value)}`"
        :checked="all.status === 'all'"
        :indeterminate="all.status === 'some'"
        @checked-change="toggle"
    >
        <Checkbox.Indicator />
    </Checkbox.Root>
</template>
