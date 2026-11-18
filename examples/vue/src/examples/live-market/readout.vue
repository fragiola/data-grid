<script setup lang="ts">
import {
    type DataGridRef,
    type Range,
    useColumnWindow,
    useRowWindow,
} from "@fragiola/data-grid-vue";
import { onBeforeUnmount, ref } from "vue";
import { formatNumber } from "../_kit/data";
import type { FeedStats, Instrument, MarketFeed } from "../_kit/market";
import * as styles from "./styles";

// The feed's figures (price changes and frames a second, from the feed twice a second) and the
// cells the grid renders (from its windows): this renders again, the grid does not.

const props = defineProps<{
    feed: MarketFeed;
    gridRef: DataGridRef<Instrument>;
    instruments: number;
}>();

const stats = ref<FeedStats>({ updatesPerSecond: 0, framesPerSecond: 0 });
onBeforeUnmount(
    props.feed.onStats((next) => {
        stats.value = next;
    }),
);
const rows = useRowWindow(props.gridRef);
const columns = useColumnWindow(props.gridRef);

function span(range: Range) {
    return range.end - range.start;
}
</script>

<template>
    <p :class="styles.readout">
        <span>
            <span :class="styles.liveFigure" data-testid="updates">{{
                formatNumber(stats.updatesPerSecond)
            }}</span>
            updates/s
        </span>
        <span>
            <span :class="styles.liveFigure" data-testid="fps">{{
                stats.framesPerSecond
            }}</span>
            fps
        </span>
        <span>
            <span :class="styles.figure">{{ formatNumber(instruments) }}</span>
            rows
        </span>
        <span>
            rendered:
            <span :class="styles.figure" data-testid="rendered-cells">{{
                formatNumber(span(rows.rendered) * span(columns.rendered))
            }}</span>
            cells
        </span>
    </p>
</template>
