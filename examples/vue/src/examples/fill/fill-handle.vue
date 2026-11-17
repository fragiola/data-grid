<script setup lang="ts" generic="TRow">
import { type CellInfo, useFillHandle } from "@fragiola/data-grid-vue";
import * as styles from "./styles";

// A cell's handle, as the app draws it: the composable's props on an element of its own.

const props = defineProps<{ cell: CellInfo<TRow> }>();

const handle = useFillHandle(() => props.cell);
</script>

<template>
    <span
        v-if="handle.state.value.visible"
        v-bind="handle.props.value"
        aria-hidden="true"
        :class="styles.handle(handle.state.value)"
    />
</template>
