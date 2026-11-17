<script setup lang="ts">
import { Copy, Trash2 } from "@lucide/vue";
import { Clickable } from "#/components/atoms/clickable";
import * as styles from "./styles";

// A task's actions: copy it, delete it.

defineProps<{ name: string }>();

const emit = defineEmits<{ duplicate: []; remove: [] }>();
</script>

<template>
    <span :class="styles.actions">
        <Clickable.Button
            size="sm"
            variant="ghost"
            :aria-label="`Duplicate ${name}`"
            @click="emit('duplicate')"
        >
            <Copy aria-hidden="true" />
        </Clickable.Button>
        <Clickable.Button
            size="sm"
            variant="ghost"
            :aria-label="`Delete ${name}`"
            @click="emit('remove')"
        >
            <Trash2 aria-hidden="true" />
        </Clickable.Button>
    </span>
</template>
