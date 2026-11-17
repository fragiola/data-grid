<script setup lang="ts">
import { useDataGrid, useGridView } from "@fragiola/data-grid-vue";
import { ChevronRightIcon } from "@lucide/vue";
import { computed } from "vue";
import type { Order } from "./orders";
import * as styles from "./styles";

// The expander in an order's first cell. The cell is the tab stop (the grid's roving tabindex),
// so the button never is: a click toggles, and Enter or Space on the cell does (`onExpanderKey`).

const props = defineProps<{ order: Order; rowIndex: number }>();

// expands or collapses an order: the app's control, the grid's state (M1)
const { model } = useDataGrid<Order>();
const view = useGridView();
const expanded = computed(() => {
    void view.value;
    return model.is("row-expanded", { rowIndex: props.rowIndex });
});

function toggle() {
    model.run("expanded-rows.toggle", { rowIndex: props.rowIndex });
}
</script>

<template>
    <button
        type="button"
        :tabindex="-1"
        :aria-expanded="expanded"
        :aria-label="`${expanded ? 'Hide' : 'Show'} the items of order ${order.id}`"
        :class="styles.expander"
        @click="toggle"
    >
        <ChevronRightIcon :size="14" aria-hidden="true" />
    </button>
</template>
