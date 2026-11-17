<script setup lang="ts">
import {
    type Column,
    typedDataGrid,
    useDataGridRef,
} from "@fragiola/data-grid-vue";
import type { VNodeChild } from "vue";
import { formatNumber, measurement } from "../_kit/data";
import Readout from "./readout.vue";
import type { Row } from "./row";
import * as styles from "./styles";

// The parts typed by the row type: a template cannot pass `Row` as a type argument.
const DataGrid = typedDataGrid<Row>();

const ROWS = 1_000_000;
const COLUMNS = 1_000;

const getRow = (index: number): Row => ({ index });

const columns: Column<Row, VNodeChild>[] = [
    {
        key: "row",
        name: "Row",
        // in view while the measurements scroll sideways
        pinned: "start",
        width: 96,
        renderCell: ({ row }) => formatNumber(row.index + 1),
    },
    ...Array.from(
        { length: COLUMNS - 1 },
        (_, i): Column<Row, VNodeChild> => ({
            key: `m${i + 1}`,
            name: `M${i + 1}`,
            width: 96,
            getValue: (row) => measurement(row.index, i + 1),
            renderCell: ({ value }) =>
                typeof value === "number" ? value.toFixed(2) : null,
        }),
    ),
];

// the readout follows the grid's windows through the ref: it renders again, the grid does not
const gridRef = useDataGridRef<Row>();
</script>

<template>
    <div :class="styles.frame">
        <Readout :grid-ref="gridRef" :rows="ROWS" :columns="COLUMNS" />
        <DataGrid.Root
            :columns="columns"
            :row-count="ROWS"
            :get-row="getRow"
            :row-height="32"
            :class="styles.root"
            :grid-ref="gridRef"
        >
            <DataGrid.Grid aria-label="Measurements" :class="styles.grid">
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
