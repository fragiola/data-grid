"use client";

import {
    type CellInfo,
    type Column,
    DataGrid,
    headerCellContent,
    type RowMove,
    useRowDragHandle,
} from "@fragiola/data-grid-react";
import { useLocalRows } from "@fragiola/data-grid-react/local";
import {
    ArrowDown,
    ArrowUp,
    GripVertical,
    RotateCcw,
    Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { Input } from "#/components/atoms/fields";
import { type Task, tasks } from "../_kit/tasks";
import * as styles from "./styles";

const backlog = tasks(200);

// "#" is the task's place in the backlog: the app's own order, which a drag or the keys change
const columns: Column<Task>[] = [
    { key: "rank", name: "#", width: 84, pinned: "start" },
    { key: "name", name: "Task", width: 220, sortable: true },
    { key: "project", name: "Project", width: 130, sortable: true },
    { key: "priority", name: "Priority", width: 110 },
    { key: "status", name: "Status", width: 130 },
    { key: "assignee", name: "Assignee", width: 120 },
    { key: "due", name: "Due", width: 120, sortable: true },
];

/**
 * A row's handle, as the app draws it: the hook's props (they mark it for the grid and hide it
 * from screen readers, which move rows with the keys) on an element of its own.
 */
function Handle({ cell }: { cell: CellInfo<Task> }) {
    const { state, props } = useRowDragHandle(cell);
    return (
        <span {...props} className={styles.handle(state)}>
            <GripVertical aria-hidden className={styles.grip} />
        </span>
    );
}

/** What the live region says of a move: the app's words, from its own rows. */
function describeMove(rows: readonly Task[], move: RowMove): string {
    const task = rows[move.fromIndex];
    return task
        ? `Moved ${task.name} to position ${move.toIndex + 1} of ${rows.length}.`
        : "";
}

export default function RowReordering() {
    // the app's rows, in its own order: the grid never orders them, it tells each move
    const [rows, setRows] = useState<readonly Task[]>(backlog);
    const [announcement, setAnnouncement] = useState("");
    // searched and sorted in memory; a move lands beside the row it was dropped on, searched too
    const local = useLocalRows(rows, columns);
    const sorted = local.sort.columns.length > 0;
    // each task's place in the backlog, searched or sorted alike
    const ranks = useMemo(
        () => new Map(rows.map((task, index) => [task.id, index + 1])),
        [rows],
    );

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <Input.Template.Simple
                    aria-label="Search every column"
                    placeholder="Search"
                    value={local.filter.search}
                    onValueChange={local.filter.setSearch}
                    inset={{
                        start: <Search aria-hidden className={styles.icon} />,
                    }}
                    className={styles.search}
                />
                <span>
                    Drag a handle, or <kbd className={styles.key}>Ctrl/⌘</kbd>
                    <kbd className={styles.key}>Shift</kbd>
                    <kbd className={styles.key}>↑</kbd>
                    <kbd className={styles.key}>↓</kbd> on a row
                </span>
                {/* the app's live region: a polite status, its text the app's own */}
                <span role="status" className={styles.status}>
                    {sorted
                        ? "Sorted rows keep the sort's order: clear it to reorder."
                        : announcement}
                </span>
                {sorted ? (
                    <Clickable.Button
                        size="sm"
                        variant="outline"
                        onClick={local.sort.clear}
                    >
                        Clear sort
                    </Clickable.Button>
                ) : null}
                <Clickable.Button
                    size="sm"
                    variant="outline"
                    disabled={rows === backlog}
                    onClick={() => {
                        setRows(backlog);
                        setAnnouncement("Backlog back in its first order.");
                    }}
                >
                    <RotateCcw aria-hidden />
                    Reset order
                </Clickable.Button>
            </div>
            <DataGrid.Root
                {...local.props}
                columns={columns}
                rowKey={(row) => row.id}
                rowHeight={38}
                onRowMove={(move) => {
                    setAnnouncement(describeMove(local.rows, move));
                    setRows(local.moveRow(move));
                }}
                className={styles.root}
            >
                <DataGrid.Grid aria-label="Backlog" className={styles.grid}>
                    <DataGrid.Header className={styles.header}>
                        <DataGrid.HeaderRow className={styles.headerRow}>
                            <DataGrid.HeaderCells<Task>>
                                {(cell) => (
                                    <DataGrid.HeaderCell
                                        cell={cell}
                                        className={styles.headerCell}
                                        render={(props, state) => (
                                            <div {...props}>
                                                {headerCellContent(cell)}
                                                {state.sortDirection ===
                                                "ascending" ? (
                                                    <ArrowUp
                                                        aria-hidden
                                                        className={
                                                            styles.sortIcon
                                                        }
                                                    />
                                                ) : state.sortDirection ===
                                                  "descending" ? (
                                                    <ArrowDown
                                                        aria-hidden
                                                        className={
                                                            styles.sortIcon
                                                        }
                                                    />
                                                ) : null}
                                            </div>
                                        )}
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
                                            >
                                                {cell.column.key === "rank" ? (
                                                    <>
                                                        <Handle cell={cell} />
                                                        <span
                                                            className={
                                                                styles.rank
                                                            }
                                                        >
                                                            {cell.row &&
                                                                ranks.get(
                                                                    cell.row.id,
                                                                )}
                                                        </span>
                                                    </>
                                                ) : undefined}
                                            </DataGrid.Cell>
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
