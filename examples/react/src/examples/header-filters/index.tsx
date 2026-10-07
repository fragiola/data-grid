"use client";

import {
    type Column,
    DataGrid,
    type HeaderCellInfo,
    headerCellContent,
} from "@fragiola/data-grid-react";
import { useLocalRows } from "@fragiola/data-grid-react/local";
import { ArrowDown, ArrowUp } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { Input } from "#/components/atoms/fields";
import { Select } from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";
import {
    ASSIGNEES,
    PRIORITIES,
    PROJECTS,
    STATUSES,
    type Task,
    tasks,
} from "../_kit/tasks";
import * as styles from "./styles";

const ROWS = tasks(1_000);

/** A select filter's choice: its value and its label. */
interface Choice {
    readonly value: string;
    readonly label: string;
}

/**
 * A select filter's choices, in order: every value, then each one. An array, not an object: an
 * object lists keys like "3" before "all".
 */
function choices(values: readonly string[]): Choice[] {
    return [
        { value: "all", label: "All" },
        ...values.map((value) => ({ value, label: value })),
    ];
}

/** The filter under each column's name, by key: a text field or a select. */
const FILTERS: Partial<
    Record<string, { kind: "text" } | { kind: "select"; items: Choice[] }>
> = {
    name: { kind: "text" },
    project: { kind: "select", items: choices(PROJECTS) },
    priority: { kind: "select", items: choices(PRIORITIES) },
    status: { kind: "select", items: choices(STATUSES) },
    assignee: { kind: "select", items: choices(ASSIGNEES) },
    effectiveness: {
        kind: "select",
        items: [
            { value: "all", label: "Any" },
            { value: "3", label: "3 and up" },
            { value: "4", label: "4 and up" },
            { value: "5", label: "5" },
        ],
    },
};

const columns: Column<Task>[] = [
    { key: "id", name: "#", width: 64, sortable: true },
    { key: "name", name: "Task", width: 220, sortable: true },
    { key: "project", name: "Project", width: 130, sortable: true },
    { key: "priority", name: "Priority", width: 120, sortable: true },
    { key: "status", name: "Status", width: 140, sortable: true },
    { key: "assignee", name: "Assignee", width: 120, sortable: true },
    {
        key: "effectiveness",
        name: "Rating",
        width: 120,
        sortable: true,
        renderCell: ({ row }) => "★".repeat(row.effectiveness),
        // its own filter: a minimum rating, not an equal one
        filter: (value, minimum) =>
            typeof value === "number" &&
            typeof minimum === "number" &&
            value >= minimum,
    },
];

// The filters are controls inside the header cells. The grid keeps a header cell holding
// controls one tab stop: a click on a control (or Enter, F2) hands it the keys, Tab moves among
// a cell's controls and Escape gives them back; a click on a control is never a sort. The rows
// are filtered and sorted in memory by `useLocalRows`, the filters' values kept by it.

export default function HeaderFilters() {
    const local = useLocalRows(ROWS, columns);
    const [shown, setShown] = useState(true);
    const shownLabel = useId();
    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <span className={styles.toggle}>
                    <Switch.Root
                        aria-labelledby={shownLabel}
                        checked={shown}
                        onCheckedChange={setShown}
                    >
                        <Switch.Thumb />
                    </Switch.Root>
                    <span id={shownLabel}>Filters</span>
                </span>
                <Clickable.Button
                    size="sm"
                    variant="outline"
                    onClick={() => local.filter.clear()}
                >
                    Clear filters
                </Clickable.Button>
                <span className={styles.count} data-testid="count">
                    {local.filteredCount} of {ROWS.length} tasks
                </span>
            </div>
            <DataGrid.Root
                {...local.props}
                columns={columns}
                rowKey={(row) => row.id}
                rowHeight={36}
                // room for the filter under the name
                headerRowHeight={shown ? 72 : 36}
                className={styles.root}
            >
                <DataGrid.Grid aria-label="Tasks" className={styles.grid}>
                    <DataGrid.Header className={styles.header}>
                        <DataGrid.HeaderRow className={styles.headerRow}>
                            <DataGrid.HeaderCells<Task>>
                                {(cell) => (
                                    <HeaderCell
                                        cell={cell}
                                        filter={
                                            shown ? (
                                                <Filter
                                                    cell={cell}
                                                    value={
                                                        local.filter.values[
                                                            cell.key
                                                        ]
                                                    }
                                                    onChange={(value) =>
                                                        local.filter.set(
                                                            cell.key,
                                                            value,
                                                        )
                                                    }
                                                />
                                            ) : null
                                        }
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
                    <DataGrid.Empty className={styles.empty}>
                        No task matches these filters.
                    </DataGrid.Empty>
                </DataGrid.Grid>
            </DataGrid.Root>
        </div>
    );
}

/** A header cell: its name and sort arrow on top, its filter below. */
function HeaderCell({
    cell,
    filter,
}: {
    cell: HeaderCellInfo<Task>;
    filter: ReactNode;
}) {
    return (
        <DataGrid.HeaderCell
            cell={cell}
            className={styles.headerCell}
            render={(props, state) => (
                <div {...props}>
                    <span className={styles.title}>
                        {headerCellContent(cell)}
                        {state.sortDirection === "ascending" ? (
                            <ArrowUp aria-hidden className={styles.sortIcon} />
                        ) : state.sortDirection === "descending" ? (
                            <ArrowDown
                                aria-hidden
                                className={styles.sortIcon}
                            />
                        ) : null}
                    </span>
                    {filter}
                </div>
            )}
        />
    );
}

/** A column's filter, by its kind; none for a column without one. */
function Filter({
    cell,
    value,
    onChange,
}: {
    cell: HeaderCellInfo<Task>;
    value: unknown;
    onChange: (value: unknown) => void;
}) {
    const filter = FILTERS[cell.key];
    const name = cell.column?.name ?? cell.key;
    if (filter?.kind === "text") {
        return (
            <Input
                aria-label={`Filter ${name}`}
                placeholder="Contains"
                value={typeof value === "string" ? value : ""}
                onValueChange={onChange}
                className={styles.textFilter}
            />
        );
    }
    if (filter?.kind === "select") {
        const numeric = cell.key === "effectiveness";
        return (
            <Select.Root
                items={filter.items}
                value={value === undefined ? "all" : String(value)}
                onValueChange={(choice) =>
                    onChange(
                        choice === "all" || choice === null
                            ? undefined
                            : numeric
                              ? Number(choice)
                              : choice,
                    )
                }
            >
                <Select.Trigger
                    aria-label={`Filter ${name}`}
                    className={styles.selectFilter}
                >
                    <Select.Value />
                </Select.Trigger>
                <Select.Content>
                    {filter.items.map((choice) => (
                        <Select.Item key={choice.value} value={choice.value}>
                            {choice.label}
                        </Select.Item>
                    ))}
                </Select.Content>
            </Select.Root>
        );
    }
    return null;
}
