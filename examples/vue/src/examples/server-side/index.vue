<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import {
    type ColumnFilters,
    filtering,
} from "@fragiola/data-grid-vue/filtering";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { pageCount, pagination } from "@fragiola/data-grid-vue/pagination";
import { search } from "@fragiola/data-grid-vue/search";
import { type SortColumn, sorting } from "@fragiola/data-grid-vue/sorting";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "@lucide/vue";
import {
    computed,
    h,
    onScopeDispose,
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
import { fetchPeople } from "../_kit/people-server";
import { createServerQuery } from "../_kit/server-query";
import RequestLog from "./request-log.vue";
import * as styles from "./styles";

// the features the grid installs: sorting (without it, a sortable column never sorts), filtering,
// search and pagination (the column filters, the search text and the page, held by the grid's
// model: the app reads them to ask the server, no rows in memory), cell navigation (the keys, the
// active cell, the tab stop)
const features = [
    sorting(),
    filtering(),
    search(),
    pagination(),
    navigation(),
] as const;

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

// the external mode: the grid's features hold the sort (the header toggles it), the column
// filters, the search text and the page, controlled here; the app asks the server for the page
// they make (the fetch policy in `_kit/server-query.ts`) and the grid shows it
const sortColumns = shallowRef<readonly SortColumn[]>([
    { columnKey: "name", direction: "ascending" },
]);
const columnFilters = shallowRef<ColumnFilters>({});
const typed = ref("");
const searchText = ref("");
const pageIndex = ref(0);
const query = createServerQuery(fetchPeople);
const answer = shallowRef(query.state);
onScopeDispose(
    query.subscribe(() => {
        answer.value = query.state;
    }),
);
const page = computed(() => answer.value.answer ?? { rows: [], total: 0 });
const loading = computed(() => answer.value.loading);

// the search goes to the server once the typing pauses (and only when it changed: a page
// chosen meanwhile stays)
watch([typed, searchText], ([text, sent], _, onCleanup) => {
    if (text === sent) return;
    const timer = setTimeout(() => {
        searchText.value = text;
        pageIndex.value = 0;
    }, 250);
    onCleanup(() => clearTimeout(timer));
});

watchEffect(() => {
    query.ask({
        sortColumns: sortColumns.value,
        columnFilters: columnFilters.value,
        searchText: searchText.value,
        pageIndex: pageIndex.value,
        pageSize: PAGE_SIZE,
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

/** The team a filter holds: a list of one, the team chosen from the select. */
const team = computed(() => {
    const value = columnFilters.value.team;
    return Array.isArray(value) && typeof value[0] === "string" ? value[0] : "";
});

function chooseTeam(choice: unknown) {
    // a team chosen from a list: an exact value (a list filter), not a text
    columnFilters.value =
        typeof choice === "string" && choice !== "any"
            ? { team: [choice] }
            : {};
    pageIndex.value = 0;
}

function sortBy(next: readonly SortColumn[]) {
    sortColumns.value = next;
    pageIndex.value = 0;
}

function filterBy(next: ColumnFilters) {
    columnFilters.value = next;
    pageIndex.value = 0;
}

function searchFor(next: string) {
    typed.value = next;
    searchText.value = next;
    pageIndex.value = 0;
}

function goTo(next: number) {
    // the model keeps any page: the pages the server's total makes hold it
    pageIndex.value = Math.min(next, pages.value - 1);
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
                :column-filters="columnFilters"
                :on-column-filters-change="filterBy"
                :search-text="searchText"
                :on-search-text-change="searchFor"
                :page-index="pageIndex"
                :on-page-index-change="goTo"
                :page-size="PAGE_SIZE"
                :total-row-count="page.total"
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
