<script setup lang="ts">
import { useGridView } from "@fragiola/data-grid-vue";
import { sortColumnsOf } from "@fragiola/data-grid-vue/sorting";
import { ArrowDown, ArrowUp } from "@lucide/vue";
import { computed } from "vue";
import * as styles from "./styles";

// A sorted column's direction, after its name in the header (the grid sorts; the arrow is the app's).

const props = defineProps<{ columnKey: string }>();

const view = useGridView();
const sorted = computed(() =>
    sortColumnsOf(view.value).find(
        (entry) => entry.columnKey === props.columnKey,
    ),
);
</script>

<template>
    <template v-if="sorted">
        <ArrowUp
            v-if="sorted.direction === 'ascending'"
            aria-hidden="true"
            :class="styles.sortIcon"
        />
        <ArrowDown v-else aria-hidden="true" :class="styles.sortIcon" />
    </template>
</template>
