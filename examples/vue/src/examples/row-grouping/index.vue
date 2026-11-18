<script setup lang="ts">
import {
    type Column,
    type RowKey,
    typedDataGrid,
} from "@fragiola/data-grid-vue";
import { columnPinning } from "@fragiola/data-grid-vue/column-pinning";
import { groupKeyOf, useLocalRows } from "@fragiola/data-grid-vue/local";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { rowGrouping } from "@fragiola/data-grid-vue/row-grouping";
import { rowSelection } from "@fragiola/data-grid-vue/row-selection";
import { sorting } from "@fragiola/data-grid-vue/sorting";
import { Search } from "@lucide/vue";
import { h, ref, type VNodeChild } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { Input } from "#/components/atoms/fields";
import { Select } from "#/components/ui/select";
import { formatMoney, formatNumber, type Person, people } from "../_kit/data";
import GroupLabel from "./group-label.vue";
import { AGGREGATES, GROUP_BY, GROUPINGS, type Grouping } from "./grouping";
import SelectGroup from "./select-group.vue";
import SelectRow from "./select-row.vue";
import * as styles from "./styles";

/** The search field's icon, inside it at its start. */
const searchInset = {
    start: h(Search, { "aria-hidden": "true", class: styles.icon }),
};

// the features the grid installs: sorting (without it, a sortable column never sorts), cell
// navigation (the keys, the active cell, the tab stop), row selection, pinned columns (without it,
// every column scrolls), row grouping (a group's toggle and keys; without it, nothing expands)
const features = [
    sorting(),
    navigation(),
    rowSelection(),
    columnPinning(),
    rowGrouping(),
] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Person, typeof features>();

const ROWS = people(500);

/** A person's key: what the selection holds, and what selecting a group selects. */
const rowKey = (person: Person) => person.id;

/**
 * Who joined before 2012 is archived: never selected, by a checkbox, a group's, a range or "every
 * row" (the grid asks the rows it has; a group's keys leave them out, collapsed or not).
 */
const isSelectable = (person: Person) => person.joined >= "2012";

const columns: Column<Person, VNodeChild>[] = [
    { key: "select", width: 44, pinned: "start" },
    { key: "name", name: "Name", width: 250, pinned: "start", sortable: true },
    { key: "team", name: "Team", width: 120, sortable: true },
    { key: "city", name: "City", width: 130, sortable: true },
    {
        key: "salary",
        name: "Salary",
        width: 140,
        sortable: true,
        renderCell: ({ row }) => formatMoney(row.salary),
        // a group row's salary is its payroll, the aggregate
        renderGroupCell: ({ value }) =>
            typeof value === "number" ? formatMoney(value) : null,
    },
    { key: "joined", name: "Joined", width: 120, sortable: true },
    { key: "email", name: "Email", width: 260 },
];

const grouping = ref<Grouping>("team");
const selected = ref<readonly RowKey[]>([]);
// the rows in memory searched, sorted and grouped by one composable; it keeps the expanded groups
const local = useLocalRows(ROWS, columns, () => ({
    groupBy: GROUP_BY[grouping.value],
    aggregates: AGGREGATES,
    rowKey,
    isRowSelectable: isSelectable,
    defaultSortColumns: [{ columnKey: "name", direction: "ascending" }],
    defaultExpandedGroupKeys: [groupKeyOf([["team", "Design"]])],
}));

const setGrouping = (choice: unknown) => {
    if (choice === "team" || choice === "team-city") {
        grouping.value = choice;
    }
};
const setSearch = (event: Event) => {
    if (event.target instanceof HTMLInputElement) {
        local.filter.setSearch(event.target.value);
    }
};
const setSelected = (keys: readonly RowKey[]) => {
    selected.value = keys;
};
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <Select.Root
                :items="GROUPINGS"
                :model-value="grouping"
                @update:model-value="setGrouping"
            >
                <Select.Trigger :class="styles.select" aria-label="Group rows">
                    <Select.Value />
                </Select.Trigger>
                <Select.Content>
                    <Select.Item
                        v-for="(label, value) in GROUPINGS"
                        :key="value"
                        :value="value"
                    >
                        {{ label }}
                    </Select.Item>
                </Select.Content>
            </Select.Root>
            <Input.Template.Simple
                aria-label="Search every column"
                placeholder="Search"
                :value="local.filter.search"
                :inset="searchInset"
                :class="styles.search"
                @input="setSearch"
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
            <span :class="styles.count" data-testid="selected-count">
                {{ formatNumber(selected.length) }} selected ·
                {{ formatNumber(local.filteredCount) }} people
            </span>
        </div>
        <DataGrid.Root
            :features="features"
            v-bind="local.props"
            :columns="columns"
            :row-height="38"
            row-selection="multiple"
            :is-row-selectable="isSelectable"
            :selected-row-keys="selected"
            :on-selected-row-keys-change="setSelected"
            :class="styles.root"
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
                        <DataGrid.Row
                            :row="row"
                            :class="
                                styles.row(
                                    row,
                                    row.row !== undefined &&
                                        !isSelectable(row.row),
                                )
                            "
                        >
                            <DataGrid.Cells v-slot="{ cell }">
                                <!-- what a cell shows beyond its default: the checkboxes, a group's label, an indented name -->
                                <DataGrid.Cell :cell="cell" :class="styles.cell">
                                    <template
                                        v-if="cell.column.key === 'select'"
                                        #default
                                    >
                                        <SelectGroup
                                            v-if="cell.group"
                                            :row-index="cell.rowIndex"
                                            :group="cell.group"
                                        />
                                        <SelectRow
                                            v-else-if="cell.row"
                                            :row-index="cell.rowIndex"
                                            :name="cell.row.name"
                                        />
                                    </template>
                                    <template
                                        v-else-if="cell.column.key === 'name'"
                                        #default
                                    >
                                        <GroupLabel
                                            v-if="cell.group"
                                            :cell="cell"
                                            :group="cell.group"
                                        />
                                        <span
                                            v-else
                                            :class="styles.name(row.depth)"
                                        >
                                            {{ cell.row?.name }}
                                        </span>
                                    </template>
                                </DataGrid.Cell>
                            </DataGrid.Cells>
                        </DataGrid.Row>
                    </DataGrid.Rows>
                </DataGrid.Body>
            </DataGrid.Grid>
        </DataGrid.Root>
    </div>
</template>
