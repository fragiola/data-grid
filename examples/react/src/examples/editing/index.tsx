"use client";

import {
    type CellEditEvent,
    type Column,
    DataGrid,
    type EditCellRenderProps,
} from "@fragiola/data-grid-react";
import { type ReactNode, useLayoutEffect, useState } from "react";
import { Input, Numeric } from "#/components/atoms/fields";
import { Select } from "#/components/ui/select";
import { formatMoney, hash } from "../_kit/data";
import { STATUSES, type Task, tasks } from "../_kit/tasks";
import * as styles from "./styles";

// Tasks edited in place: the grid edits a cell (the keys, the draft, the commit), the editors are
// the app's (a text field, a number, a select, a date) and so is the data: each commit is told,
// and the app writes it into its rows.

interface Row extends Task {
    /** in dollars */
    budget: number;
}

const initialRows: Row[] = tasks(120).map((task, index) => ({
    ...task,
    budget: 100 * (5 + hash(index + 7, 200)),
}));

const STATUS_ITEMS = Object.fromEntries(
    STATUSES.map((status) => [status, status]),
);

function isStatus(value: unknown): value is Task["status"] {
    return STATUSES.some((status) => status === value);
}

type EditorProps = EditCellRenderProps<Row, ReactNode>;

/** An edit typing started: the editor starts from the key typed, as a spreadsheet does. */
function useStartKey(
    startKey: string | undefined,
    onChange: (value: unknown) => void,
) {
    useLayoutEffect(() => {
        if (startKey !== undefined) onChange(startKey);
    }, [startKey, onChange]);
}

/** A task's name: a text field. */
function TextEditor({ value, startKey, onChange, column }: EditorProps) {
    useStartKey(startKey, onChange);
    return (
        <Input
            aria-label={column.name}
            value={String(value ?? "")}
            onValueChange={(text) => onChange(text)}
            className={styles.editor}
        />
    );
}

/** The budget's text as a number, or `undefined` when it is none. */
function amountOf(value: unknown): number | undefined {
    const amount = typeof value === "number" ? value : Number(value);
    return String(value).trim() !== "" && Number.isFinite(amount) && amount >= 0
        ? Math.round(amount)
        : undefined;
}

/**
 * A budget: a number. A value that is no amount keeps the edit open: the editor prevents Enter
 * and Tab (its own handler runs before the grid's), and says so.
 */
function BudgetEditor({ value, startKey, onChange, column }: EditorProps) {
    useStartKey(
        startKey !== undefined && /\d/.test(startKey) ? startKey : undefined,
        onChange,
    );
    const valid = amountOf(value) !== undefined;
    return (
        <Numeric
            aria-label={column.name}
            aria-invalid={!valid}
            min={0}
            step={100}
            value={String(value ?? "")}
            onValueChange={(text) => onChange(text)}
            onKeyDown={(event) => {
                if (!valid && (event.key === "Enter" || event.key === "Tab")) {
                    event.preventDefault();
                }
            }}
            className={styles.editor}
        />
    );
}

/**
 * A status: a select, open as the edit starts; choosing one commits it. Its list is portalled out
 * of the grid: marked as the edit's (`data-grid-editor`), a press or focus there keeps it open.
 */
function StatusEditor({ value, onCommit, column }: EditorProps) {
    return (
        <Select.Root
            items={STATUS_ITEMS}
            value={String(value)}
            defaultOpen
            onValueChange={(status) => {
                if (isStatus(status)) onCommit(status);
            }}
        >
            <Select.Trigger aria-label={column.name} className={styles.select}>
                <Select.Value />
            </Select.Trigger>
            <Select.Content data-grid-editor="">
                {STATUSES.map((status) => (
                    <Select.Item key={status} value={status}>
                        {status}
                    </Select.Item>
                ))}
            </Select.Content>
        </Select.Root>
    );
}

/** A due date: the browser's date field. */
function DateEditor({ value, onChange, column }: EditorProps) {
    return (
        <Input
            type="date"
            aria-label={column.name}
            value={String(value ?? "")}
            onValueChange={(date) => onChange(date)}
            className={styles.editor}
        />
    );
}

const columns: Column<Row>[] = [
    {
        key: "name",
        name: "Task",
        width: 220,
        editable: true,
        renderEditCell: (props) => <TextEditor {...props} />,
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
        renderEditCell: (props) => <BudgetEditor {...props} />,
    },
    {
        key: "status",
        name: "Status",
        width: 160,
        editable: true,
        renderEditCell: (props) => <StatusEditor {...props} />,
    },
    {
        key: "due",
        name: "Due",
        width: 150,
        editable: true,
        renderEditCell: (props) => <DateEditor {...props} />,
    },
    { key: "assignee", name: "Assignee", width: 120 },
];

/** A task with an edit written in, by the app's own rules; `undefined` when the value is refused. */
function withEdit(row: Row, { columnKey, value }: CellEditEvent<Row>) {
    if (columnKey === "name" && typeof value === "string" && value.trim()) {
        return { ...row, name: value.trim() };
    }
    if (columnKey === "budget") {
        const budget = amountOf(value);
        return budget === undefined ? undefined : { ...row, budget };
    }
    if (columnKey === "status" && isStatus(value))
        return { ...row, status: value };
    if (
        columnKey === "due" &&
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return { ...row, due: value };
    }
    return undefined;
}

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
                    const next = withEdit(edit.row, edit);
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
