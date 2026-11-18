<script setup lang="ts">
import type { HeaderCellInfo } from "@fragiola/data-grid-vue";
import { useColumnResizer } from "@fragiola/data-grid-vue/column-resize";
import type { Instrument } from "../_kit/market";
import * as styles from "./styles";

// A column's resize handle (the grid's separator: drag, keys, double-click to fit).

const props = defineProps<{ cell: HeaderCellInfo<Instrument> }>();

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
