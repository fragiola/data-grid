"use client";

import {
    type CellPosition,
    type Column,
    DataGrid,
    useDataGridRef,
} from "@fragiola/data-grid-react";
import { ArrowDownToLine, ArrowUpToLine, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ContextMenu } from "#/components/ui/context-menu";
import { type Task, task, tasks } from "../_kit/tasks";
import * as styles from "./styles";

const columns: Column<Task>[] = [
    { key: "id", name: "#", width: 72 },
    { key: "name", name: "Task", width: 240 },
    { key: "project", name: "Project", width: 120 },
    { key: "status", name: "Status", width: 130 },
    { key: "assignee", name: "Assignee", width: 110 },
    { key: "due", name: "Due", width: 120 },
];

// The menu is the app's (Fragiola UI's context menu, over Base UI): the grid renders none. A
// body cell's own handlers say which row the menu acts on: `onContextMenu` (a right click,
// Shift+F10 or the menu key on the focused cell, a long press where the browser fires it) and
// `onTouchStart` (a long press where Base UI times it, as on iOS, with no context menu event).
// The menu opens only for a body cell, never over the header, and makes that cell active.
// Closing it focuses the grid, which hands focus to its active cell.

export default function ContextMenuExample() {
    // the app's rows: the menu changes them, the grid shows them
    const [rows, setRows] = useState<readonly Task[]>(() => tasks(200));
    const nextId = useRef(rows.length + 1);
    const [target, setTarget] = useState<CellPosition | null>(null);
    // the cell a context menu event came from, until the menu asks to open
    const pressed = useRef<CellPosition | null>(null);
    const [announcement, setAnnouncement] = useState("");

    /** Records the cell a context menu would open for. */
    function press(cell: CellPosition) {
        pressed.current = {
            rowIndex: cell.rowIndex,
            columnIndex: cell.columnIndex,
        };
    }
    const gridRef = useDataGridRef<Task>();
    const gridElement = useRef<HTMLDivElement>(null);

    /** Changes the rows now (so the grid has them), then makes `active` the active cell. */
    function change(next: readonly Task[], active: CellPosition, what: string) {
        flushSync(() => setRows(next));
        gridRef.current?.model.run("active-position.set", active);
        setAnnouncement(what);
    }

    function insert(at: number, columnIndex: number) {
        // a new task, its id the next one
        const row = task(nextId.current - 1);
        nextId.current += 1;
        change(
            [...rows.slice(0, at), row, ...rows.slice(at)],
            { rowIndex: at, columnIndex },
            `Inserted task ${row.id} at row ${at + 1}.`,
        );
    }

    function remove(at: number, columnIndex: number) {
        const removed = rows[at];
        const next = [...rows.slice(0, at), ...rows.slice(at + 1)];
        change(
            next,
            { rowIndex: Math.min(at, next.length - 1), columnIndex },
            `Deleted task ${removed?.id}.`,
        );
    }

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <span>
                    Right-click a row, or press{" "}
                    <kbd className={styles.key}>Shift</kbd>+
                    <kbd className={styles.key}>F10</kbd> on a cell
                </span>
                {/* the app's live region: what the last action did */}
                <span role="status" className={styles.status}>
                    {announcement}
                </span>
            </div>
            <ContextMenu.Root
                open={target !== null}
                onOpenChange={(open) => {
                    // the menu opens for a body cell only (`pressed`, set by its handler first),
                    // and makes it the active cell
                    const at = open ? pressed.current : null;
                    if (at)
                        gridRef.current?.model.run("active-position.set", at);
                    setTarget(at);
                    pressed.current = null;
                }}
            >
                <ContextMenu.Trigger
                    className={styles.trigger}
                    // before a cell's own handler: a press outside the body's cells (the header)
                    // leaves no row from an earlier one
                    onContextMenuCapture={() => {
                        pressed.current = null;
                    }}
                    onTouchStartCapture={() => {
                        pressed.current = null;
                    }}
                >
                    <DataGrid.Root
                        gridRef={gridRef}
                        columns={columns}
                        rows={rows}
                        rowKey={(row) => row.id}
                        rowHeight={36}
                        className={styles.root}
                    >
                        <DataGrid.Grid
                            ref={gridElement}
                            aria-label="Tasks"
                            className={styles.grid}
                        >
                            <DataGrid.Header className={styles.header}>
                                <DataGrid.HeaderRow
                                    className={styles.headerRow}
                                >
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
                                        <DataGrid.Row
                                            row={row}
                                            className={styles.row}
                                        >
                                            <DataGrid.Cells<Task>>
                                                {(cell) => (
                                                    <DataGrid.Cell
                                                        cell={cell}
                                                        className={(state) =>
                                                            styles.cell(
                                                                state,
                                                                target?.rowIndex ===
                                                                    cell.rowIndex,
                                                            )
                                                        }
                                                        // the row a menu would act on:
                                                        // a right click, the menu key, or a
                                                        // touch that may become a long press
                                                        onContextMenu={() =>
                                                            press(cell)
                                                        }
                                                        onTouchStart={() =>
                                                            press(cell)
                                                        }
                                                    />
                                                )}
                                            </DataGrid.Cells>
                                        </DataGrid.Row>
                                    )}
                                </DataGrid.Rows>
                            </DataGrid.Body>
                        </DataGrid.Grid>
                    </DataGrid.Root>
                </ContextMenu.Trigger>
                {/* closed, focus goes to the grid: the grid hands it to its active cell */}
                <ContextMenu.Content finalFocus={gridElement}>
                    {target ? (
                        <>
                            <ContextMenu.Item
                                onClick={() =>
                                    insert(target.rowIndex, target.columnIndex)
                                }
                            >
                                <ArrowUpToLine aria-hidden />
                                Insert row above
                            </ContextMenu.Item>
                            <ContextMenu.Item
                                onClick={() =>
                                    insert(
                                        target.rowIndex + 1,
                                        target.columnIndex,
                                    )
                                }
                            >
                                <ArrowDownToLine aria-hidden />
                                Insert row below
                            </ContextMenu.Item>
                            <ContextMenu.Separator />
                            <ContextMenu.Item
                                className={styles.danger}
                                disabled={rows.length === 1}
                                onClick={() =>
                                    remove(target.rowIndex, target.columnIndex)
                                }
                            >
                                <Trash2 aria-hidden />
                                Delete row
                            </ContextMenu.Item>
                        </>
                    ) : null}
                </ContextMenu.Content>
            </ContextMenu.Root>
        </div>
    );
}
