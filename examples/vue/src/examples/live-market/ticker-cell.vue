<script setup lang="ts">
import { hash } from "../_kit/data";
import type { Instrument } from "../_kit/market";
import * as styles from "./styles";

// The ticker in bold, its name after it, and before them the instrument's logo: its ticker's
// first letters on a colour of its own (all are fictional). Each cell reads its instrument, a new
// object whenever it moves, so a cell renders again only when its row changed.

defineProps<{ instrument: Instrument }>();
</script>

<template>
    <span :class="styles.ticker">
        <span aria-hidden="true" :class="styles.logo(hash(instrument.id, 6))">
            {{ instrument.ticker.slice(0, 2) }}
        </span>
        <span :class="styles.symbol">{{ instrument.ticker }}</span>
        <span :class="styles.name">{{ instrument.name }}</span>
    </span>
</template>
