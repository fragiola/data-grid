<script setup lang="ts">
import {
    type CellInfo,
    type CellPosition,
    typedDataGrid,
    useDataGrid,
} from "@fragiola/data-grid-vue";
import OrderItems from "./order-items.vue";
import OrderSummary from "./order-summary.vue";
import type { Order } from "./orders";
import * as styles from "./styles";

// The orders grid, under its `Root`: it reads the grid's model to toggle an order from its cell.

const DataGrid = typedDataGrid<Order>();

const { model } = useDataGrid<Order>();

/** Enter or Space on an order's expander cell toggles it (and is not the browser's scroll). */
function onExpanderKey(event: KeyboardEvent, toggle: () => void) {
    if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
        event.preventDefault();
        toggle();
    }
}

/** A cell's keys: only the expander's toggle its order. */
function onCellKey(event: KeyboardEvent, cell: CellInfo<Order>) {
    if (cell.column.key !== "expand") return;
    onExpanderKey(event, () =>
        model.run("expanded-rows.toggle", { rowIndex: cell.rowIndex }),
    );
}

/** Escape in a detail returns to its order: the row's expander cell takes focus. */
function backToOrder(event: KeyboardEvent, at: CellPosition) {
    if (event.key !== "Escape") return;
    if (!(event.currentTarget instanceof HTMLElement)) return;
    const cell = event.currentTarget
        .closest('[data-grid-part="row"]')
        ?.querySelector<HTMLElement>(
            `[data-grid-part="cell"][data-column-index="${at.columnIndex}"]`,
        );
    if (cell) {
        event.preventDefault();
        cell.focus();
    }
}
</script>

<template>
    <DataGrid.Grid aria-label="Orders" :class="styles.grid">
        <DataGrid.Header :class="styles.header">
            <DataGrid.HeaderRow :class="styles.headerRow">
                <DataGrid.HeaderCells v-slot="{ cell }">
                    <DataGrid.HeaderCell
                        :cell="cell"
                        :class="styles.headerCell(cell)"
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
                            @keydown="onCellKey($event, cell)"
                        />
                    </DataGrid.Cells>
                    <DataGrid.RowDetail
                        :class="styles.detail"
                        @keydown="
                            backToOrder($event, {
                                rowIndex: row.rowIndex,
                                columnIndex: 0,
                            })
                        "
                    >
                        <!-- the part is a block: the layout inside it is the app's -->
                        <div v-if="row.row" :class="styles.detailContent">
                            <OrderSummary :order="row.row" />
                            <OrderItems :order="row.row" />
                        </div>
                    </DataGrid.RowDetail>
                </DataGrid.Row>
            </DataGrid.Rows>
        </DataGrid.Body>
    </DataGrid.Grid>
</template>
