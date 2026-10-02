"use client";

import {
    type CellPosition,
    type Column,
    DataGrid,
} from "@fragiola/data-grid-react";
import { useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { formatMoney, formatNumber, type Person, people } from "../_kit/data";
import * as styles from "./styles";

const rows = people(5_000);

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

const KEYS = [
    "←↑→↓",
    "Home",
    "End",
    "Ctrl+Home",
    "Ctrl+End",
    "PageUp",
    "PageDown",
];

export default function KeyboardNavigation() {
    // controlled: the grid asks (onActivePositionChange), the app decides
    const [active, setActive] = useState<CellPosition | null>({
        rowIndex: 0,
        columnIndex: 1,
    });
    const column = active ? columns[active.columnIndex] : undefined;
    return (
        <div className={styles.frame}>
            <div className={styles.panel}>
                <p data-testid="active">
                    {active && column ? (
                        <>
                            Active:{" "}
                            <span className={styles.figure}>
                                {active.rowIndex < 0
                                    ? "header"
                                    : `row ${formatNumber(active.rowIndex + 1)}`}
                            </span>
                            , {column.name}
                        </>
                    ) : (
                        "No active cell"
                    )}
                </p>
                <span className={styles.keys}>
                    {KEYS.map((key) => (
                        <kbd key={key} className={styles.key}>
                            {key}
                        </kbd>
                    ))}
                </span>
                <span className={styles.actions}>
                    <Clickable.Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            setActive({ rowIndex: 0, columnIndex: 0 })
                        }
                    >
                        First row
                    </Clickable.Button>
                    <Clickable.Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            setActive({
                                rowIndex: rows.length - 1,
                                columnIndex: columns.length - 1,
                            })
                        }
                    >
                        Last row
                    </Clickable.Button>
                </span>
            </div>
            <DataGrid.Root
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                rowHeight={36}
                activePosition={active}
                onActivePositionChange={setActive}
                className={styles.root}
            >
                <DataGrid.Grid aria-label="People" className={styles.grid}>
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
