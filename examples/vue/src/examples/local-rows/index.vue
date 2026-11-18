<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import { filtering } from "@fragiola/data-grid-vue/filtering";
import { useLocalRows } from "@fragiola/data-grid-vue/local";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { pagination } from "@fragiola/data-grid-vue/pagination";
import { search } from "@fragiola/data-grid-vue/search";
import { sorting } from "@fragiola/data-grid-vue/sorting";
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Search,
} from "@lucide/vue";
import { computed, h, type VNodeChild } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { Input } from "#/components/atoms/fields";
import { Checkbox } from "#/components/ui/checkbox";
import { Select } from "#/components/ui/select";
import { formatMoney, formatNumber, type Person, people } from "../_kit/data";
import * as styles from "./styles";

/** The search field's icon, inside it at its start. */
const searchInset = {
    start: h(Search, { "aria-hidden": "true", class: styles.icon }),
};

// the features the grid installs: sorting (without it, a sortable column never sorts), cell
// navigation (the keys, the active cell, the tab stop)
// and filtering (the column filters), search (the search text), pagination (the page): `useLocalRows` applies them to the rows, the grid's
// model holds them
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

const all = people(1_000);

const TEAMS = [...new Set(all.map((person) => person.team))].sort();

/** The salary filter's choices: a minimum, or none. */
const SALARIES: Record<string, string> = {
    any: "Any salary",
    "60000": "From $60k",
    "90000": "From $90k",
    "120000": "From $120k",
};

const PAGE_SIZES: Record<string, string> = {
    "25": "25 a page",
    "50": "50 a page",
    "100": "100 a page",
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
        // its own filter: a minimum, not an equal value
        filter: (value, minimum) =>
            typeof value === "number" &&
            typeof minimum === "number" &&
            value >= minimum,
    },
    { key: "joined", name: "Joined", width: 130, sortable: true },
];

// every row is in memory: one composable filters, searches, sorts and pages them, and keeps
// that state itself. Its props go to the grid, its controls to the toolbar and the pager
const local = useLocalRows(all, columns, {
    features: features,
    pageSize: 25,
    defaultSortColumns: [{ columnKey: "name", direction: "ascending" }],
});
const checkedTeams = computed((): readonly unknown[] => {
    const teams = local.filter.values.team;
    return Array.isArray(teams) ? teams : [];
});
const minimum = computed(() => local.filter.values.salary);
const name = computed(() =>
    typeof local.filter.values.name === "string"
        ? local.filter.values.name
        : "",
);
const toggleTeam = (team: string) =>
    local.filter.set(
        "team",
        checkedTeams.value.includes(team)
            ? checkedTeams.value.filter((checked) => checked !== team)
            : [...checkedTeams.value, team],
    );

/** A field's text, from its input event. */
const textOf = (event: Event) =>
    event.target instanceof HTMLInputElement ? event.target.value : "";

const setSalary = (choice: unknown) =>
    local.filter.set(
        "salary",
        choice === "any" || choice === null ? undefined : Number(choice),
    );
const setPageSize = (size: unknown) => {
    // a cleared choice keeps the page size
    if (typeof size === "string") local.page.setSize(Number(size));
};
const clear = () => {
    local.filter.clear();
    local.filter.setSearch("");
};

const rowKey = (row: Person) => row.id;
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <div :class="styles.toolbarRow">
                <div :class="styles.search">
                    <Input.Template.Simple
                        aria-label="Search every column"
                        placeholder="Search"
                        :value="local.filter.search"
                        :inset="searchInset"
                        @input="local.filter.setSearch(textOf($event))"
                    />
                </div>
                <div :class="styles.nameFilter">
                    <Input.Template.Simple
                        aria-label="Name contains"
                        placeholder="Name contains"
                        :value="name"
                        @input="local.filter.set('name', textOf($event))"
                    />
                </div>
                <Select.Root
                    :items="SALARIES"
                    :model-value="
                        typeof minimum === 'number' ? String(minimum) : 'any'
                    "
                    @update:model-value="setSalary"
                >
                    <Select.Trigger :class="styles.select" aria-label="Salary">
                        <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                        <Select.Item
                            v-for="(label, value) in SALARIES"
                            :key="value"
                            :value="value"
                        >
                            {{ label }}
                        </Select.Item>
                    </Select.Content>
                </Select.Root>
            </div>
            <div :class="styles.toolbarRow">
                <fieldset :class="styles.teams">
                    <legend :class="styles.teamsTitle">Teams</legend>
                    <!-- Checkbox.Root renders the control the label names -->
                    <label v-for="team in TEAMS" :key="team" :class="styles.team">
                        <Checkbox.Root
                            :checked="checkedTeams.includes(team)"
                            @checked-change="toggleTeam(team)"
                        >
                            <Checkbox.Indicator />
                        </Checkbox.Root>
                        {{ team }}
                    </label>
                </fieldset>
                <Clickable.Button size="sm" variant="ghost" @click="clear">
                    Clear filters
                </Clickable.Button>
                <span :class="styles.count" data-testid="count">
                    {{ formatNumber(local.filteredCount) }} of
                    {{ formatNumber(local.total) }} people
                </span>
            </div>
        </div>
        <DataGrid.Root
            :features="features"
            :columns="columns"
            :row-key="rowKey"
            :row-height="36"
            :class="styles.root"
            v-bind="local.props"
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
                <DataGrid.Body>
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
                <!-- the grid's cell while it has no rows: the content laid out in it -->
                <DataGrid.Empty :class="styles.empty" data-testid="empty">
                    No one matches these filters.
                </DataGrid.Empty>
            </DataGrid.Grid>
        </DataGrid.Root>
        <nav :class="styles.pager" aria-label="Pages">
            <Clickable.Button
                size="sm"
                variant="outline"
                aria-label="First page"
                :disabled="!local.page.canPrevious"
                @click="local.page.first"
            >
                <ChevronsLeft aria-hidden="true" />
            </Clickable.Button>
            <Clickable.Button
                size="sm"
                variant="outline"
                aria-label="Previous page"
                :disabled="!local.page.canPrevious"
                @click="local.page.previous"
            >
                <ChevronLeft aria-hidden="true" />
            </Clickable.Button>
            <span :class="styles.pageOf" data-testid="page">
                Page {{ local.page.index + 1 }} of {{ local.page.count }}
            </span>
            <Clickable.Button
                size="sm"
                variant="outline"
                aria-label="Next page"
                :disabled="!local.page.canNext"
                @click="local.page.next"
            >
                <ChevronRight aria-hidden="true" />
            </Clickable.Button>
            <Clickable.Button
                size="sm"
                variant="outline"
                aria-label="Last page"
                :disabled="!local.page.canNext"
                @click="local.page.last"
            >
                <ChevronsRight aria-hidden="true" />
            </Clickable.Button>
            <Select.Root
                :items="PAGE_SIZES"
                :model-value="String(local.page.size)"
                @update:model-value="setPageSize"
            >
                <Select.Trigger
                    :class="styles.select"
                    aria-label="Rows per page"
                >
                    <Select.Value />
                </Select.Trigger>
                <Select.Content>
                    <Select.Item
                        v-for="(label, value) in PAGE_SIZES"
                        :key="value"
                        :value="value"
                    >
                        {{ label }}
                    </Select.Item>
                </Select.Content>
            </Select.Root>
        </nav>
    </div>
</template>
