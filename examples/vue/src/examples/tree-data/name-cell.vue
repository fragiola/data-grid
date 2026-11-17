<script setup lang="ts">
import { type CellInfo, useGroupToggle } from "@fragiola/data-grid-vue";
import { ChevronRight, FileText, Folder } from "@lucide/vue";
import type { Entry } from "./files";
import * as styles from "./styles";

// An entry's name: indented by its depth, a folder's toggle (`useGroupToggle`) before it.

const props = defineProps<{ cell: CellInfo<Entry>; depth: number }>();

const { state, props: toggle } = useGroupToggle(() => props.cell);
</script>

<template>
    <span v-if="!cell.row" :class="styles.name(depth)" />
    <span v-else :class="styles.name(depth)">
        <button
            v-if="state.expandable"
            type="button"
            v-bind="toggle"
            :aria-label="`${state.expanded ? 'Collapse' : 'Expand'} ${cell.row.name}`"
            :class="styles.toggle"
        >
            <ChevronRight
                aria-hidden="true"
                :class="styles.chevron(state.expanded)"
            />
        </button>
        <span v-else :class="styles.spacer" />
        <component
            :is="cell.row.kind === 'folder' ? Folder : FileText"
            aria-hidden="true"
            :class="styles.icon(cell.row.kind)"
        />
        <span :class="styles.label">{{ cell.row.name }}</span>
    </span>
</template>
