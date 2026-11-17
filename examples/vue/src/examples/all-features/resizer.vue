<script setup lang="ts" generic="TRow">
import type { HeaderCellInfo } from "@fragiola/data-grid-vue";
import { useColumnResizer } from "@fragiola/data-grid-vue/column-resize";
import * as styles from "./styles";

// A header cell's resize handle: the composable's props on an element of the app's.

const props = defineProps<{ cell: HeaderCellInfo<TRow> }>();

const resizer = useColumnResizer(() => props.cell);
</script>

<template>
    <!-- the composable's props make it a separator, a focusable one (the APG's splitter), which an <hr> cannot be -->
    <div
        v-if="resizer.state.value.resizable"
        v-bind="resizer.props.value"
        :aria-label="`Resize ${cell.column?.name ?? cell.key}`"
        :class="styles.resizer"
    />
</template>
