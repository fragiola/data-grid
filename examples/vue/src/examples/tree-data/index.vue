<script setup lang="ts">
import { type RowKey, typedDataGrid } from "@fragiola/data-grid-vue";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { rowSelection } from "@fragiola/data-grid-vue/row-selection";
import { sorting } from "@fragiola/data-grid-vue/sorting";
import { Search } from "@lucide/vue";
import { h, ref, useId } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { Input } from "#/components/atoms/fields";
import { Switch } from "#/components/ui/switch";
import { columns } from "./columns";
import FileGrid from "./file-grid.vue";
import type { Entry } from "./files";
import MemoryTree from "./memory-tree.vue";
import ServerTree from "./server-tree.vue";
import * as styles from "./styles";

/** The search field's icon, inside it at its start. */
const searchInset = {
    start: h(Search, { "aria-hidden": "true", class: styles.searchIcon }),
};

// the features the grid installs: sorting (without it, a sortable column never sorts), cell
// navigation (the keys, the active cell, the tab stop), row selection
const features = [sorting(), navigation(), rowSelection()] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Entry, typeof features>();

/** Loaded lazily, no keys under a row: a folder's entries are not all here. */
const NONE = (): readonly RowKey[] => [];

const lazy = ref(false);
const lazyLabel = useId();

const setLazy = (value: boolean) => {
    lazy.value = value;
};

/** A field's text, from its input event. */
const textOf = (event: Event) =>
    event.target instanceof HTMLInputElement ? event.target.value : "";
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.modes">
            <span :class="styles.mode">
                <Switch.Root
                    :aria-labelledby="lazyLabel"
                    :model-value="lazy"
                    @update:model-value="setLazy"
                >
                    <Switch.Thumb />
                </Switch.Root>
                <span :id="lazyLabel">Load folders from a server</span>
            </span>
            <span>
                <kbd :class="styles.key">Space</kbd> opens a folder,
                <!-- one line: a space between two keys a line break would drop -->
                <kbd :class="styles.key">→</kbd> <kbd :class="styles.key">←</kbd>
                on its name
            </span>
        </div>
        <!-- the same files listed by a server, folder by folder, as they are expanded -->
        <ServerTree v-if="lazy" v-slot="{ tree }">
            <DataGrid.Root
                :features="features"
                v-bind="tree"
                :columns="columns"
                :row-height="34"
                row-selection="multiple"
                :class="styles.root"
            >
                <FileGrid :sub-row-keys-of="NONE" />
            </DataGrid.Root>
        </ServerTree>
        <!-- the files in memory, searched and sorted -->
        <MemoryTree v-else v-slot="{ local }">
            <div :class="styles.toolbar">
                <Input.Template.Simple
                    aria-label="Search files"
                    placeholder="Search"
                    :value="local.filter.search"
                    :inset="searchInset"
                    :class="styles.search"
                    @input="local.filter.setSearch(textOf($event))"
                />
                <Clickable.Button
                    size="sm"
                    variant="ghost"
                    @click="local.group.expandAll()"
                >
                    Expand all
                </Clickable.Button>
                <Clickable.Button
                    size="sm"
                    variant="ghost"
                    @click="local.group.collapseAll()"
                >
                    Collapse all
                </Clickable.Button>
                <span :class="styles.count">
                    {{ local.filteredCount }} of {{ local.total }} entries
                </span>
            </div>
            <DataGrid.Root
                :features="features"
                v-bind="local.props"
                :columns="columns"
                :row-height="34"
                row-selection="multiple"
                :class="styles.root"
            >
                <FileGrid :sub-row-keys-of="local.group.subRowKeysOf" />
            </DataGrid.Root>
        </MemoryTree>
    </div>
</template>
