<script setup lang="ts">
import {
    type LocalRowsResult,
    useLocalRows,
} from "@fragiola/data-grid-vue/local";
import { columns, getSubRows, rowKey } from "./columns";
import { features } from "./features";
import { type Entry, FILES } from "./files";

// The files in memory: one composable makes the tree, searches it (a match's folders stay) and
// sorts it. A component that renders nothing of its own: it holds the mode's state (from scratch
// each time the mode starts) and hands it to its slot.

defineSlots<{
    default(props: { local: LocalRowsResult<Entry, typeof features> }): unknown;
}>();

const local = useLocalRows(FILES, columns, {
    features,
    getSubRows,
    rowKey,
    defaultExpandedGroupKeys: ["src"],
});
</script>

<template>
    <slot :local="local" />
</template>
