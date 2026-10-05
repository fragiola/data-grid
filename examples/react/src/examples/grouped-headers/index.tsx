"use client";

import {
    type Column,
    type ColumnOrGroup,
    DataGrid,
    type HeaderCellInfo,
    headerCellContent,
    useGroupLabel,
} from "@fragiola/data-grid-react";
import { formatMoney, measurement, type Person, people } from "../_kit/data";
import * as styles from "./styles";

const rows = people(1_000);

const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

/** A month's score, one column per month. */
function month(year: number, monthIndex: number): Column<Person> {
    const columnIndex = (year - 2025) * 12 + monthIndex;
    return {
        key: `${year}-${monthIndex + 1}`,
        name: MONTHS[monthIndex],
        width: 84,
        getValue: (row) => measurement(row.id, columnIndex),
        renderCell: ({ value }) =>
            typeof value === "number" ? value.toFixed(1) : null,
        meta: { numeric: true },
    };
}

/** A quarter: a group of its three months. */
function quarter(year: number, index: number): ColumnOrGroup<Person> {
    return {
        key: `${year}-q${index + 1}`,
        name: `Q${index + 1} ${year}`,
        children: [0, 1, 2].map((m) => month(year, index * 3 + m)),
    };
}

// a column, two groups of columns, then eight quarters of monthly scores: 2 header rows
const columns: ColumnOrGroup<Person>[] = [
    { key: "id", name: "#", width: 64, meta: { numeric: true } },
    {
        key: "person",
        name: "Person",
        children: [
            { key: "name", name: "Name", width: 180 },
            { key: "email", name: "Email", width: 260 },
        ],
    },
    {
        key: "work",
        name: "Work",
        children: [
            { key: "team", name: "Team", width: 120 },
            { key: "city", name: "City", width: 140 },
            { key: "joined", name: "Joined", width: 120 },
            {
                key: "salary",
                name: "Salary",
                width: 120,
                renderCell: ({ row }) => formatMoney(row.salary),
                meta: { numeric: true },
            },
        ],
    },
    ...[2025, 2026].flatMap((year) =>
        [0, 1, 2, 3].map((index) => quarter(year, index)),
    ),
];

/**
 * A group's name in a label that stays in view while the group scrolls: sticky in the group's
 * cell, at the view's start once the group's start has scrolled out, never past its end.
 */
function GroupLabel({ cell }: { cell: HeaderCellInfo<Person> }) {
    const label = useGroupLabel(cell);
    return (
        <span {...label.props} className={styles.label}>
            {headerCellContent(cell)}
        </span>
    );
}

export default function GroupedHeaders() {
    return (
        <div className={styles.frame}>
            <DataGrid.Root
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                rowHeight={34}
                className={styles.root}
            >
                <DataGrid.Grid aria-label="People" className={styles.grid}>
                    <DataGrid.Header className={styles.header}>
                        <DataGrid.HeaderRows<Person>>
                            {(row) => (
                                <DataGrid.HeaderRow
                                    row={row}
                                    className={styles.headerRow}
                                >
                                    <DataGrid.HeaderCells<Person>>
                                        {(cell) => (
                                            <DataGrid.HeaderCell
                                                cell={cell}
                                                className={styles.headerCell}
                                            >
                                                {cell.group ? (
                                                    <GroupLabel cell={cell} />
                                                ) : undefined}
                                            </DataGrid.HeaderCell>
                                        )}
                                    </DataGrid.HeaderCells>
                                </DataGrid.HeaderRow>
                            )}
                        </DataGrid.HeaderRows>
                    </DataGrid.Header>
                    <DataGrid.Body>
                        <DataGrid.Rows<Person>>
                            {(row) => (
                                <DataGrid.Row row={row} className={styles.row}>
                                    <DataGrid.Cells<Person>>
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
