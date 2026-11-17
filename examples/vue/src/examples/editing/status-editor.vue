<script setup lang="ts" generic="TRow">
import type { EditCellRenderProps } from "@fragiola/data-grid-vue";
import { useAttrs, type VNodeChild } from "vue";
import { Select } from "#/components/ui/select";
import { isStatus } from "../_kit/budgeted-tasks";
import { STATUSES } from "../_kit/tasks";

// A status: a select, open as the edit starts; choosing one commits it. Its list is teleported out
// of the grid: marked as the edit's (`editorProps`), a press or focus there keeps it open. Its look
// is its caller's (`class`, on the trigger).

defineOptions({ inheritAttrs: false });

const props = defineProps<{ edit: EditCellRenderProps<TRow, VNodeChild> }>();
const attrs = useAttrs();

const STATUS_ITEMS = Object.fromEntries(
    STATUSES.map((status) => [status, status]),
);

function choose(status: unknown) {
    if (isStatus(status)) props.edit.onCommit(status);
}
</script>

<template>
    <Select.Root
        :items="STATUS_ITEMS"
        :model-value="String(edit.value)"
        :default-open="true"
        @update:model-value="choose"
    >
        <Select.Trigger :aria-label="edit.column.name" :class="attrs.class">
            <Select.Value />
        </Select.Trigger>
        <Select.Content v-bind="edit.editorProps">
            <Select.Item
                v-for="status in STATUSES"
                :key="status"
                :value="status"
            >
                {{ status }}
            </Select.Item>
        </Select.Content>
    </Select.Root>
</template>
