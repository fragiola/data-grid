<script setup lang="ts">
import {
    typedDataGrid,
    useDataGrid,
    useGridView,
} from "@fragiola/data-grid-vue";
import type { Person } from "../_kit/data";
import { type Mode, target } from "./navigation";
import * as styles from "./styles";

// The grid, whose cells (header cells too) handle the keys before the grid sees them.

const DataGrid = typedDataGrid<Person>();

const props = defineProps<{ mode: Mode }>();

const { model } = useDataGrid<Person>();
const view = useGridView();

function onKeyDown(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const tab = event.key === "Tab";
    // the arrow toward the row's end: → left to right, ← right to left
    const direction = view.value.direction;
    const forward = direction === "rtl" ? "ArrowLeft" : "ArrowRight";
    const back = direction === "rtl" ? "ArrowRight" : "ArrowLeft";
    if (
        !tab &&
        (event.shiftKey || (event.key !== forward && event.key !== back))
    ) {
        return;
    }
    const active = model.get("active-position");
    if (!active) return;
    const step = (tab ? event.shiftKey : event.key === back) ? -1 : 1;
    const next = target(
        active,
        step,
        tab,
        props.mode,
        model.get("row-count"),
        model.get("column-count"),
    );
    if (!next) return;
    // the key is ours now: the browser does not move focus, and the grid scrolls the
    // new active cell into view and focuses it
    event.preventDefault();
    model.run("active-position.set", next);
}
</script>

<template>
    <DataGrid.Grid aria-label="People" :class="styles.grid">
        <DataGrid.Header :class="styles.header">
            <DataGrid.HeaderRow :class="styles.headerRow">
                <DataGrid.HeaderCells v-slot="{ cell }">
                    <DataGrid.HeaderCell
                        :cell="cell"
                        :class="styles.headerCell"
                        @keydown="onKeyDown"
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
                            @keydown="onKeyDown"
                        />
                    </DataGrid.Cells>
                </DataGrid.Row>
            </DataGrid.Rows>
        </DataGrid.Body>
    </DataGrid.Grid>
</template>
