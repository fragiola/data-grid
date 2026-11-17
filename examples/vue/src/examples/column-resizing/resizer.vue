<script setup lang="ts" generic="TRow">
import type { HeaderCellInfo } from "@fragiola/data-grid-vue";
import { useColumnResizer } from "@fragiola/data-grid-vue/column-resize";
import { computed } from "vue";
import * as styles from "./styles";

// A header cell's handle: the composable's props on an element of the app's, which gives it its
// name, its place and its look. Under a cell that does not resize, there is none.

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
