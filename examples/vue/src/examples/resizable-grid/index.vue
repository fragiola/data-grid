<script setup lang="ts">
import {
    type Column,
    typedDataGrid,
    useDataGridRef,
} from "@fragiola/data-grid-vue";
import type { VNodeChild } from "vue";
import Readout from "./readout.vue";
import type { Row } from "./row";
import * as styles from "./styles";

// The parts typed by the row type: a template cannot pass `Row` as a type argument.
const DataGrid = typedDataGrid<Row>();

const ROWS = 1_000;
const COLUMNS = 100;

const getRow = (index: number): Row => ({ index });

const columns: Column<Row, VNodeChild>[] = Array.from(
    { length: COLUMNS },
    (_, i): Column<Row, VNodeChild> => ({
        key: `c${i}`,
        name: String(i),
        width: 90,
        renderCell: ({ rowIndex }) => `${rowIndex} × ${i}`,
    }),
);

// The grid's size is its CSS: here a starting size and `resize: both` (styles.ts), so the reader
// drags its corner. The engine watches its scroll container (a ResizeObserver from the
// container's own window) and renders what the new size shows: nothing to tell it.

const gridRef = useDataGridRef<Row>();
</script>

<template>
    <div :class="styles.frame">
        <Readout :grid-ref="gridRef" />
        <div :class="styles.stage">
            <DataGrid.Root
                :grid-ref="gridRef"
                :columns="columns"
                :row-count="ROWS"
                :get-row="getRow"
                :row-height="32"
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
    </div>
</template>
