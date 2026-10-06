"use client";

import { type Column, DataGrid } from "@fragiola/data-grid-react";
import { useState } from "react";
import {
    budgetedTasks,
    type BudgetedTask as Row,
    withField,
} from "../_kit/budgeted-tasks";
import { formatMoney } from "../_kit/data";
import { AmountEditor, DateEditor, StatusEditor, TextEditor } from "./editors";
import * as styles from "./styles";

// Tasks edited in place: the grid edits a cell (the keys, the draft, the commit), the editors are
// the app's (a text field, a number, a select, a date: `editors.tsx`) and so is the data: each
// commit is told, and the app writes it into its rows.

const initialRows = budgetedTasks(120);

const columns: Column<Row>[] = [
    {
        key: "name",
        name: "Task",
        width: 220,
        editable: true,
        renderEditCell: (props) => (
            <TextEditor {...props} className={styles.editor} />
        ),
    },
    { key: "project", name: "Project", width: 120 },
    {
        key: "budget",
        name: "Budget",
        width: 120,
        // a completed task's budget is closed
        editable: (row) => row.status !== "Completed",
        renderCell: ({ row }) => (
            <span className={styles.budget(row.status)}>
                {formatMoney(row.budget)}
            </span>
        ),
        renderEditCell: (props) => (
            <AmountEditor {...props} className={styles.editor} />
        ),
    },
    {
        key: "status",
        name: "Status",
        width: 160,
        editable: true,
        renderEditCell: (props) => (
            <StatusEditor {...props} className={styles.select} />
        ),
    },
    {
        key: "due",
        name: "Due",
        width: 150,
        editable: true,
        renderEditCell: (props) => (
            <DateEditor {...props} className={styles.editor} />
        ),
    },
    { key: "assignee", name: "Assignee", width: 120 },
];

export default function Editing() {
    // the app's rows: the grid never writes them, a commit is told
    const [rows, setRows] = useState<readonly Row[]>(initialRows);
    const [announcement, setAnnouncement] = useState("");

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <span>
                    <kbd className={styles.key}>Enter</kbd>
                    <kbd className={styles.key}>F2</kbd> or typing edit;{" "}
                    <kbd className={styles.key}>Enter</kbd>
                    <kbd className={styles.key}>Tab</kbd> save,{" "}
                    <kbd className={styles.key}>Esc</kbd> cancels
                </span>
                {/* the app's live region: a polite status, its text the app's own */}
                <span role="status" className={styles.status}>
                    {announcement}
                </span>
            </div>
            <DataGrid.Root
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                rowHeight={38}
                onCellEdit={(edit) => {
                    const next = withField(
                        edit.row,
                        edit.columnKey,
                        edit.value,
                    );
                    const column = columns[edit.columnIndex];
                    if (!next) {
                        setAnnouncement(
                            `${column?.name} of ${edit.row.name} was not saved: not a valid value.`,
                        );
                        return;
                    }
                    setRows((current) =>
                        current.map((row) => (row.id === next.id ? next : row)),
                    );
                    setAnnouncement(`Saved ${column?.name} of ${next.name}.`);
                }}
                className={styles.root}
            >
                <DataGrid.Grid aria-label="Tasks" className={styles.grid}>
                    <DataGrid.Header className={styles.header}>
                        <DataGrid.HeaderRow className={styles.headerRow}>
                            <DataGrid.HeaderCells<Row>>
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
                        <DataGrid.Rows<Row>>
                            {(row) => (
                                <DataGrid.Row row={row} className={styles.row}>
                                    <DataGrid.Cells<Row>>
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
