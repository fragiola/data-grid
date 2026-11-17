<script setup lang="ts">
import {
    type Column,
    type ColumnWidths,
    type HeaderCellInfo,
    headerCellContent,
    typedDataGrid,
    useDataGridRef,
} from "@fragiola/data-grid-vue";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { RotateCcw, WandSparkles } from "@lucide/vue";
import { type FunctionalComponent, ref, type VNodeChild } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { formatMoney, type Person, people } from "../_kit/data";
import Resizer from "./resizer.vue";
import * as styles from "./styles";
import { useAutoWidths } from "./use-auto-widths";

// cell navigation is a feature the grid installs: the keys, the active cell and the tab stop
const features = [navigation()] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Person, typeof features>();

const rows = people(1_000);

// Name fits its content once, when its first rows render (`autoSize`). Email and City share what
// the other columns leave of the grid's width, two parts and one, never below their `width` (City
// at most 240px). Every column but "#" resizes: a person's width replaces the automatic one.
const columns: Column<Person, VNodeChild>[] = [
    { key: "id", name: "#", width: 64, meta: { numeric: true } },
    {
        key: "name",
        name: "Name",
        width: 140,
        autoSize: true,
        resizable: true,
        minWidth: 120,
    },
    {
        key: "email",
        name: "Email",
        width: 220,
        flex: 2,
        resizable: true,
        minWidth: 160,
    },
    {
        key: "city",
        name: "City",
        width: 120,
        flex: 1,
        resizable: true,
        maxWidth: 240,
    },
    { key: "team", name: "Team", width: 140, resizable: true },
    {
        key: "salary",
        name: "Salary",
        width: 120,
        resizable: true,
        minWidth: 90,
        renderCell: ({ row }) => formatMoney(row.salary),
        meta: { numeric: true },
    },
];

const NAMES = new Map(columns.map((column) => [column.key, column.name]));

/** `{ email: 310 }` → `Email 310px`, in the columns' order. */
function describe(widths: ColumnWidths): string {
    return columns
        .flatMap((column) => {
            const width = widths[column.key];
            return width === undefined
                ? []
                : [`${NAMES.get(column.key)} ${width}px`];
        })
        .join(" · ");
}

/** A header cell's own content: its column's `renderHeaderCell`, else its name. */
const HeaderContent: FunctionalComponent<{ cell: HeaderCellInfo<Person> }> = (
    props,
) => headerCellContent(props.cell);

// the grid sizes Name, Email and City itself; the app keeps only what a person sets
const widths = ref<ColumnWidths>({});
// the grid's width, as a share of the frame: flex columns follow it
const share = ref(100);
const gridRef = useDataGridRef<Person>();
const automatic = useAutoWidths(gridRef);

const rowKey = (row: Person) => row.id;
const setWidths = (next: ColumnWidths) => {
    widths.value = next;
};
// every rendered resizable column, measured, in one change
const fitAll = () => gridRef.current?.engine.run("fit-columns", {});
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <label :class="styles.slider">
                Grid width
                <input
                    v-model.number="share"
                    type="range"
                    :min="50"
                    :max="100"
                    :step="5"
                    :class="styles.range"
                />
                <span :class="styles.sliderValue">{{ share }}%</span>
            </label>
            <span>
                A double click on a handle (or
                <kbd :class="styles.key">F2</kbd>, then
                <kbd :class="styles.key">Enter</kbd>) fits its column
            </span>
            <span :class="styles.buttons">
                <Clickable.Button size="sm" variant="outline" @click="fitAll">
                    <WandSparkles aria-hidden="true" />
                    Fit all
                </Clickable.Button>
                <!-- back to the grid's widths: Name's fit, the flex shares, the others' own -->
                <Clickable.Button
                    size="sm"
                    variant="outline"
                    :disabled="Object.keys(widths).length === 0"
                    @click="setWidths({})"
                >
                    <RotateCcw aria-hidden="true" />
                    Reset widths
                </Clickable.Button>
            </span>
        </div>
        <div :class="styles.readouts">
            <span :class="styles.readout" data-testid="auto-widths">{{
                `By the grid: ${describe(automatic) || "none"}`
            }}</span>
            <span :class="styles.readout" data-testid="widths">{{
                `Set by a person: ${describe(widths) || "none"}`
            }}</span>
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
            :style="{ width: `${share}%` }"
        >
            <DataGrid.Grid aria-label="People" :class="styles.grid">
                <DataGrid.Header :class="styles.header">
                    <DataGrid.HeaderRow :class="styles.headerRow">
                        <DataGrid.HeaderCells v-slot="{ cell }">
                            <DataGrid.HeaderCell
                                :cell="cell"
                                :class="styles.headerCell"
                            >
                                <!-- its own content, then its handle -->
                                <HeaderContent :cell="cell" />
                                <Resizer :cell="cell" />
                            </DataGrid.HeaderCell>
                        </DataGrid.HeaderCells>
                    </DataGrid.HeaderRow>
                </DataGrid.Header>
                <DataGrid.Body>
                    <DataGrid.Rows v-slot="{ row }">
                        <DataGrid.Row :row="row" :class="styles.row(row)">
                            <DataGrid.Cells v-slot="{ cell }">
                                <DataGrid.Cell
                                    :cell="cell"
                                    :class="
                                        cell.column.meta?.numeric
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
