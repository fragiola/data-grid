<script setup lang="ts">
import type { HeaderCellInfo } from "@fragiola/data-grid-vue";
import { useColumnResizer } from "@fragiola/data-grid-vue/column-resize";
import { computed } from "vue";
import type { Person } from "../_kit/data";
import * as styles from "./styles";

// A header cell's handle, at the edge it moves (`state.edge`): the end edge, the left one right to
// left, dragged toward the end (to the left there) to grow its column; for the salary, pinned at
// the end, its start edge, dragged toward the start.

const props = defineProps<{ cell: HeaderCellInfo<Person> }>();

const { state, props: resizerProps } = useColumnResizer(() => props.cell);
const name = computed(
    () => (props.cell.group ?? props.cell.column).name ?? props.cell.key,
);
</script>

<template>
    <!-- the composable's props make it a separator, a focusable one (the APG's splitter), which an <hr> cannot be -->
    <div
        v-if="state.resizable"
        v-bind="resizerProps"
        :aria-label="`تغيير عرض ${name}`"
        :class="styles.resizer(state)"
    />
</template>
