<script setup lang="ts">
import * as styles from "./styles";

// A link out of a cell.

defineProps<{ href: string }>();
</script>

<template>
    <a :class="styles.link" :href="href" target="_blank" rel="noreferrer">
        <slot />
    </a>
</template>
