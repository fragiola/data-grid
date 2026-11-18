<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import { columnPinning } from "@fragiola/data-grid-vue/column-pinning";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { cellSpans } from "@fragiola/data-grid-vue/spans";
import { h, type VNodeChild } from "vue";
import {
    bookingAt,
    FIRST_HOUR,
    HOURS,
    type Room,
    rooms,
    time,
} from "./bookings";
import * as styles from "./styles";

// the features the grid installs: cell navigation (the keys, the active cell, the tab stop), pinned
// columns (without it, every column scrolls), column spans (without it, a column's colSpan is not
// asked)
const features = [navigation(), columnPinning(), cellSpans()] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Room, typeof features>();

/**
 * An hour of the day: a booking starting at it spans the hours it takes (the grid renders no
 * cell for the hours it covers), and the header groups the hours two by two.
 */
function hourColumn(hour: number): Column<Room, VNodeChild> {
    return {
        key: `h${hour}`,
        name: `${time(hour)}–${time(hour + 2)}`,
        width: 96,
        colSpan: (args) => {
            if (args.type === "header") {
                return (hour - FIRST_HOUR) % 2 === 0 ? 2 : undefined;
            }
            return args.type === "row"
                ? bookingAt(args.row, hour)?.hours
                : undefined;
        },
        renderCell: ({ row }) => {
            const booking = bookingAt(row, hour);
            return booking
                ? h("span", { class: styles.booking }, [
                      h("span", { class: styles.title }, booking.title),
                      h(
                          "span",
                          { class: styles.time },
                          `${time(booking.start)}–${time(booking.start + booking.hours)}`,
                      ),
                  ])
                : null;
        },
    };
}

// the room pinned at the start, the hours booked at the end; a booking never reaches into them:
// a span stays inside its part
const columns: Column<Room, VNodeChild>[] = [
    { key: "name", name: "Room", width: 120, pinned: "start" },
    ...Array.from({ length: HOURS }, (_, index) =>
        hourColumn(FIRST_HOUR + index),
    ),
    {
        key: "booked",
        name: "Booked",
        width: 96,
        pinned: "end",
        renderCell: ({ row }) => `${row.booked} h`,
        meta: { numeric: true },
    },
];

const rowKey = (row: Room) => row.id;
</script>

<template>
    <div :class="styles.frame">
        <DataGrid.Root
            :features="features"
            :columns="columns"
            :rows="rooms"
            :row-key="rowKey"
            :row-height="44"
            :class="styles.root"
        >
            <DataGrid.Grid aria-label="Room bookings" :class="styles.grid">
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
