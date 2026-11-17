<script setup lang="ts">
import {
    type DataGridRef,
    type Range,
    useColumnWindow,
    useRowWindow,
} from "@fragiola/data-grid-vue";
import { formatNumber } from "../_kit/data";
import type { Row } from "./row";
import * as styles from "./styles";

// The grid's size, what is in view and what is rendered, read through its ref.

const props = defineProps<{
    gridRef: DataGridRef<Row>;
    rows: number;
    columns: number;
}>();

const rowWindow = useRowWindow(props.gridRef);
const columnWindow = useColumnWindow(props.gridRef);

function span(range: Range) {
    return range.end - range.start;
}
</script>

<template>
    <p :class="styles.readout" data-testid="readout">
        <span>
            <span :class="styles.figure">{{ formatNumber(rows) }}</span> rows ×
            <span :class="styles.figure">{{ formatNumber(columns) }}</span>
            columns =
            <span :class="styles.figure">{{
                formatNumber(rows * columns)
            }}</span>
            cells
        </span>
        <span>
            rows
            <span :class="styles.figure"
                >{{ formatNumber(rowWindow.visible.start + 1) }}–{{
                    formatNumber(rowWindow.visible.end)
                }}</span
            >
            in view
        </span>
        <span>
            rendered:
            <span :class="styles.figure" data-testid="rendered-cells">{{
                formatNumber(
                    span(rowWindow.rendered) * span(columnWindow.rendered),
                )
            }}</span>
            cells
        </span>
    </p>
</template>
