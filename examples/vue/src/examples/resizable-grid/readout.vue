<script setup lang="ts">
import {
    type DataGridRef,
    type Range,
    useColumnWindow,
    useRowWindow,
} from "@fragiola/data-grid-vue";
import type { Row } from "./row";
import * as styles from "./styles";

// What the grid shows at its size, read through its ref: the windows the engine reports.

const props = defineProps<{ gridRef: DataGridRef<Row> }>();

const rows = useRowWindow(props.gridRef);
const columns = useColumnWindow(props.gridRef);

function count(range: Range) {
    return range.end - range.start;
}
</script>

<template>
    <p :class="styles.readout">
        <span>Drag the grid's bottom corner to resize it.</span>
        <span data-testid="in-view"
            ><span :class="styles.figure">{{ count(rows.visible) }}</span>
            rows ×
            <span :class="styles.figure">{{ count(columns.visible) }}</span>
            columns in view</span
        >
    </p>
</template>
