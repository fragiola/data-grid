<script setup lang="ts">
import { pageCount } from "@fragiola/data-grid/local";
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { type SortColumn, sorting } from "@fragiola/data-grid-vue/sorting";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "@lucide/vue";
import {
    computed,
    h,
    ref,
    shallowRef,
    type VNodeChild,
    watch,
    watchEffect,
} from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { Input } from "#/components/atoms/fields";
import { Select } from "#/components/ui/select";
import { formatMoney, formatNumber, type Person } from "../_kit/data";
import RequestLog from "./request-log.vue";
import { fetchPeople } from "./server";
import * as styles from "./styles";

// the features the grid installs: sorting (without it, a sortable column never sorts), cell
// navigation (the keys, the active cell, the tab stop)
const features = [sorting(), navigation()] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Person, typeof features>();

const PAGE_SIZE = 50;

const TEAMS: Record<string, string> = {
    any: "Every team",
    Platform: "Platform",
    Design: "Design",
    Data: "Data",
    Mobile: "Mobile",
    Growth: "Growth",
    Security: "Security",
};

const columns: Column<Person, VNodeChild>[] = [
    { key: "name", name: "Name", width: 180, sortable: true },
    { key: "email", name: "Email", width: 260 },
    { key: "city", name: "City", width: 140, sortable: true },
    { key: "team", name: "Team", width: 130, sortable: true },
    {
        key: "salary",
        name: "Salary",
        width: 130,
        sortable: true,
        renderCell: ({ row }) => formatMoney(row.salary),
    },
];

// the external mode: the app keeps the sort (grid state, the header toggles it), the filter,
// the search and the page, and asks the server; the grid shows the page it gets back
const sortColumns = shallowRef<readonly SortColumn[]>([
    { columnKey: "name", direction: "ascending" },
]);
const team = ref("");
const typed = ref("");
const search = ref("");
const pageIndex = ref(0);
const page = shallowRef<{ rows: readonly Person[]; total: number }>({
    rows: [],
    total: 0,
});
const loading = ref(true);

// the search goes to the server once the typing pauses (and only when it changed: a page
// chosen meanwhile stays)
watch([typed, search], ([text, sent], _, onCleanup) => {
    if (text === sent) return;
    const timer = setTimeout(() => {
        search.value = text;
        pageIndex.value = 0;
    }, 250);
    onCleanup(() => clearTimeout(timer));
});

watchEffect((onCleanup) => {
    // an answer to a query the app has moved on from is dropped
    let current = true;
    loading.value = true;
    fetchPeople({
        sortColumns: sortColumns.value,
        team: team.value,
        search: search.value,
        pageIndex: pageIndex.value,
        pageSize: PAGE_SIZE,
    }).then((answer) => {
        if (!current) return;
        page.value = answer;
        loading.value = false;
    });
    onCleanup(() => {
        current = false;
    });
});

const pages = computed(() => pageCount(page.value.total, PAGE_SIZE));

const searchInset = {
    start: h(SearchIcon, { "aria-hidden": "true", class: styles.icon }),
};

function setTyped(event: Event) {
    if (event.target instanceof HTMLInputElement)
        typed.value = event.target.value;
}

function chooseTeam(choice: unknown) {
    team.value = typeof choice === "string" && choice !== "any" ? choice : "";
    pageIndex.value = 0;
}

function sortBy(next: readonly SortColumn[]) {
    sortColumns.value = next;
    pageIndex.value = 0;
}

const rowKey = (row: Person) => row.id;
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <Input.Template.Simple
                aria-label="Search every column"
                placeholder="Search"
                :value="typed"
                :inset="searchInset"
                :class="styles.search"
                @input="setTyped"
            />
            <Select.Root
                :items="TEAMS"
                :model-value="team || 'any'"
                @update:model-value="chooseTeam"
            >
                <Select.Trigger :class="styles.select" aria-label="Team">
                    <Select.Value />
                </Select.Trigger>
                <Select.Content>
                    <Select.Item
                        v-for="(label, value) in TEAMS"
                        :key="value"
                        :value="value"
                    >
                        {{ label }}
                    </Select.Item>
                </Select.Content>
            </Select.Root>
            <span :class="styles.count" data-testid="count" aria-live="polite">
                {{ loading ? "Loading…" : `${formatNumber(page.total)} people` }}
            </span>
        </div>
        <div :class="styles.layout">
            <DataGrid.Root
                :features="features"
                :columns="columns"
                :rows="page.rows"
                :row-key="rowKey"
                :row-height="36"
                :sort-columns="sortColumns"
                :on-sort-columns-change="sortBy"
                :class="styles.root"
                :aria-busy="loading || undefined"
            >
                <DataGrid.Grid aria-label="People" :class="styles.grid">
                    <DataGrid.Header :class="styles.header">
                        <DataGrid.HeaderRow :class="styles.headerRow">
                            <DataGrid.HeaderCells v-slot="{ cell }">
                                <DataGrid.HeaderCell
                                    :cell="cell"
                                    :class="styles.headerCell"
                                />
                            </DataGrid.HeaderCells>
                        </DataGrid.HeaderRow>
                    </DataGrid.Header>
                    <DataGrid.Body :class="styles.body(loading)">
                        <DataGrid.Rows v-slot="{ row }">
                            <DataGrid.Row :row="row" :class="styles.row(row)">
                                <DataGrid.Cells v-slot="{ cell }">
                                    <DataGrid.Cell
                                        :cell="cell"
                                        :class="styles.cell"
                                    />
                                </DataGrid.Cells>
                            </DataGrid.Row>
                        </DataGrid.Rows>
                    </DataGrid.Body>
                </DataGrid.Grid>
            </DataGrid.Root>
            <RequestLog />
        </div>
        <nav :class="styles.pager" aria-label="Pages">
            <Clickable.Button
                size="sm"
                variant="outline"
                aria-label="Previous page"
                :disabled="pageIndex === 0"
                @click="pageIndex = Math.max(0, pageIndex - 1)"
            >
                <ChevronLeftIcon aria-hidden="true" />
            </Clickable.Button>
            <span :class="styles.pageOf" data-testid="page">
                Page {{ pageIndex + 1 }} of {{ pages }}
            </span>
            <Clickable.Button
                size="sm"
                variant="outline"
                aria-label="Next page"
                :disabled="pageIndex >= pages - 1"
                @click="pageIndex = Math.min(pages - 1, pageIndex + 1)"
            >
                <ChevronRightIcon aria-hidden="true" />
            </Clickable.Button>
        </nav>
    </div>
</template>
