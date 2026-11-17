<script setup lang="ts">
import { type CellInfo, useRowDragHandle } from "@fragiola/data-grid-vue";
import { GripVertical } from "@lucide/vue";
import type { Task } from "../_kit/tasks";
import * as styles from "./styles";

// A row's handle, as the app draws it: the composable's props (they mark it for the grid and hide
// it from screen readers, which move rows with the keys) on an element of its own.

const props = defineProps<{ cell: CellInfo<Task> }>();

const { state, props: handleProps } = useRowDragHandle(() => props.cell);
</script>

<template>
    <span v-bind="handleProps" :class="styles.handle(state)">
        <GripVertical aria-hidden="true" :class="styles.grip" />
    </span>
</template>
