<script setup lang="ts">
import type { CellInfo, RowKey } from "@fragiola/data-grid-vue";
import { useSelectAll } from "@fragiola/data-grid-vue/row-selection";
import { computed } from "vue";
import { Checkbox } from "#/components/ui/checkbox";
import type { Entry } from "./files";

// An entry's checkbox: the entry and everything under it (a folder's at every depth, the
// collapsed ones too), all of them, some (indeterminate) or none. The grid selects one row at a
// time; the app adds a folder's entries, here with `useSelectAll` over their keys.

const props = defineProps<{
    cell: CellInfo<Entry>;
    subRowKeysOf: (rowIndex: number) => readonly RowKey[];
}>();

const keys = computed((): readonly RowKey[] => {
    const id = props.cell.row?.id;
    return id === undefined
        ? []
        : [id, ...props.subRowKeysOf(props.cell.rowIndex)];
});
const all = useSelectAll(() => keys.value);
</script>

<template>
    <Checkbox.Root
        v-if="cell.row"
        :aria-label="`Select ${cell.row.name}`"
        :checked="all.status === 'all'"
        :indeterminate="all.status === 'some'"
        @checked-change="all.toggle"
    >
        <Checkbox.Indicator />
    </Checkbox.Root>
</template>
