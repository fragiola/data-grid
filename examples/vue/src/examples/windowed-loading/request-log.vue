<script setup lang="ts">
import { onBeforeUnmount, shallowRef } from "vue";
import { formatNumber } from "../_kit/data";
import type { FakeApi } from "../_kit/fake-api";
import * as styles from "./styles";

// What the app asked its server for: the last requests, newest first.

const props = defineProps<{ api: FakeApi; block: number; total: number }>();

const log = shallowRef(props.api.log);
const unsubscribe = props.api.subscribe(() => {
    log.value = props.api.log;
});
onBeforeUnmount(unsubscribe);
</script>

<template>
    <aside :class="styles.log" aria-label="Requests">
        <p :class="styles.logTitle" data-testid="request-count">
            {{ formatNumber(log.length) }}
            {{ log.length === 1 ? "request" : "requests" }},
            {{ formatNumber(log.length * block) }} of
            {{ formatNumber(total) }} rows
        </p>
        <ol :class="styles.logList" data-testid="request-log">
            <li
                v-for="request in log.slice(-12).reverse()"
                :key="request.id"
                :class="styles.logItem"
                :data-start="request.start"
                :data-end="request.end"
            >
                {{ request.description }}
            </li>
        </ol>
    </aside>
</template>
