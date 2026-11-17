<script setup lang="ts">
import {
    type CellInfo,
    type GroupRow,
    useGroupToggle,
} from "@fragiola/data-grid-vue";
import { ChevronRight } from "@lucide/vue";
import { formatNumber, type Person } from "../_kit/data";
import * as styles from "./styles";

// A group row's label: its toggle, its value and how many people it holds.

const props = defineProps<{ cell: CellInfo<Person>; group: GroupRow }>();

const { state, props: toggle } = useGroupToggle(() => props.cell);
</script>

<template>
    <span :class="styles.groupLabel(group.depth)">
        <button
            type="button"
            v-bind="toggle"
            :aria-label="`${state.expanded ? 'Collapse' : 'Expand'} ${String(group.value)}`"
            :class="styles.toggle"
        >
            <ChevronRight
                aria-hidden="true"
                :class="styles.chevron(state.expanded)"
            />
        </button>
        <span :class="styles.groupValue">{{ String(group.value) }}</span>
        <span :class="styles.groupCount">
            {{ formatNumber(group.childCount) }}
        </span>
    </span>
</template>
