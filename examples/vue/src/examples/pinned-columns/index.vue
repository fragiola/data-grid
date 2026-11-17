<script setup lang="ts">
import {
    type Column,
    type ColumnOrGroup,
    typedDataGrid,
} from "@fragiola/data-grid-vue";
import { columnPinning } from "@fragiola/data-grid-vue/column-pinning";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import type { VNodeChild } from "vue";
import { measurement, type Person, people } from "../_kit/data";
import * as styles from "./styles";

// the features the grid installs: cell navigation (the keys, the active cell, the tab stop), pinned
// columns (without it, every column scrolls)
const features = [navigation(), columnPinning()] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Person, typeof features>();

const rows = people(1_000);

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

const FIRST_YEAR = 2025;
const YEARS = [FIRST_YEAR, FIRST_YEAR + 1, FIRST_YEAR + 2];

/** A month's score: one column per month, numbers on the right. */
function month(year: number, monthIndex: number): Column<Person, VNodeChild> {
    const columnIndex = (year - FIRST_YEAR) * 12 + monthIndex;
    return {
        key: `${year}-${monthIndex + 1}`,
        name: MONTHS[monthIndex],
        width: 84,
        getValue: (row) => measurement(row.id, columnIndex),
        renderCell: ({ value }) =>
            typeof value === "number" ? value.toFixed(1) : null,
        meta: { numeric: true },
    };
}

/** A person's months, every year: what the summary reads. */
function months(row: Person): number[] {
    return Array.from({ length: YEARS.length * 12 }, (_, columnIndex) =>
        measurement(row.id, columnIndex),
    );
}

/** A summary number: one decimal, on the right like the months. */
function summary(
    key: string,
    name: string,
    value: (scores: number[]) => number,
): Column<Person, VNodeChild> {
    return {
        key,
        name,
        width: 96,
        pinned: "end",
        getValue: (row) => value(months(row)),
        renderCell: ({ value }) =>
            typeof value === "number" ? value.toFixed(1) : null,
        meta: { numeric: true },
    };
}

// the person stays at the start (a pinned group: its columns pinned, first), the summary at the
// end (pinned last), three years of months scroll between them
const columns: ColumnOrGroup<Person, VNodeChild>[] = [
    {
        key: "person",
        name: "Person",
        children: [
            { key: "name", name: "Name", width: 180, pinned: "start" },
            { key: "team", name: "Team", width: 120, pinned: "start" },
        ],
    },
    ...YEARS.map(
        (year): ColumnOrGroup<Person, VNodeChild> => ({
            key: String(year),
            name: String(year),
            children: MONTHS.map((_, monthIndex) => month(year, monthIndex)),
        }),
    ),
    {
        key: "summary",
        name: "Summary",
        children: [
            summary(
                "average",
                "Average",
                (scores) =>
                    scores.reduce((sum, score) => sum + score, 0) /
                    scores.length,
            ),
            summary("best", "Best", (scores) => Math.max(...scores)),
        ],
    },
];

const rowKey = (row: Person) => row.id;
</script>

<template>
    <div :class="styles.frame">
        <DataGrid.Root
            :features="features"
            :columns="columns"
            :rows="rows"
            :row-key="rowKey"
            :row-height="34"
            :class="styles.root"
        >
            <DataGrid.Grid aria-label="Scores" :class="styles.grid">
                <DataGrid.Header :class="styles.header">
                    <DataGrid.HeaderRows v-slot="{ row }">
                        <DataGrid.HeaderRow
                            :row="row"
                            :class="styles.headerRow(row)"
                        >
                            <DataGrid.HeaderCells v-slot="{ cell }">
                                <DataGrid.HeaderCell
                                    :cell="cell"
                                    :class="styles.headerCell(cell)"
                                />
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
                                        cell.column.meta?.numeric
                                            ? styles.numeric(cell)
                                            : styles.cell(cell)
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
