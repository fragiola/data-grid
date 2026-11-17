<script setup lang="ts">
import {
    type Column,
    type ColumnOrGroup,
    typedDataGrid,
    useDataGridRef,
} from "@fragiola/data-grid-vue";
import type { VNodeChild } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { formatNumber, measurement, type Person, people } from "../_kit/data";
import GroupHeader from "./group-header.vue";
import * as styles from "./styles";

// The parts typed by the row type: a template cannot pass `Person` as a type argument.
const DataGrid = typedDataGrid<Person>();

const rows = people(500);

const YEARS = [2025, 2026];
const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

/** A rep's sales in a month (0–1,000 units), from the rep and the month. */
const sales = (row: Person, year: number, month: number) =>
    Math.round(measurement(row.id, (year - 2025) * 12 + month) * 10);

/** The sales of a range of months: a quarter's, a year's. */
const sum = (row: Person, year: number, from: number, to: number) => {
    let total = 0;
    for (let month = from; month < to; month++) {
        total += sales(row, year, month);
    }
    return total;
};

const units = (value: unknown) =>
    typeof value === "number" ? formatNumber(value) : null;

/**
 * A quarter: its three months while it is open, its total always (the column a closed quarter
 * keeps). A month shows only expanded (`groupShow`).
 */
function quarter(
    year: number,
    index: number,
): ColumnOrGroup<Person, VNodeChild> {
    const first = index * 3;
    const months: Column<Person, VNodeChild>[] = [0, 1, 2].map((offset) => ({
        key: `${year}-${first + offset + 1}`,
        name: MONTHS[first + offset],
        width: 76,
        groupShow: "expanded",
        getValue: (row) => sales(row, year, first + offset),
        renderCell: ({ value }) => units(value),
        meta: { numeric: true },
    }));
    return {
        key: `${year}-q${index + 1}`,
        name: `Q${index + 1}`,
        collapsible: true,
        groupShow: "expanded",
        children: [
            ...months,
            {
                key: `${year}-q${index + 1}-total`,
                name: "Total",
                width: 88,
                getValue: (row) => sum(row, year, first, first + 3),
                renderCell: ({ value }) => units(value),
                meta: { numeric: true, total: true },
            },
        ],
    };
}

/** A year: its quarters while it is open, its total while it is closed. */
function year(value: number): ColumnOrGroup<Person, VNodeChild> {
    return {
        key: String(value),
        name: String(value),
        collapsible: true,
        children: [
            ...[0, 1, 2, 3].map((index) => quarter(value, index)),
            {
                key: `${value}-total`,
                name: "Total",
                width: 96,
                groupShow: "collapsed",
                getValue: (row) => sum(row, value, 0, 12),
                renderCell: ({ value: total }) => units(total),
                meta: { numeric: true, total: true },
            },
        ],
    };
}

// the rep pinned at the start, then each year under its quarters and months: three header rows
const columns: ColumnOrGroup<Person, VNodeChild>[] = [
    { key: "name", name: "Rep", width: 180, pinned: "start" },
    ...YEARS.map(year),
];

/** Every collapsible group's key: what "Collapse all" collapses. */
const ALL_GROUPS = YEARS.flatMap((value) => [
    String(value),
    ...[1, 2, 3, 4].map((index) => `${value}-q${index}`),
]);

// 2025 starts closed, its total showing; 2026 open, its first quarter closed
const COLLAPSED = ["2025", "2026-q1"];

const gridRef = useDataGridRef<Person>();
const setCollapsed = (groupKeys: readonly string[]) =>
    gridRef.current?.model.run("column-groups.set", { groupKeys });

const rowKey = (row: Person) => row.id;
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <span>Open a year or a quarter from its header</span>
            <Clickable.Button
                size="sm"
                variant="outline"
                :class="styles.toolbarStart"
                @click="setCollapsed([])"
            >
                Expand all
            </Clickable.Button>
            <Clickable.Button
                size="sm"
                variant="outline"
                @click="setCollapsed(ALL_GROUPS)"
            >
                Collapse all
            </Clickable.Button>
        </div>
        <DataGrid.Root
            :columns="columns"
            :rows="rows"
            :row-key="rowKey"
            :row-height="34"
            :default-collapsed-group-keys="COLLAPSED"
            :grid-ref="gridRef"
            :class="styles.root"
        >
            <DataGrid.Grid aria-label="Sales" :class="styles.grid">
                <DataGrid.Header :class="styles.header">
                    <DataGrid.HeaderRows v-slot="{ row }">
                        <DataGrid.HeaderRow
                            :row="row"
                            :class="styles.headerRow(row)"
                        >
                            <DataGrid.HeaderCells v-slot="{ cell }">
                                <!-- its look by its state: the render slot's -->
                                <DataGrid.HeaderCell :cell="cell">
                                    <template
                                        #render="{ props, state, children }"
                                    >
                                        <div
                                            v-bind="props"
                                            :class="styles.headerCell(state)"
                                        >
                                            <component :is="children" />
                                        </div>
                                    </template>
                                    <template v-if="cell.group" #default>
                                        <GroupHeader :cell="cell" />
                                    </template>
                                </DataGrid.HeaderCell>
                            </DataGrid.HeaderCells>
                        </DataGrid.HeaderRow>
                    </DataGrid.HeaderRows>
                </DataGrid.Header>
                <DataGrid.Body>
                    <DataGrid.Rows v-slot="{ row }">
                        <DataGrid.Row :row="row" :class="styles.row(row)">
                            <DataGrid.Cells v-slot="{ cell }">
                                <DataGrid.Cell
                                    :cell="cell"
                                    :class="
                                        cell.column.meta?.total
                                            ? styles.total
                                            : cell.column.meta?.numeric
                                              ? styles.numeric
                                              : styles.cell
                                    "
                                />
                            </DataGrid.Cells>
                        </DataGrid.Row>
                    </DataGrid.Rows>
                </DataGrid.Body>
            </DataGrid.Grid>
        </DataGrid.Root>
    </div>
</template>
