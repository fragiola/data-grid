"use client";

import {
    type Column,
    type ColumnOrGroup,
    DataGrid,
} from "@fragiola/data-grid-react";
import { measurement, type Person, people } from "../_kit/data";
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

const FIRST_YEAR = 2025;
const YEARS = [FIRST_YEAR, FIRST_YEAR + 1, FIRST_YEAR + 2];

/** A month's score: one column per month, numbers on the right. */
function month(year: number, monthIndex: number): Column<Person> {
    const columnIndex = (year - FIRST_YEAR) * 12 + monthIndex;
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

/** A person's months, every year: what the summary reads. */
function months(row: Person): number[] {
    return Array.from({ length: YEARS.length * 12 }, (_, columnIndex) =>
        measurement(row.id, columnIndex),
    );
}

/** A summary number: one decimal, on the right like the months. */
function summary(
    key: string,
    name: string,
    value: (scores: number[]) => number,
): Column<Person> {
    return {
        key,
        name,
        width: 96,
        pinned: "end",
        getValue: (row) => value(months(row)),
        renderCell: ({ value }) =>
            typeof value === "number" ? value.toFixed(1) : null,
        meta: { numeric: true },
    };
}

// the person stays at the start (a pinned group: its columns pinned, first), the summary at the
// end (pinned last), three years of months scroll between them
const columns: ColumnOrGroup<Person>[] = [
    {
        key: "person",
        name: "Person",
        children: [
            { key: "name", name: "Name", width: 180, pinned: "start" },
            { key: "team", name: "Team", width: 120, pinned: "start" },
        ],
    },
    ...YEARS.map(
        (year): ColumnOrGroup<Person> => ({
            key: String(year),
            name: String(year),
            children: MONTHS.map((_, monthIndex) => month(year, monthIndex)),
        }),
    ),
    {
        key: "summary",
        name: "Summary",
        children: [
            summary(
                "average",
                "Average",
                (scores) =>
                    scores.reduce((sum, score) => sum + score, 0) /
                    scores.length,
            ),
            summary("best", "Best", (scores) => Math.max(...scores)),
        ],
    },
];

export default function PinnedColumns() {
    return (
        <div className={styles.frame}>
            <DataGrid.Root
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                rowHeight={34}
                className={styles.root}
            >
                <DataGrid.Grid aria-label="Scores" className={styles.grid}>
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
                                            />
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
