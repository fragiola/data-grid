<script setup lang="ts">
import { computed } from "vue";
import * as styles from "./styles";

// The last prices as bars, scaled between their lowest and highest: worked out again only when
// the history is a new one.

const props = defineProps<{ history: readonly number[] }>();

const bars = computed(() => {
    const low = Math.min(...props.history);
    const range = Math.max(...props.history) - low || 1;
    return props.history.map((price, index) => ({
        x: index * 4,
        height: 2 + ((price - low) / range) * 22,
    }));
});
</script>

<template>
    <svg
        aria-hidden="true"
        :class="styles.timeline"
        :viewBox="`0 0 ${history.length * 4} 24`"
        preserveAspectRatio="none"
    >
        <rect
            v-for="bar in bars"
            :key="bar.x"
            :x="bar.x"
            :y="24 - bar.height"
            :width="3"
            :height="bar.height"
            :class="styles.bar"
        />
    </svg>
</template>
