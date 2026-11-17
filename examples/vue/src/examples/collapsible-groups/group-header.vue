<script setup lang="ts">
import {
    type DataGridFeature,
    type HeaderCellInfo,
    headerCellContent,
    useDataGrid,
    useGroupLabel,
    useHeaderCell,
} from "@fragiola/data-grid-vue";
import type { ColumnGroupCollapseTypes } from "@fragiola/data-grid-vue/column-group-collapse";
import { ChevronRight } from "@lucide/vue";
import type { Person } from "../_kit/data";
import * as styles from "./styles";

// A group's header: its label, which stays in view while the group scrolls (`useGroupLabel`),
// holding the toggle that opens and closes it (the app's own button, the grid's command).

const props = defineProps<{ cell: HeaderCellInfo<Person> }>();

// the grid collapses its groups (`columnGroupCollapse()`): its commands are typed by it
const { model } = useDataGrid<
    Person,
    readonly [DataGridFeature<ColumnGroupCollapseTypes>]
>();
const { state } = useHeaderCell(() => props.cell);
const { props: label } = useGroupLabel(() => props.cell);

/** The group's name, as the header cell would render it (a node, its `renderHeaderCell`'s). */
const Name = () => headerCellContent(props.cell);

const toggle = () =>
    model.run("column-groups.toggle", { groupKey: props.cell.key });
</script>

<template>
    <span v-bind="label" :class="styles.label">
        <button
            v-if="state.collapsed !== undefined"
            type="button"
            :aria-label="cell.group?.name"
            :aria-expanded="!state.collapsed"
            :class="styles.toggle"
            @click="toggle"
        >
            <ChevronRight aria-hidden="true" />
        </button>
        <Name />
    </span>
</template>
