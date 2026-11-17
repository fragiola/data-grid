<script setup lang="ts">
import { Select } from "#/components/ui/select";
import { STATUSES, type Task } from "../_kit/tasks";
import * as styles from "./styles";

// A task's status, a select in its cell.

defineProps<{ task: Task }>();

const emit = defineEmits<{ change: [status: Task["status"]] }>();

const STATUS_ITEMS = Object.fromEntries(
    STATUSES.map((status) => [status, status]),
);

function isStatus(value: unknown): value is Task["status"] {
    return STATUSES.some((status) => status === value);
}

function choose(status: unknown) {
    if (isStatus(status)) emit("change", status);
}
</script>

<template>
    <Select.Root
        :items="STATUS_ITEMS"
        :model-value="task.status"
        @update:model-value="choose"
    >
        <Select.Trigger
            :class="styles.select"
            :aria-label="`Status of ${task.name}`"
        >
            <Select.Value />
        </Select.Trigger>
        <Select.Content>
            <Select.Item v-for="status in STATUSES" :key="status" :value="status">
                {{ status }}
            </Select.Item>
        </Select.Content>
    </Select.Root>
</template>
