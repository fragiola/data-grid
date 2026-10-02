"use client";

import { type Column, DataGrid } from "@fragiola/data-grid-react";
import { hash, type Person, people } from "../_kit/data";
import * as styles from "./styles";

const rows = people(100_000);

/** How many lines of notes a row has: its height follows. */
const lines = (index: number) => 1 + hash(index + 99, 4);

/** A row's height in pixels, from its index: the grid sums these to place every row. */
const rowHeight = (index: number) => 16 + lines(index) * 20;

const NOTES = [
    "Prefers asynchronous reviews.",
    "Owns the release checklist this quarter.",
    "Mentoring two new hires.",
    "On call next week.",
];

const columns: Column<Person>[] = [
    { key: "id", name: "#", width: 80 },
    { key: "name", name: "Name", width: 180 },
    { key: "team", name: "Team", width: 120 },
    {
        key: "notes",
        name: "Notes",
        width: 360,
        renderCell: ({ rowIndex }) =>
            NOTES.slice(0, lines(rowIndex)).map((note) => (
                <span key={note} className={styles.note}>
                    {note}
                </span>
            )),
    },
];

export default function VariableRowHeight() {
    return (
        <div className={styles.frame}>
            <DataGrid.Root
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                rowHeight={rowHeight}
                className={styles.root}
            >
                <DataGrid.Grid
                    aria-label="People and notes"
                    className={styles.grid}
                >
                    <DataGrid.Header className={styles.header}>
                        <DataGrid.HeaderRow className={styles.headerRow}>
                            <DataGrid.HeaderCells<Person>>
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
                        <DataGrid.Rows<Person>>
                            {(row) => (
                                <DataGrid.Row row={row} className={styles.row}>
                                    <DataGrid.Cells<Person>>
                                        {(cell) => (
                                            <DataGrid.Cell
                                                cell={cell}
                                                className={styles.cell}
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
