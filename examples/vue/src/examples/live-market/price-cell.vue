<script setup lang="ts">
import { formatPrice, type Instrument } from "../_kit/market";
import * as styles from "./styles";

// The price, lit up or down for a moment when it moves: the flash is a layer that fades out
// once, mounted again (its `key`) by the next move. A row scrolled into view long after its last
// move shows no flash.

/** how long a moved price stays lit, in milliseconds (the flash's fade, `styles.flash`) */
const FLASH = 700;

const props = defineProps<{ instrument: Instrument }>();

/** read as it renders: a new instrument (a move) renders it again */
const fresh = () => performance.now() - props.instrument.changedAt < FLASH;
</script>

<template>
    <span :class="styles.price">
        <span
            v-if="fresh()"
            :key="instrument.ticks"
            :data-flash="instrument.direction"
            :class="styles.flash(instrument.direction)"
        />
        <span :class="styles.priceValue">
            {{ formatPrice(instrument.price) }}
        </span>
    </span>
</template>
