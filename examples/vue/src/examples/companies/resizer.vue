<script setup lang="ts">
import { type HeaderCellInfo, useColumnResizer } from "@fragiola/data-grid-vue";
import type { Company } from "../_kit/companies";
import * as styles from "./styles";

// A resizable column's handle, at its header cell's right edge: the grid drags it, moves it with
// the arrows (F2 on the header reaches it) and fits it to its content on a double click. None
// elsewhere.

const props = defineProps<{ cell: HeaderCellInfo<Company> }>();

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
