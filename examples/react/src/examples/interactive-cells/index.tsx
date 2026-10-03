"use client";

import { type Column, DataGrid } from "@fragiola/data-grid-react";
import { Copy, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { Input } from "#/components/atoms/fields";
import { Checkbox } from "#/components/ui/checkbox";
import { Select } from "#/components/ui/select";
import { STATUSES, type Task, tasks } from "../_kit/tasks";
import * as styles from "./styles";

const STATUS_ITEMS = Object.fromEntries(
    STATUSES.map((status) => [status, status]),
);

function isStatus(value: unknown): value is Task["status"] {
    return STATUSES.some((status) => status === value);
}

/** What the app does to a task: rename it, change its status, copy it, delete it. */
interface Actions {
    update: (id: number, change: Partial<Task>) => void;
    duplicate: (id: number) => void;
    remove: (id: number) => void;
}

/**
 * Every cell holds controls, and the grid stays one tab stop: it keeps them out of the tab order
 * and hands a cell's keys to them on Enter or F2 (or a click); Escape comes back.
 */
function columnsFor({ update, duplicate, remove }: Actions): Column<Task>[] {
    return [
        {
            key: "done",
            name: "Done",
            width: 64,
            renderCell: ({ row }) => (
                <Checkbox.Root
                    aria-label={`${row.name} done`}
                    checked={row.status === "Completed"}
                    onCheckedChange={(checked) =>
                        update(row.id, {
                            status: checked ? "Completed" : "In Progress",
                        })
                    }
                >
                    <Checkbox.Indicator />
                </Checkbox.Root>
            ),
        },
        {
            key: "name",
            name: "Task",
            width: 240,
            renderCell: ({ row }) => (
                <Input
                    aria-label={`Name of task ${row.id}`}
                    value={row.name}
                    onValueChange={(name) => update(row.id, { name })}
                    className={styles.field}
                />
            ),
        },
        {
            key: "status",
            name: "Status",
            width: 170,
            renderCell: ({ row }) => (
                <Select.Root
                    items={STATUS_ITEMS}
                    value={row.status}
                    onValueChange={(status) => {
                        if (isStatus(status)) update(row.id, { status });
                    }}
                >
                    <Select.Trigger
                        className={styles.select}
                        aria-label={`Status of ${row.name}`}
                    >
                        <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                        {STATUSES.map((status) => (
                            <Select.Item key={status} value={status}>
                                {status}
                            </Select.Item>
                        ))}
                    </Select.Content>
                </Select.Root>
            ),
        },
        {
            key: "assignee",
            name: "Assignee",
            width: 150,
            renderCell: ({ row }) => (
                <a
                    className={styles.link}
                    href={`mailto:${row.assignee.toLowerCase()}@example.com`}
                >
                    {row.assignee}
                </a>
            ),
        },
        {
            key: "actions",
            name: "Actions",
            width: 110,
            renderCell: ({ row }) => (
                <span className={styles.actions}>
                    <Clickable.Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Duplicate ${row.name}`}
                        onClick={() => duplicate(row.id)}
                    >
                        <Copy aria-hidden />
                    </Clickable.Button>
                    <Clickable.Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Delete ${row.name}`}
                        onClick={() => remove(row.id)}
                    >
                        <Trash2 aria-hidden />
                    </Clickable.Button>
                </span>
            ),
        },
    ];
}

export default function InteractiveCells() {
    const [rows, setRows] = useState(() => tasks(60));
    const columns = useMemo(
        () =>
            columnsFor({
                update: (id, change) =>
                    setRows((current) =>
                        current.map((row) =>
                            row.id === id ? { ...row, ...change } : row,
                        ),
                    ),
                duplicate: (id) =>
                    setRows((current) => {
                        const index = current.findIndex((row) => row.id === id);
                        const original = current[index];
                        if (!original) return current;
                        const copy = {
                            ...original,
                            id: Math.max(...current.map((row) => row.id)) + 1,
                            name: `${original.name} (copy)`,
                        };
                        return [
                            ...current.slice(0, index + 1),
                            copy,
                            ...current.slice(index + 1),
                        ];
                    }),
                remove: (id) =>
                    setRows((current) =>
                        current.filter((row) => row.id !== id),
                    ),
            }),
        [],
    );

    return (
        <div className={styles.frame}>
            <p className={styles.hint}>
                <span>
                    <kbd className={styles.key}>Enter</kbd> or{" "}
                    <kbd className={styles.key}>F2</kbd> into a cell's controls
                </span>
                <span>
                    <kbd className={styles.key}>Tab</kbd> its next control
                </span>
                <span>
                    <kbd className={styles.key}>Esc</kbd> back to the grid
                </span>
                <span className={styles.count} data-testid="count">
                    {rows.length} tasks
                </span>
            </p>
            <DataGrid.Root
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                rowHeight={44}
                className={styles.root}
            >
                <DataGrid.Grid aria-label="Tasks" className={styles.grid}>
                    <DataGrid.Header className={styles.header}>
                        <DataGrid.HeaderRow className={styles.headerRow}>
                            <DataGrid.HeaderCells<Task>>
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
                        <DataGrid.Rows<Task>>
                            {(row) => (
                                <DataGrid.Row row={row} className={styles.row}>
                                    <DataGrid.Cells<Task>>
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
