"use client";

import { type Column, DataGrid } from "@fragiola/data-grid-react";
import {
    bookingAt,
    FIRST_HOUR,
    HOURS,
    type Room,
    rooms,
    time,
} from "./bookings";
import * as styles from "./styles";

/**
 * An hour of the day: a booking starting at it spans the hours it takes (the grid renders no
 * cell for the hours it covers), and the header groups the hours two by two.
 */
function hourColumn(hour: number): Column<Room> {
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
            return booking ? (
                <span className={styles.booking}>
                    <span className={styles.title}>{booking.title}</span>
                    <span className={styles.time}>
                        {time(booking.start)}–
                        {time(booking.start + booking.hours)}
                    </span>
                </span>
            ) : null;
        },
    };
}

// the room pinned at the start, the hours booked at the end; a booking never reaches into them:
// a span stays inside its part
const columns: Column<Room>[] = [
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

export default function ColumnSpanning() {
    return (
        <div className={styles.frame}>
            <DataGrid.Root
                columns={columns}
                rows={rooms}
                rowKey={(row) => row.id}
                rowHeight={44}
                className={styles.root}
            >
                <DataGrid.Grid
                    aria-label="Room bookings"
                    className={styles.grid}
                >
                    <DataGrid.Header className={styles.header}>
                        <DataGrid.HeaderRow className={styles.headerRow}>
                            <DataGrid.HeaderCells<Room>>
                                {(cell) => (
                                    <DataGrid.HeaderCell
                                        cell={cell}
                                        className={styles.headerCell}
                                    />
                                )}
                            </DataGrid.HeaderCells>
                        </DataGrid.HeaderRow>
                    </DataGrid.Header>
                    <DataGrid.Body>
                        <DataGrid.Rows<Room>>
                            {(row) => (
                                <DataGrid.Row row={row} className={styles.row}>
                                    <DataGrid.Cells<Room>>
                                        {(cell) => (
                                            <DataGrid.Cell
                                                cell={cell}
                                                className={
                                                    cell.column.meta?.numeric
                                                        ? styles.numeric
                                                        : styles.cell
                                                }
                                            />
                                        )}
                                    </DataGrid.Cells>
                                </DataGrid.Row>
                            )}
                        </DataGrid.Rows>
                    </DataGrid.Body>
                </DataGrid.Grid>
            </DataGrid.Root>
        </div>
    );
}
