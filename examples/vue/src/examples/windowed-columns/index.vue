<script setup lang="ts">
import {
    type AxisWindow,
    type Column,
    typedDataGrid,
    useDataGridRef,
} from "@fragiola/data-grid-vue";
import { onBeforeUnmount, type VNodeChild } from "vue";
import { formatNumber, measurement } from "../_kit/data";
import { createFakeApi } from "../_kit/fake-api";
import RequestLog from "./request-log.vue";
import * as styles from "./styles";
import { createTileCache, type TileCache } from "./tiles";

const ROWS = 100_000;
const COLUMNS = 2_000;
const TILE = { rows: 50, columns: 20 };

/** Every row exists from the start; its cells come with the tiles. */
interface Row {
    index: number;
}

// The parts typed by the row type: a template cannot pass `Row` as a type argument.
const DataGrid = typedDataGrid<Row>();

/** Every row exists from the start: the same getter for the grid's whole life. */
const getRow = (index: number): Row => ({ index });

const EMPTY: AxisWindow = {
    visible: { start: 0, end: 0 },
    rendered: { start: 0, end: 0 },
};

function columnsFor(tiles: TileCache): Column<Row, VNodeChild>[] {
    return Array.from(
        { length: COLUMNS },
        (_, i): Column<Row, VNodeChild> => ({
            key: `c${i}`,
            name: `C${formatNumber(i + 1)}`,
            width: 104,
            getValue: (row) => tiles.get(row.index, i),
        }),
    );
}

// one server, one cache and their columns for the example's life
const api = createFakeApi(450);
const tiles = createTileCache(
    api,
    TILE,
    { rows: ROWS, columns: COLUMNS },
    measurement,
);
const columns = columnsFor(tiles);
const gridRef = useDataGridRef<Row>();
// a tile that arrives fills cells of its rows: the grid is told which rows, and renders only
// if they are on screen
onBeforeUnmount(
    tiles.subscribe((rows) => gridRef.current?.model.run("rows.changed", rows)),
);
// both windows, kept to ask for the tiles once the scroll settles
const windows = { rows: EMPTY, columns: EMPTY };
let timer: ReturnType<typeof setTimeout> | undefined;
// a request still waiting when the example goes away is not sent
onBeforeUnmount(() => clearTimeout(timer));
const load = () => {
    clearTimeout(timer);
    timer = setTimeout(
        () => tiles.ensure(windows.rows.rendered, windows.columns.rendered),
        80,
    );
};
const onRowWindowChange = (rows: AxisWindow) => {
    windows.rows = rows;
    load();
};
const onColumnWindowChange = (columns: AxisWindow) => {
    windows.columns = columns;
    load();
};
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.layout">
            <DataGrid.Root
                :columns="columns"
                :row-count="ROWS"
                :get-row="getRow"
                :grid-ref="gridRef"
                :row-height="32"
                :on-row-window-change="onRowWindowChange"
                :on-column-window-change="onColumnWindowChange"
                :class="styles.root"
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
                                        :class="styles.cell"
                                        :data-tile-loaded="
                                            cell.value === undefined
                                                ? undefined
                                                : ''
                                        "
                                    >
                                        <template
                                            v-if="typeof cell.value === 'number'"
                                            >{{ cell.value.toFixed(2) }}</template
                                        >
                                        <span
                                            v-else
                                            :class="styles.skeleton"
                                        />
                                    </DataGrid.Cell>
                                </DataGrid.Cells>
                            </DataGrid.Row>
                        </DataGrid.Rows>
                    </DataGrid.Body>
                </DataGrid.Grid>
            </DataGrid.Root>
            <RequestLog :api="api" />
        </div>
    </div>
</template>
