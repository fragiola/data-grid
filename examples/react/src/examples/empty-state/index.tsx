"use client";

import { type Column, DataGrid } from "@fragiola/data-grid-react";
import { Plus, Trash2, UsersRound } from "lucide-react";
import { useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { type Person, people } from "../_kit/data";
import * as styles from "./styles";

const SAMPLE = people(50);

const columns: Column<Person>[] = [
    { key: "id", name: "#", width: 64 },
    { key: "name", name: "Name", width: 180 },
    { key: "email", name: "Email", width: 260 },
    { key: "city", name: "City", width: 140 },
    { key: "team", name: "Team", width: 120 },
];

export default function EmptyState() {
    const [rows, setRows] = useState<Person[]>([]);
    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <span className={styles.count} data-testid="row-count">
                    {rows.length} people
                </span>
                <Clickable.Button
                    size="sm"
                    variant="ghost"
                    disabled={rows.length === 0}
                    onClick={() => setRows([])}
                >
                    <Trash2 aria-hidden />
                    Clear all
                </Clickable.Button>
            </div>
            <DataGrid.Root
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                rowHeight={36}
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
                    <DataGrid.Empty>
                        <div className={styles.empty} data-testid="empty">
                            <div className={styles.illustration}>
                                <UsersRound aria-hidden />
                            </div>
                            <p className={styles.emptyTitle}>No people yet</p>
                            <p className={styles.emptyText}>
                                Add a few sample rows to see the grid fill up,
                                then clear them to come back here.
                            </p>
                            <Clickable.Button
                                size="sm"
                                onClick={() => setRows(SAMPLE)}
                            >
                                <Plus aria-hidden />
                                Add sample rows
                            </Clickable.Button>
                        </div>
                    </DataGrid.Empty>
                </DataGrid.Grid>
            </DataGrid.Root>
        </div>
    );
}
