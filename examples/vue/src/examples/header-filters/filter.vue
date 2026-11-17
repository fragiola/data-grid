<script setup lang="ts">
import type { HeaderCellInfo } from "@fragiola/data-grid-vue";
import { computed } from "vue";
import { Input } from "#/components/atoms/fields";
import { Select } from "#/components/ui/select";
import type { Task } from "../_kit/tasks";
import { FILTERS } from "./filters";
import * as styles from "./styles";

// A column's filter, by its kind; none for a column without one.

const props = defineProps<{ cell: HeaderCellInfo<Task>; value: unknown }>();
const emit = defineEmits<{ change: [value: unknown] }>();

const filter = computed(() => FILTERS[props.cell.key]);
const name = computed(() => props.cell.column?.name ?? props.cell.key);

function setText(event: Event) {
    if (event.target instanceof HTMLInputElement) {
        emit("change", event.target.value);
    }
}

function setChoice(choice: unknown) {
    const numeric = props.cell.key === "effectiveness";
    emit(
        "change",
        choice === "all" || choice === null
            ? undefined
            : numeric
              ? Number(choice)
              : choice,
    );
}
</script>

<template>
    <Input
        v-if="filter?.kind === 'text'"
        :aria-label="`Filter ${name}`"
        placeholder="Contains"
        :value="typeof value === 'string' ? value : ''"
        :class="styles.textFilter"
        @input="setText"
    />
    <Select.Root
        v-else-if="filter?.kind === 'select'"
        :items="filter.items"
        :model-value="value === undefined ? 'all' : String(value)"
        @update:model-value="setChoice"
    >
        <Select.Trigger
            :aria-label="`Filter ${name}`"
            :class="styles.selectFilter"
        >
            <Select.Value />
        </Select.Trigger>
        <Select.Content>
            <Select.Item
                v-for="choice in filter.items"
                :key="choice.value"
                :value="choice.value"
            >
                {{ choice.label }}
            </Select.Item>
        </Select.Content>
    </Select.Root>
</template>
