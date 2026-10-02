"use client";

import { type Column, DataGrid } from "@fragiola/data-grid-react";
import { formatMoney, type Person, people } from "../_kit/data";
import * as styles from "./styles";

const rows = people(10_000);

const columns: Column<Person>[] = [
    { key: "id", name: "#", width: 72 },
    { key: "name", name: "Name", width: 180 },
    { key: "email", name: "Email", width: 260 },
    { key: "city", name: "City", width: 140 },
    { key: "team", name: "Team", width: 120 },
    {
        key: "salary",
        name: "Salary",
        width: 120,
        renderCell: ({ row }) => formatMoney(row.salary),
    },
];

// Every part takes `render`: here each one becomes the table element it stands for. The grid
// keeps role="grid" (an interactive table), and the primitives set the structural style that lets
// table parts be positioned like any other element.
export default function TableElements() {
    return (
        <div className={styles.frame}>
            <DataGrid.Root
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                rowHeight={36}
                className={styles.root}
            >
                <DataGrid.Grid
                    aria-label="People"
                    render={<table />}
                    className={styles.grid}
                >
                    <DataGrid.Header
                        render={<thead />}
                        className={styles.header}
                    >
                        <DataGrid.HeaderRow
                            render={<tr />}
                            className={styles.headerRow}
                        >
                            <DataGrid.HeaderCells<Person>>
                                {(cell) => (
                                    <DataGrid.HeaderCell
                                        cell={cell}
                                        render={<th />}
                                        className={styles.headerCell}
                                    />
                                )}
                            </DataGrid.HeaderCells>
                        </DataGrid.HeaderRow>
                    </DataGrid.Header>
                    <DataGrid.Body render={<tbody />}>
                        <DataGrid.Rows<Person>>
                            {(row) => (
                                <DataGrid.Row
                                    row={row}
                                    render={<tr />}
                                    className={styles.row}
                                >
                                    <DataGrid.Cells<Person>>
                                        {(cell) => (
                                            <DataGrid.Cell
                                                cell={cell}
                                                render={<td />}
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
