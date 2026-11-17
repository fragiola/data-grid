<script setup lang="ts">
import { onBeforeUnmount, shallowRef } from "vue";
import { formatNumber } from "../_kit/data";
import { api } from "./server";
import * as styles from "./styles";

// What the app asked the server, newest first.

const log = shallowRef(api.log);
const unsubscribe = api.subscribe(() => {
    log.value = api.log;
});
onBeforeUnmount(unsubscribe);
</script>

<template>
    <aside :class="styles.log" aria-label="Requests">
        <p :class="styles.logTitle">
            {{ formatNumber(log.length) }}
            {{ log.length === 1 ? "request" : "requests" }}
        </p>
        <ol :class="styles.logList" data-testid="request-log">
            <li
                v-for="request in log.slice(-12).reverse()"
                :key="request.id"
                :class="styles.logItem"
            >
                {{ request.description }}
            </li>
        </ol>
    </aside>
</template>
