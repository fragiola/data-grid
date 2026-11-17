<script setup lang="ts">
import { onBeforeUnmount, shallowRef } from "vue";
import { formatNumber } from "../_kit/data";
import type { FakeApi } from "../_kit/fake-api";
import * as styles from "./styles";

// What the app asked its server for: the request count and the last twelve, newest first.

const props = defineProps<{ api: FakeApi }>();

const log = shallowRef(props.api.log);
onBeforeUnmount(
    props.api.subscribe(() => {
        log.value = props.api.log;
    }),
);
</script>

<template>
    <aside :class="styles.log" aria-label="Requests">
        <p :class="styles.logTitle" data-testid="request-count">{{
            `${formatNumber(log.length)} ${log.length === 1 ? "tile request" : "tile requests"}`
        }}</p>
        <ol :class="styles.logList" data-testid="request-log">
            <li
                v-for="request in log.slice(-12).reverse()"
                :key="request.id"
                :class="styles.logItem"
                :data-start="request.start"
                :data-end="request.end"
            >{{ request.description }}</li>
        </ol>
    </aside>
</template>
