<script setup lang="ts">
import { computed } from "vue";
import * as styles from "./styles";

// Today's volume, and a bar of it against the busiest the demo expects.

const props = defineProps<{ volume: number; label: string }>();

const share = computed(() => Math.min(props.volume / 2_000_000, 1));
</script>

<template>
    <span :class="styles.volume">
        <span :class="styles.volumeTrack">
            <span
                :class="styles.volumeBar"
                :style="{ inlineSize: `${Math.round(share * 100)}%` }"
            />
        </span>
        <span :class="styles.volumeValue">{{ label }}</span>
    </span>
</template>
