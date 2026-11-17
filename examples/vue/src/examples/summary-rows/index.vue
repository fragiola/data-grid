<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import { useLocalRows } from "@fragiola/data-grid-vue/local";
import { Search } from "@lucide/vue";
import { computed, h, type VNodeChild } from "vue";
import { Input } from "#/components/atoms/fields";
import { formatMoney, type Person, people } from "../_kit/data";
import * as styles from "./styles";
import Summary from "./summary.vue";
import { totalsOf } from "./totals";

/** The search field's icon, inside it at its start. */
const searchInset = {
    start: h(Search, { "aria-hidden": "true", class: styles.icon }),
};

// The parts typed by the row type: a template cannot pass `Person` as a type argument.
const DataGrid = typedDataGrid<Person>();

const all = people(500);

const columns: Column<Person, VNodeChild>[] = [
    { key: "name", name: "Name", width: 190, pinned: "start", sortable: true },
    {
        key: "team",
        name: "Team",
        width: 130,
        sortable: true,
        // the bottom row's count of teams and cities spans both columns
        colSpan: (args) =>
            args.type === "summary" && args.position === "bottom"
                ? 2
                : undefined,
    },
    { key: "city", name: "City", width: 140, sortable: true },
    { key: "email", name: "Email", width: 260 },
    {
        key: "salary",
        name: "Salary",
        width: 130,
        sortable: true,
        renderCell: ({ row }) => formatMoney(row.salary),
    },
    { key: "joined", name: "Joined", width: 130, sortable: true },
];

// the rows in memory, searched and sorted by one composable; the totals follow what it leaves
const local = useLocalRows(all, columns, {
    defaultSortColumns: [{ columnKey: "name", direction: "ascending" }],
});
const totals = computed(() => totalsOf(local.filteredRows));

const rowKey = (row: Person) => row.id;
const setSearch = (event: Event) => {
    if (event.target instanceof HTMLInputElement) {
        local.filter.setSearch(event.target.value);
    }
};
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <Input.Template.Simple
                aria-label="Search every column"
                placeholder="Search"
                :value="local.filter.search"
                :inset="searchInset"
                :class="styles.search"
                @input="setSearch"
            />
        </div>
        <DataGrid.Root
            v-bind="local.props"
            :columns="columns"
            :row-key="rowKey"
            :row-height="36"
            :summary-rows="{ top: 1, bottom: 1 }"
            :summary-row-height="38"
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
                <Summary position="top" :totals="totals" />
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
                <!-- after the body: it stays at the view's bottom edge -->
                <Summary position="bottom" :totals="totals" />
            </DataGrid.Grid>
        </DataGrid.Root>
    </div>
</template>
