"use client";

import {
    type Column,
    DataGrid,
    type HeaderCellInfo,
    type SortColumn,
} from "@fragiola/data-grid-react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { formatMoney, type Person, people } from "../_kit/data";
import * as styles from "./styles";

const all = people(200);

const columns: Column<Person>[] = [
    { key: "name", name: "Name", width: 180, sortable: true },
    { key: "email", name: "Email", width: 260 },
    { key: "city", name: "City", width: 140, sortable: true },
    { key: "team", name: "Team", width: 130, sortable: true },
    {
        key: "salary",
        name: "Salary",
        width: 130,
        sortable: true,
        renderCell: ({ row }) => formatMoney(row.salary),
    },
];

/** Ordering the rows is the app's: a comparator per sortable column. */
const compare: Record<string, (a: Person, b: Person) => number> = {
    name: (a, b) => a.name.localeCompare(b.name),
    city: (a, b) => a.city.localeCompare(b.city),
    team: (a, b) => a.team.localeCompare(b.team),
    salary: (a, b) => a.salary - b.salary,
};

/** The rows in the sort's order: the first column first, the next ones breaking ties. */
function sortRows(rows: readonly Person[], sortColumns: readonly SortColumn[]) {
    return [...rows].sort((a, b) => {
        for (const { columnKey, direction } of sortColumns) {
            const order = compare[columnKey]?.(a, b) ?? 0;
            if (order !== 0) return direction === "ascending" ? order : -order;
        }
        return a.id - b.id;
    });
}

export default function Sorting() {
    // the grid keeps the sort and asks for changes (a click, Enter or Space on a header cell;
    // Ctrl or ⌘ adds a column); the app holds it and orders the rows it passes
    const [sortColumns, setSortColumns] = useState<readonly SortColumn[]>([
        { columnKey: "team", direction: "ascending" },
    ]);
    const rows = useMemo(() => sortRows(all, sortColumns), [sortColumns]);

    return (
        <div className={styles.frame}>
            <DataGrid.Root
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                rowHeight={36}
                sortColumns={sortColumns}
                onSortColumnsChange={setSortColumns}
                className={styles.root}
            >
                <DataGrid.Grid aria-label="People" className={styles.grid}>
                    <DataGrid.Header className={styles.header}>
                        <DataGrid.HeaderRow className={styles.headerRow}>
                            <DataGrid.HeaderCells<Person>>
                                {(cell) => <HeaderCell cell={cell} />}
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

/**
 * A header cell and the app's own indicator, drawn from the cell's state: an arrow for the
 * direction and, with more than one sorted column, its priority.
 */
function HeaderCell({ cell }: { cell: HeaderCellInfo<Person> }) {
    return (
        <DataGrid.HeaderCell
            cell={cell}
            className={styles.headerCell}
            render={(props, state) => (
                <div {...props}>
                    <span className={styles.headerLabel}>{props.children}</span>
                    {state.sortDirection === "ascending" ? (
                        <ArrowUp aria-hidden className={styles.sortIcon} />
                    ) : state.sortDirection === "descending" ? (
                        <ArrowDown aria-hidden className={styles.sortIcon} />
                    ) : state.sortable ? (
                        <ArrowUpDown aria-hidden className={styles.unsorted} />
                    ) : null}
                    {state.sortPriority !== undefined && (
                        <span className={styles.priority}>
                            {state.sortPriority}
                        </span>
                    )}
                </div>
            )}
        />
    );
}
