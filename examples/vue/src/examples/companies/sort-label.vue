<script setup lang="ts">
import { useGridView } from "@fragiola/data-grid-vue";
import { ArrowDownIcon, ArrowUpIcon } from "@lucide/vue";
import { computed } from "vue";
import type { SortKey } from "./state";
import * as styles from "./styles";

// A sortable column's header: its icon (the `icon` slot), its name (the default one) and, while it
// is sorted, the direction. The grid sorts on a click, Enter or Space on the header cell; the
// arrow is the app's.

const props = defineProps<{ columnKey: SortKey }>();

const view = useGridView();
const sorted = computed(() =>
    view.value.sortColumns.find((entry) => entry.columnKey === props.columnKey),
);
</script>

<template>
    <span :class="styles.headerLabel">
        <slot name="icon" />
        <slot />
        <template v-if="sorted">
            <ArrowUpIcon
                v-if="sorted.direction === 'ascending'"
                aria-hidden="true"
                :class="styles.sortIcon"
            />
            <ArrowDownIcon v-else aria-hidden="true" :class="styles.sortIcon" />
        </template>
    </span>
</template>
