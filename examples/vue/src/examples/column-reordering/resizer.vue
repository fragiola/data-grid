<script setup lang="ts" generic="TRow">
import type { HeaderCellInfo } from "@fragiola/data-grid-vue";
import { useColumnResizer } from "@fragiola/data-grid-vue/column-resize";
import { computed } from "vue";
import * as styles from "./styles";

// A column's resize handle, where it resizes: it works beside the drag that reorders.

const props = defineProps<{ cell: HeaderCellInfo<TRow> }>();

const resizer = useColumnResizer(() => props.cell);
const name = computed(
    () => (props.cell.group ?? props.cell.column).name ?? props.cell.key,
);
</script>

<template>
    <!-- the composable's props make it a separator, a focusable one (the APG's splitter), which an <hr> cannot be -->
    <div
        v-if="resizer.state.value.resizable"
        v-bind="resizer.props.value"
        :aria-label="`Resize ${name}`"
        :class="styles.resizer"
    />
</template>
