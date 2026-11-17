<script setup lang="ts">
import {
    type ColumnOrGroup,
    type GridDirection,
    type HeaderCellInfo,
    headerCellContent,
    typedDataGrid,
} from "@fragiola/data-grid-vue";
import {
    computed,
    type FunctionalComponent,
    ref,
    useId,
    type VNodeChild,
} from "vue";
import { Switch } from "#/components/ui/switch";
import { formatMoney, type Person, people } from "../_kit/data";
import Resizer from "./resizer.vue";
import * as styles from "./styles";

// The parts typed by the row type: a template cannot pass `Person` as a type argument.
const DataGrid = typedDataGrid<Person>();

const rows = people(1_000);

// An Arabic table, read from the right: the name pinned at the start (the right edge), the
// salary at the end (the left edge), the columns between them resizable and reorderable, the
// email taking what a wide view leaves. The
// grid mirrors itself; the app's styles use logical sides (start and end) so they mirror too.
const columns: ColumnOrGroup<Person, VNodeChild>[] = [
    {
        key: "name",
        name: "الاسم",
        width: 180,
        pinned: "start",
        resizable: true,
        minWidth: 120,
    },
    {
        key: "contact",
        name: "التواصل",
        reorderable: true,
        children: [
            {
                key: "email",
                name: "البريد الإلكتروني",
                width: 260,
                // the rest of a wide view: the salary pinned at its end edge
                flex: 1,
                resizable: true,
                reorderable: true,
            },
            {
                key: "city",
                name: "المدينة",
                width: 140,
                resizable: true,
                reorderable: true,
            },
        ],
    },
    {
        key: "team",
        name: "الفريق",
        width: 140,
        resizable: true,
        reorderable: true,
    },
    {
        key: "joined",
        name: "تاريخ الانضمام",
        width: 150,
        resizable: true,
        reorderable: true,
    },
    {
        key: "salary",
        name: "الراتب",
        width: 130,
        pinned: "end",
        resizable: true,
        renderCell: ({ row }) => formatMoney(row.salary),
        meta: { numeric: true },
    },
];

/** A header cell's own content: its group's or column's `renderHeaderCell`, else its name. */
const HeaderContent: FunctionalComponent<{ cell: HeaderCellInfo<Person> }> = (
    props,
) => headerCellContent(props.cell);

const direction = ref<GridDirection>("rtl");
const directionLabel = useId();
// the arrows follow the reading direction: the next column is to the left right to left
const arrows = computed(() =>
    direction.value === "rtl"
        ? { next: "←", previous: "→" }
        : { next: "→", previous: "←" },
);

const rowKey = (row: Person) => row.id;
const setRtl = (rtl: boolean) => {
    direction.value = rtl ? "rtl" : "ltr";
};
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <span :class="styles.direction">
                <Switch.Root
                    :aria-labelledby="directionLabel"
                    :model-value="direction === 'rtl'"
                    @update:model-value="setRtl"
                >
                    <Switch.Thumb />
                </Switch.Root>
                <span :id="directionLabel">Right to left</span>
            </span>
            <span>
                <kbd :class="styles.key">{{ arrows.next }}</kbd> the next
                column,
                <kbd :class="styles.key">{{ arrows.previous }}</kbd> the
                previous one
            </span>
            <span>
                <kbd :class="styles.key">Ctrl</kbd>+<kbd :class="styles.key"
                    >Shift</kbd
                >+<kbd :class="styles.key">{{ arrows.next }}</kbd> moves a
                header toward the end
            </span>
        </div>
        <DataGrid.Root
            :columns="columns"
            :rows="rows"
            :row-key="rowKey"
            :row-height="36"
            :direction="direction"
            :class="styles.root"
        >
            <DataGrid.Grid aria-label="الموظفون" :class="styles.grid">
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
