<script setup lang="ts" generic="TRow">
import {
    type HeaderCellInfo,
    headerCellContent,
    useGroupLabel,
} from "@fragiola/data-grid-vue";
import * as styles from "./styles";

// A group's name in a label that stays in view while the group scrolls: sticky in the group's
// cell, at the view's start once the group's start has scrolled out, never past its end.

const props = defineProps<{ cell: HeaderCellInfo<TRow> }>();

const label = useGroupLabel(() => props.cell);

/** the group's own content: its `renderHeaderCell`, else its name */
const Content = () => headerCellContent(props.cell);
</script>

<template>
    <span v-bind="label.props.value" :class="styles.label">
        <Content />
    </span>
</template>
