<script setup lang="ts">
import type { InstrumentType } from "../_kit/market";
import * as styles from "./styles";

// The instrument's kind, as a badge of its own colour.

defineProps<{ type: InstrumentType }>();
</script>

<template>
    <span :class="styles.typeBadge(type)">{{ type }}</span>
</template>
