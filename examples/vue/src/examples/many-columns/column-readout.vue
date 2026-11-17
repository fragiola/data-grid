<script setup lang="ts" generic="TRow">
import { type DataGridRef, useColumnWindow } from "@fragiola/data-grid-vue";
import { formatNumber } from "../_kit/data";
import * as styles from "./styles";

// The column window, through the grid's ref: this re-renders as it moves, the grid does not.

const props = defineProps<{ gridRef: DataGridRef<TRow>; columns: number }>();

const columnWindow = useColumnWindow(props.gridRef);
</script>

<template>
    <p :class="styles.readout" data-testid="readout">
        <span>
            <span :class="styles.figure">{{ formatNumber(columns) }}</span>
            columns
        </span>
        <span>
            in view:
            <span :class="styles.figure" data-testid="visible-columns"
                >{{ formatNumber(columnWindow.visible.start + 1) }}–{{
                    formatNumber(columnWindow.visible.end)
                }}</span
            >
        </span>
        <span>
            rendered:
            <span :class="styles.figure" data-testid="rendered-columns"
                >{{ formatNumber(columnWindow.rendered.start + 1) }}–{{
                    formatNumber(columnWindow.rendered.end)
                }}</span
            >
        </span>
    </p>
</template>
