<script setup lang="ts">
import * as styles from "./styles";

// A native checkbox: checked, or neither checked nor not (`indeterminate`, set on the element).

withDefaults(
    defineProps<{ label: string; checked: boolean; indeterminate?: boolean }>(),
    { indeterminate: false },
);

const emit = defineEmits<{ toggle: [shiftKey: boolean] }>();
</script>

<template>
    <!-- a checkbox's change comes from its click: Shift+click selects a range -->
    <input
        type="checkbox"
        :aria-label="label"
        :checked="checked"
        :indeterminate="indeterminate"
        :class="styles.checkbox"
        @click="emit('toggle', $event.shiftKey)"
    />
</template>
