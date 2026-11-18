<script setup lang="ts">
import { formatAmount } from "../_kit/market";
import Delta from "./delta.vue";
import * as styles from "./styles";

// A movement beside a pill: the day's (or the position's) change, then the figure it moves.

defineProps<{ delta: number; value: string; tone: number }>();
</script>

<template>
    <span :class="styles.deltaPill">
        <Delta :value="delta">{{ formatAmount(delta) }}</Delta>
        <span :class="styles.pill(tone)">{{ value }}</span>
    </span>
</template>
