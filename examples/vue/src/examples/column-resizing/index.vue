<script setup lang="ts">
import {
    type ColumnOrGroup,
    type ColumnWidths,
    type HeaderCellInfo,
    headerCellContent,
    typedDataGrid,
    useDataGridRef,
} from "@fragiola/data-grid-vue";
import { columnPinning } from "@fragiola/data-grid-vue/column-pinning";
import { columnResize } from "@fragiola/data-grid-vue/column-resize";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { RotateCcw } from "@lucide/vue";
import { type FunctionalComponent, ref, type VNodeChild } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { formatMoney, type Person, people } from "../_kit/data";
import Resizer from "./resizer.vue";
import * as styles from "./styles";
import WidthsReadout from "./widths-readout.vue";

// the features the grid installs: cell navigation (the keys, the active cell, the tab stop), column
// resizing (its handles, keys and fits), pinned columns (without it, every column scrolls)
const features = [navigation(), columnResize(), columnPinning()] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Person, typeof features>();

const rows = people(1_000);

// "#" keeps its width (not resizable); the others resize within their limits (40px at least by
// default). Name is pinned, and a group's handle resizes its columns together.
const columns: ColumnOrGroup<Person, VNodeChild>[] = [
    {
        key: "id",
        name: "#",
        width: 64,
        pinned: "start",
        meta: { numeric: true },
    },
    {
        key: "name",
        name: "Name",
        width: 180,
        pinned: "start",
        resizable: true,
        minWidth: 120,
        maxWidth: 320,
    },
    {
        key: "contact",
        name: "Contact",
        children: [
            {
                key: "email",
                name: "Email",
                width: 240,
                resizable: true,
                minWidth: 160,
            },
            { key: "city", name: "City", width: 140, resizable: true },
        ],
    },
    {
        key: "work",
        name: "Work",
        children: [
            {
                key: "team",
                name: "Team",
                width: 120,
                resizable: true,
                minWidth: 80,
                maxWidth: 200,
            },
            { key: "joined", name: "Joined", width: 120, resizable: true },
            {
                key: "salary",
                name: "Salary",
                width: 120,
                resizable: true,
                minWidth: 90,
                maxWidth: 180,
                renderCell: ({ row }) => formatMoney(row.salary),
                meta: { numeric: true },
            },
        ],
    },
];

/** Every column's and group's name by key, for the readout. */
function namesOf(
    entries: readonly ColumnOrGroup<Person, VNodeChild>[],
): Map<string, string> {
    const names = new Map<string, string>();
    const visit = (list: readonly ColumnOrGroup<Person, VNodeChild>[]) => {
        for (const entry of list) {
            names.set(entry.key, entry.name ?? entry.key);
            if (entry.children) visit(entry.children);
        }
    };
    visit(entries);
    return names;
}

const NAMES = namesOf(columns);

/** A header cell's own content: its group's or column's `renderHeaderCell`, else its name. */
const HeaderContent: FunctionalComponent<{ cell: HeaderCellInfo<Person> }> = (
    props,
) => headerCellContent(props.cell);

// the grid resizes; the app keeps the widths (to show them, to reset them, to save them)
const widths = ref<ColumnWidths>({});
const gridRef = useDataGridRef<Person>();

const rowKey = (row: Person) => row.id;
const setWidths = (next: ColumnWidths) => {
    widths.value = next;
};
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <span>
                <kbd :class="styles.key">F2</kbd> on a header, then
                <kbd :class="styles.key">←</kbd><kbd :class="styles.key">→</kbd>
                (<kbd :class="styles.key">Shift</kbd> by 50)
            </span>
            <span>
                <kbd :class="styles.key">Esc</kbd> while dragging cancels, a
                double click fits the content
            </span>
            <WidthsReadout :grid-ref="gridRef" :widths="widths" :names="NAMES" />
            <!-- the columns go back to their own `width` -->
            <Clickable.Button
                size="sm"
                variant="outline"
                :disabled="Object.keys(widths).length === 0"
                @click="setWidths({})"
            >
                <RotateCcw aria-hidden="true" />
                Reset widths
            </Clickable.Button>
        </div>
        <DataGrid.Root
            :features="features"
            :columns="columns"
            :rows="rows"
            :row-key="rowKey"
            :row-height="36"
            :column-widths="widths"
            :on-column-widths-change="setWidths"
            :grid-ref="gridRef"
            :class="styles.root"
        >
            <DataGrid.Grid aria-label="People" :class="styles.grid">
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
                                >
                                    <!-- its own content, then its handle -->
                                    <HeaderContent :cell="cell" />
                                    <Resizer :cell="cell" />
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
