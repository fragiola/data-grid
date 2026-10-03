"use client";

import {
    type Column,
    DataGrid,
    type HeaderCellInfo,
    useGridView,
} from "@fragiola/data-grid-react";
import { useLocalRows } from "@fragiola/data-grid-react/local";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { formatMoney, type Person, people } from "../_kit/data";
import * as styles from "./styles";

const all = people(200);

const columns: Column<Person>[] = [
    {
        key: "name",
        name: "Name",
        width: 180,
        sortable: true,
        // its own order: by last name (the others compare their values by type)
        compare: (a, b) => lastName(a).localeCompare(lastName(b)),
    },
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

function lastName(person: Person): string {
    return person.name.split(" ").at(-1) ?? person.name;
}

export default function Sorting() {
    // the rows in memory, sorted by one hook: its props give the grid the sorted rows and its
    // sort (a click, Enter or Space on a header cell; Ctrl or ⌘ adds a column)
    const local = useLocalRows(all, columns, {
        defaultSortColumns: [{ columnKey: "team", direction: "ascending" }],
    });

    return (
        <div className={styles.frame}>
            <DataGrid.Root
                columns={columns}
                rowKey={(row) => row.id}
                rowHeight={36}
                className={styles.root}
                {...local.props}
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
    const { sortColumns } = useGridView();
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
                    {sortColumns.length > 1 &&
                        state.sortPriority !== undefined && (
                            <span className={styles.priority}>
                                {state.sortPriority}
                            </span>
                        )}
                </div>
            )}
        />
    );
}
