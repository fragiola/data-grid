"use client";

import {
    type Column,
    DataGrid,
    type HeaderCellInfo,
    headerCellContent,
    type SummaryPosition,
    useColumnResizer,
    useDataGrid,
    useGridView,
} from "@fragiola/data-grid-react";
import { useLocalRows } from "@fragiola/data-grid-react/local";
import { useSelectAll } from "@fragiola/data-grid-react/selection";
import { ArrowDown, ArrowUp, Download } from "lucide-react";
import { createContext, type ReactNode, use, useMemo, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { Checkbox } from "#/components/ui/checkbox";
import {
    type BudgetedTask,
    budgetedTasks,
    withField,
} from "../_kit/budgeted-tasks";
import { formatMoney, hash } from "../_kit/data";
import {
    AmountEditor,
    DateEditor,
    StatusEditor,
    TextEditor,
} from "../editing/editors";
import * as styles from "./styles";

// React Data Grid's "common features" in one grid: a selection column, columns pinned at the
// start and at the end, every column sortable and resizable, cells edited in place, a summary
// row on top and one at the bottom, and an export. The grid keeps the state that is its own
// (selection, sort, widths); the rows, the edits, the totals and the export are the app's.

interface Job extends BudgetedTask {
    /** whether the assignee can take it now: a checkbox the app writes */
    available: boolean;
}

const JOBS: Job[] = budgetedTasks(1_000).map((task) => ({
    ...task,
    available: hash(task.id + 101, 3) > 0,
}));

/** A completed job cannot be selected: the grid skips it in a range and in "select all". */
const isSelectable = (job: Job) => job.status !== "Completed";

/**
 * The rows "select all" covers: the ones that can be selected, worked out again as the jobs
 * change (an edit can complete one). Given to the header's checkbox through a context, so the
 * columns stay the same.
 */
const SelectableIds = createContext<readonly number[]>([]);

function SelectRow({ rowIndex, name }: { rowIndex: number; name: string }) {
    const { model } = useDataGrid<Job>();
    // the view moves with the selection: the box follows
    useGridView();
    return (
        <Checkbox.Root
            aria-label={`Select ${name}`}
            checked={model.is("row-selected", { rowIndex })}
            disabled={!model.is("row-selectable", { rowIndex })}
            onCheckedChange={(_, details) =>
                model.run("selected-rows.toggle", {
                    rowIndex,
                    extend:
                        "shiftKey" in details.event &&
                        details.event.shiftKey === true,
                })
            }
        >
            <Checkbox.Indicator />
        </Checkbox.Root>
    );
}

function SelectAll() {
    const all = useSelectAll(use(SelectableIds));
    return (
        <Checkbox.Root
            aria-label="Select all"
            checked={all.status === "all"}
            indeterminate={all.status === "some"}
            onCheckedChange={all.toggle}
        >
            <Checkbox.Indicator />
        </Checkbox.Root>
    );
}

/** The figures the summary rows show, over every job. */
interface Totals {
    readonly count: number;
    readonly budget: number;
    readonly available: number;
}

/** What each column's summary cells show, by key: the top row the averages, the bottom the totals. */
const SUMMARIES: Partial<
    Record<string, (totals: Totals, position: SummaryPosition) => ReactNode>
> = {
    name: (totals, position) =>
        position === "top" ? "Average" : `Total · ${totals.count} jobs`,
    budget: (totals, position) =>
        formatMoney(
            position === "top"
                ? Math.round(totals.budget / Math.max(1, totals.count))
                : totals.budget,
        ),
    available: (totals) =>
        `${((100 * totals.available) / Math.max(1, totals.count)).toFixed(1)}%`,
};

/** A column's text in the CSV: its value, quoted when it holds a comma, a quote or a line break. */
function csvField(value: unknown): string {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** A column's text in the export, where it is not the value itself: what the grid shows. */
const EXPORT_TEXT: Partial<Record<string, (job: Job) => string>> = {
    effectiveness: (job) => `${job.effectiveness * 20}%`,
    budget: (job) => formatMoney(job.budget),
    available: (job) => (job.available ? "Yes" : "No"),
};

/**
 * The rows as CSV, in the order shown, with every column but the checkboxes', each cell as the
 * grid shows it. The app has every row: it exports them, not the few the grid renders.
 */
function toCsv(columns: readonly Column<Job>[], rows: readonly Job[]): string {
    const exported = columns.filter((column) => column.key !== "select");
    return [
        exported.map((column) => csvField(column.name)).join(","),
        ...rows.map((row) => {
            // the row's fields by key
            const fields: Record<string, unknown> = { ...row };
            return exported
                .map((column) =>
                    csvField(
                        EXPORT_TEXT[column.key]?.(row) ?? fields[column.key],
                    ),
                )
                .join(",");
        }),
    ].join("\n");
}

/** Hands the reader a file (the browser's download), from text the app made. */
function download(text: string, name: string) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    // released once the browser has taken the file: at once, it could cancel the download
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export default function CommonFeatures() {
    const [jobs, setJobs] = useState<readonly Job[]>(JOBS);
    const columns = useMemo(
        (): Column<Job>[] => [
            {
                key: "select",
                width: 44,
                pinned: "start",
                renderHeaderCell: () => <SelectAll />,
                renderCell: ({ row, rowIndex }) => (
                    <SelectRow rowIndex={rowIndex} name={row.name} />
                ),
            },
            {
                key: "name",
                name: "Task",
                width: 200,
                pinned: "start",
                sortable: true,
                resizable: true,
                editable: true,
                renderEditCell: (props) => (
                    <TextEditor {...props} className={styles.editor} />
                ),
            },
            {
                key: "project",
                name: "Project",
                width: 120,
                sortable: true,
                resizable: true,
            },
            {
                key: "status",
                name: "Status",
                width: 140,
                sortable: true,
                resizable: true,
                editable: true,
                renderEditCell: (props) => (
                    <StatusEditor {...props} className={styles.select} />
                ),
            },
            {
                key: "priority",
                name: "Priority",
                width: 110,
                sortable: true,
                resizable: true,
            },
            {
                key: "assignee",
                name: "Assignee",
                width: 120,
                sortable: true,
                resizable: true,
            },
            {
                key: "effectiveness",
                name: "Completion",
                width: 150,
                sortable: true,
                resizable: true,
                renderCell: ({ row }) => (
                    <span className={styles.progress}>
                        <progress
                            max={5}
                            value={row.effectiveness}
                            aria-label={`${row.name} completion`}
                            className={styles.bar}
                        />
                        {row.effectiveness * 20}%
                    </span>
                ),
            },
            {
                key: "due",
                name: "Deadline",
                width: 140,
                sortable: true,
                resizable: true,
                editable: true,
                renderEditCell: (props) => (
                    <DateEditor {...props} className={styles.editor} />
                ),
            },
            {
                key: "budget",
                name: "Budget",
                width: 120,
                sortable: true,
                resizable: true,
                editable: (job) => job.status !== "Completed",
                renderCell: ({ row }) => formatMoney(row.budget),
                renderEditCell: (props) => (
                    <AmountEditor {...props} className={styles.editor} />
                ),
            },
            {
                key: "available",
                name: "Available",
                width: 100,
                pinned: "end",
                sortable: true,
                renderCell: ({ row }) => (
                    <Checkbox.Root
                        aria-label={`${row.name} available`}
                        checked={row.available}
                        onCheckedChange={(available) =>
                            setJobs((current) =>
                                current.map((job) =>
                                    job.id === row.id
                                        ? { ...job, available }
                                        : job,
                                ),
                            )
                        }
                    >
                        <Checkbox.Indicator />
                    </Checkbox.Root>
                ),
            },
        ],
        [],
    );
    const local = useLocalRows(jobs, columns);
    const selectableIds = useMemo(
        () => jobs.filter(isSelectable).map((job) => job.id),
        [jobs],
    );
    const totals = useMemo(
        (): Totals => ({
            count: jobs.length,
            budget: jobs.reduce((sum, job) => sum + job.budget, 0),
            available: jobs.filter((job) => job.available).length,
        }),
        [jobs],
    );
    const [selected, setSelected] = useState<readonly unknown[]>([]);

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <span data-testid="selected-count">
                    {selected.length} selected
                </span>
                <Clickable.Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                        download(toCsv(columns, local.rows), "jobs.csv")
                    }
                >
                    <Download aria-hidden />
                    Export to CSV
                </Clickable.Button>
            </div>
            <SelectableIds value={selectableIds}>
                <DataGrid.Root
                    {...local.props}
                    columns={columns}
                    rowKey={(row) => row.id}
                    rowHeight={38}
                    rowSelection="multiple"
                    isRowSelectable={isSelectable}
                    onSelectedRowKeysChange={setSelected}
                    summaryRows={{ top: 1, bottom: 1 }}
                    summaryRowHeight={38}
                    onCellEdit={({ row, columnKey, value }) =>
                        // the app writes the value, through its one rule; a refused one changes nothing
                        setJobs((current) =>
                            current.map((job) => {
                                if (job.id !== row.id) return job;
                                const next = withField(job, columnKey, value);
                                return next ? { ...job, ...next } : job;
                            }),
                        )
                    }
                    className={styles.root}
                >
                    <DataGrid.Grid aria-label="Jobs" className={styles.grid}>
                        <DataGrid.Header className={styles.header}>
                            <DataGrid.HeaderRow className={styles.headerRow}>
                                <DataGrid.HeaderCells<Job>>
                                    {(cell) => <HeaderCell cell={cell} />}
                                </DataGrid.HeaderCells>
                            </DataGrid.HeaderRow>
                        </DataGrid.Header>
                        <Summary position="top" totals={totals} />
                        <DataGrid.Body>
                            <DataGrid.Rows<Job>>
                                {(row) => (
                                    <DataGrid.Row
                                        row={row}
                                        className={styles.row}
                                    >
                                        <DataGrid.Cells<Job>>
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
                        {/* after the body: it stays at the view's bottom edge */}
                        <Summary position="bottom" totals={totals} />
                    </DataGrid.Grid>
                </DataGrid.Root>
            </SelectableIds>
        </div>
    );
}

function Resizer({ cell }: { cell: HeaderCellInfo<Job> }) {
    const { state, props } = useColumnResizer(cell);
    if (!state.resizable) return null;
    return (
        // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the hook's props make it a separator, a focusable one (the APG's splitter), which an <hr> cannot be
        <div
            {...props}
            aria-label={`Resize ${cell.column?.name ?? cell.key}`}
            className={styles.resizer}
        />
    );
}

/** A header cell: its content, the app's sort arrow and a resize handle. */
function HeaderCell({ cell }: { cell: HeaderCellInfo<Job> }) {
    return (
        <DataGrid.HeaderCell
            cell={cell}
            className={styles.headerCell}
            render={(props, state) => (
                <div {...props}>
                    {headerCellContent(cell)}
                    {state.sortDirection === "ascending" ? (
                        <ArrowUp aria-hidden className={styles.sortIcon} />
                    ) : state.sortDirection === "descending" ? (
                        <ArrowDown aria-hidden className={styles.sortIcon} />
                    ) : null}
                    <Resizer cell={cell} />
                </div>
            )}
        />
    );
}

/** A position's summary row: sticky, opaque, the app's figure in each cell. */
function Summary({
    position,
    totals,
}: {
    position: SummaryPosition;
    totals: Totals;
}) {
    return (
        <DataGrid.Summary position={position} className={styles.summary}>
            <DataGrid.SummaryRows>
                {(row) => (
                    <DataGrid.SummaryRow
                        row={row}
                        className={styles.summaryRow}
                    >
                        <DataGrid.SummaryCells<Job>>
                            {(cell) => (
                                <DataGrid.SummaryCell
                                    cell={cell}
                                    className={styles.summaryCell}
                                >
                                    {SUMMARIES[cell.column.key]?.(
                                        totals,
                                        cell.position,
                                    )}
                                </DataGrid.SummaryCell>
                            )}
                        </DataGrid.SummaryCells>
                    </DataGrid.SummaryRow>
                )}
            </DataGrid.SummaryRows>
        </DataGrid.Summary>
    );
}
