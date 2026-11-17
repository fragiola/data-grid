<script setup lang="ts">
import { createFakeApi } from "../_kit/fake-api";
import { type LazyTree, useLazyTree } from "./lazy";

// The same files listed by a server, folder by folder, as they are expanded. A component that
// renders nothing of its own: it holds the mode's server and tree (from scratch each time the
// mode starts) and hands the tree to its slot.

defineSlots<{ default(props: { tree: LazyTree }): unknown }>();

const tree = useLazyTree(createFakeApi(600));
</script>

<template>
    <slot :tree="tree" />
</template>
