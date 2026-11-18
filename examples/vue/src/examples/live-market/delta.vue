<script setup lang="ts">
import { ArrowDown, ArrowUp } from "@lucide/vue";
import { computed } from "vue";
import * as styles from "./styles";

// An arrow up or down, coloured, and a signed figure (its slot; nothing for zero).

const props = defineProps<{ value: number }>();

const side = computed(() =>
    props.value > 0 ? "up" : props.value < 0 ? "down" : "flat",
);
</script>

<template>
    <span :class="styles.delta(side)">
        <ArrowUp v-if="side === 'up'" aria-hidden="true" :class="styles.arrow" />
        <ArrowDown
            v-else-if="side === 'down'"
            aria-hidden="true"
            :class="styles.arrow"
        />
        <slot />
    </span>
</template>
