<script setup lang="ts">
import {
    type ColumnOrder,
    type ColumnOrGroup,
    typedDataGrid,
    useDataGridRef,
} from "@fragiola/data-grid-vue";
import { useLocalRows } from "@fragiola/data-grid-vue/local";
import { sorting } from "@fragiola/data-grid-vue/sorting";
import { RotateCcw } from "@lucide/vue";
import { ref, type VNodeChild } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { formatMoney, type Person, people } from "../_kit/data";
import HeaderCell from "./header-cell.vue";
import * as styles from "./styles";
import { useMoveAnnouncements } from "./use-move-announcements";

// sorting is a feature the grid installs: without it, a sortable column never sorts
const features = [sorting()] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Person, typeof features>();

const all = people(1_000);

// "#" stays where it is declared: it is not reorderable (its siblings may still land beside it).
// Name and Team are pinned: they trade places with each other, never with the columns that
// scroll. A group moves whole, and its columns move inside it. Each column resizes too.
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
        reorderable: true,
        sortable: true,
        resizable: true,
    },
    {
        key: "team",
        name: "Team",
        width: 130,
        pinned: "start",
        reorderable: true,
        sortable: true,
        resizable: true,
    },
    {
        key: "contact",
        name: "Contact",
        reorderable: true,
        children: [
            {
                key: "email",
                name: "Email",
                width: 260,
                reorderable: true,
                resizable: true,
            },
            {
                key: "city",
                name: "City",
                width: 140,
                reorderable: true,
                sortable: true,
                resizable: true,
            },
        ],
    },
    {
        key: "employment",
        name: "Employment",
        reorderable: true,
        children: [
            {
                key: "joined",
                name: "Joined",
                width: 120,
                reorderable: true,
                sortable: true,
                resizable: true,
            },
            {
                key: "salary",
                name: "Salary",
                width: 130,
                reorderable: true,
                sortable: true,
                resizable: true,
                renderCell: ({ row }) => formatMoney(row.salary),
                meta: { numeric: true },
            },
        ],
    },
];

// the grid moves the columns; the app keeps the order (to reset it, to save it) and says
// what moved in its own words
const order = ref<ColumnOrder>([]);
const announcement = ref("");
const gridRef = useDataGridRef<Person>();
// a move the person asked for: told once the grid shows it
const moving = { current: false };
useMoveAnnouncements(gridRef, moving, (message) => {
    announcement.value = message;
});
// a click on a sortable header still sorts: the rows in memory, ordered by the app
const local = useLocalRows(all, columns);

const rowKey = (row: Person) => row.id;
const setOrder = (next: ColumnOrder) => {
    moving.current = true;
    order.value = next;
};
const reset = () => {
    // the columns go back to the order they are declared in
    order.value = [];
    announcement.value = "Columns back in their declared order.";
};
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <span>
                Drag a header, or <kbd :class="styles.key">Ctrl/⌘</kbd
                ><kbd :class="styles.key">Shift</kbd
                ><kbd :class="styles.key">←</kbd
                ><kbd :class="styles.key">→</kbd> on one
            </span>
            <span>
                <kbd :class="styles.key">Esc</kbd> while dragging cancels
            </span>
            <!-- the app's live region: a polite status, its text the app's own -->
            <span role="status" :class="styles.status">{{ announcement }}</span>
            <Clickable.Button
                size="sm"
                variant="outline"
                :disabled="order.length === 0"
                @click="reset"
            >
                <RotateCcw aria-hidden="true" />
                Reset order
            </Clickable.Button>
        </div>
        <DataGrid.Root
            :features="features"
            :columns="columns"
            :row-key="rowKey"
            :row-height="36"
            :column-order="order"
            :on-column-order-change="setOrder"
            :grid-ref="gridRef"
            :class="styles.root"
            v-bind="local.props"
        >
            <DataGrid.Grid aria-label="People" :class="styles.grid">
                <DataGrid.Header :class="styles.header">
                    <DataGrid.HeaderRows v-slot="{ row }">
                        <DataGrid.HeaderRow
                            :row="row"
                            :class="styles.headerRow(row)"
                        >
                            <DataGrid.HeaderCells v-slot="{ cell }">
                                <HeaderCell :cell="cell" />
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
