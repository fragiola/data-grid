<script setup lang="ts">
import {
    type Column,
    typedDataGrid,
    useDataGridRef,
} from "@fragiola/data-grid-vue";
import type { VNodeChild } from "vue";
import { formatNumber, measurement } from "../_kit/data";
import ColumnReadout from "./column-readout.vue";
import * as styles from "./styles";

const ROWS = 10_000;
const COLUMNS = 5_000;

interface Row {
    index: number;
}

// The parts typed by the row type: a template cannot pass `Row` as a type argument.
const DataGrid = typedDataGrid<Row>();

const getRow = (index: number): Row => ({ index });

const columns: Column<Row, VNodeChild>[] = Array.from(
    { length: COLUMNS },
    (_, i): Column<Row, VNodeChild> => ({
        key: `c${i}`,
        name: `Column ${formatNumber(i + 1)}`,
        width: 120,
        getValue: (row) => measurement(row.index, i),
        renderCell: ({ value }) =>
            typeof value === "number" ? value.toFixed(2) : null,
    }),
);

// the readout follows the column window through the ref: it re-renders, the grid does not
const gridRef = useDataGridRef<Row>();
</script>

<template>
    <div :class="styles.frame">
        <ColumnReadout :grid-ref="gridRef" :columns="COLUMNS" />
        <DataGrid.Root
            :columns="columns"
            :row-count="ROWS"
            :get-row="getRow"
            :row-height="32"
            :overscan="{ columns: 3 }"
            :class="styles.root"
            :grid-ref="gridRef"
        >
            <DataGrid.Grid aria-label="Columns" :class="styles.grid">
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
                                    :class="styles.cell"
                                />
                            </DataGrid.Cells>
                        </DataGrid.Row>
                    </DataGrid.Rows>
                </DataGrid.Body>
            </DataGrid.Grid>
        </DataGrid.Root>
    </div>
</template>
