<script setup lang="ts">
import {
    type Column,
    type ScrollAlign,
    typedDataGrid,
    useDataGridRef,
} from "@fragiola/data-grid-vue";
import { computed, ref, type VNodeChild } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { Input } from "#/components/atoms/fields";
import { formatNumber } from "../_kit/data";
import * as styles from "./styles";

const ROWS = 10_000;
const COLUMNS = 200;

/** A row is only its index: each cell shows its own coordinates. */
interface Row {
    index: number;
}

// The parts typed by the row type: a template cannot pass `Row` as a type argument.
const DataGrid = typedDataGrid<Row>();

const getRow = (index: number): Row => ({ index });

const columns: Column<Row, VNodeChild>[] = [
    {
        key: "row",
        name: "Row",
        // the scroll leaves a cell between the pinned columns, never under them
        pinned: "start",
        width: 80,
        renderCell: ({ rowIndex }) => formatNumber(rowIndex),
    },
    ...Array.from(
        { length: COLUMNS - 1 },
        (_, i): Column<Row, VNodeChild> => ({
            key: `c${i + 1}`,
            name: String(i + 1),
            width: 110,
            renderCell: ({ rowIndex }) => `${rowIndex} × ${i + 1}`,
        }),
    ),
];

const ALIGNS: { align: ScrollAlign; label: string }[] = [
    { align: "nearest", label: "Nearest" },
    { align: "start", label: "Start" },
    { align: "center", label: "Centre" },
    { align: "end", label: "End" },
];

/** A whole number within `[0, count)` from a field's text, or `undefined`. */
function indexOf(text: string, count: number): number | undefined {
    const value = Number(text);
    return text.trim() !== "" && Number.isInteger(value) && value >= 0
        ? Math.min(value, count - 1)
        : undefined;
}

// the grid's model and engine from outside its root
const gridRef = useDataGridRef<Row>();
const row = ref("5000");
const column = ref("120");
const align = ref<ScrollAlign>("center");
const rowIndex = computed(() => indexOf(row.value, ROWS));
const columnIndex = computed(() => indexOf(column.value, COLUMNS));

/** A field's text, from its input event. */
const textOf = (event: Event) =>
    event.target instanceof HTMLInputElement ? event.target.value : "";

/** Scrolls one axis, or both: an index left out keeps that axis where it is. */
const scrollTo = (to: { rowIndex?: number; columnIndex?: number }) =>
    gridRef.current?.engine.run("scroll-to-cell", {
        ...to,
        align: align.value,
    });

function makeActive() {
    const at = { rowIndex: rowIndex.value, columnIndex: columnIndex.value };
    if (at.rowIndex === undefined || at.columnIndex === undefined) return;
    // a command, not a screen action: the grid scrolls the active cell into view (the nearest
    // edge) and, holding focus, focuses it
    gridRef.current?.model.run("active-position.set", {
        rowIndex: at.rowIndex,
        columnIndex: at.columnIndex,
    });
}
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <Input.Template.Simple
                label="Row"
                inputmode="numeric"
                :value="row"
                :class="styles.field"
                @input="row = textOf($event)"
            />
            <Input.Template.Simple
                label="Column"
                inputmode="numeric"
                :value="column"
                :class="styles.field"
                @input="column = textOf($event)"
            />
            <fieldset :class="styles.aligns">
                <legend :class="styles.legend">Align</legend>
                <label
                    v-for="option in ALIGNS"
                    :key="option.align"
                    :class="styles.align"
                >
                    <input
                        type="radio"
                        name="align"
                        :value="option.align"
                        :checked="align === option.align"
                        @change="align = option.align"
                    />
                    {{ option.label }}
                </label>
            </fieldset>
        </div>
        <div :class="styles.toolbar">
            <Clickable.Button
                size="sm"
                variant="outline"
                :disabled="rowIndex === undefined || columnIndex === undefined"
                @click="scrollTo({ rowIndex, columnIndex })"
            >
                Scroll to cell
            </Clickable.Button>
            <Clickable.Button
                size="sm"
                variant="outline"
                :disabled="rowIndex === undefined"
                @click="scrollTo({ rowIndex })"
            >
                Scroll to row
            </Clickable.Button>
            <Clickable.Button
                size="sm"
                variant="outline"
                :disabled="columnIndex === undefined"
                @click="scrollTo({ columnIndex })"
            >
                Scroll to column
            </Clickable.Button>
            <Clickable.Button
                size="sm"
                variant="outline"
                :disabled="rowIndex === undefined || columnIndex === undefined"
                @click="makeActive"
            >
                Make it active
            </Clickable.Button>
        </div>
        <DataGrid.Root
            :grid-ref="gridRef"
            :columns="columns"
            :row-count="ROWS"
            :get-row="getRow"
            :row-height="34"
            :class="styles.root"
        >
            <DataGrid.Grid aria-label="Coordinates" :class="styles.grid">
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
                    <DataGrid.Rows v-slot="{ row: info }">
                        <DataGrid.Row :row="info" :class="styles.row(info)">
                            <DataGrid.Cells v-slot="{ cell }">
                                <DataGrid.Cell
                                    :cell="cell"
                                    :class="styles.cell(cell)"
                                />
                            </DataGrid.Cells>
                        </DataGrid.Row>
                    </DataGrid.Rows>
                </DataGrid.Body>
            </DataGrid.Grid>
        </DataGrid.Root>
    </div>
</template>
