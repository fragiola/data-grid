<script setup lang="ts" generic="TRow">
import type { ColumnWidths, DataGridRef } from "@fragiola/data-grid-vue";
import { computed } from "vue";
import * as styles from "./styles";
import { useDragged } from "./use-dragged";

// What changed: the column being dragged, else the widths the app keeps.

const props = defineProps<{
    gridRef: DataGridRef<TRow>;
    widths: ColumnWidths;
    /** every column's and group's name, by key */
    names: ReadonlyMap<string, string>;
}>();

const dragged = useDragged(props.gridRef);
const text = computed(() => {
    const resized = Object.entries(props.widths);
    return dragged.value
        ? `Resizing ${props.names.get(dragged.value.columnKey)} to ${dragged.value.width}px`
        : resized.length === 0
          ? "Every column at its own width"
          : resized
                .map(([key, width]) => `${props.names.get(key)} ${width}px`)
                .join(" · ");
});
</script>

<template>
    <span :class="styles.readout" data-testid="widths">{{ text }}</span>
</template>
