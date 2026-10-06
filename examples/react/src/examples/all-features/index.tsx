"use client";

import { repeatedFill } from "@fragiola/data-grid/fill";
import {
    type CellInfo,
    type Column,
    DataGrid,
    type HeaderCellInfo,
    headerCellContent,
    useColumnResizer,
    useDataGridRef,
    useFillHandle,
} from "@fragiola/data-grid-react";
import { useLocalRows } from "@fragiola/data-grid-react/local";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";
import {
    type BudgetedTask,
    budgetedTasks,
    withField,
} from "../_kit/budgeted-tasks";
import { formatMoney } from "../_kit/data";
import {
    AmountEditor,
    DateEditor,
    StatusEditor,
    TextEditor,
} from "../editing/editors";
import * as styles from "./styles";

// Everything a sheet does, together: cells edited in place, ranges selected, copied as TSV and
// pasted, filled from a handle, rows sorted, the first column pinned and the others resized. The
// grid owns the keys, the pointer and the clipboard; every value is written by the app, through
// one rule (`withField`), whether typed, pasted or filled.

const columns: Column<BudgetedTask>[] = [
    {
        key: "name",
        name: "Task",
        width: 220,
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
        key: "budget",
        name: "Budget",
        width: 120,
        sortable: true,
        resizable: true,
        editable: (task) => task.status !== "Completed",
        renderCell: ({ row }) => formatMoney(row.budget),
        renderEditCell: (props) => (
            <AmountEditor {...props} className={styles.editor} />
        ),
    },
    {
        key: "status",
        name: "Status",
        width: 150,
        sortable: true,
        resizable: true,
        editable: true,
        renderEditCell: (props) => (
            <StatusEditor {...props} className={styles.select} />
        ),
    },
    {
        key: "due",
        name: "Due",
        width: 140,
        sortable: true,
        resizable: true,
        editable: true,
        renderEditCell: (props) => (
            <DateEditor {...props} className={styles.editor} />
        ),
    },
    {
        key: "assignee",
        name: "Assignee",
        width: 120,
        sortable: true,
        resizable: true,
    },
];

/** A change the app writes: a shown row, a column, the value typed, pasted or filled. */
interface Change {
    readonly rowIndex: number;
    readonly columnKey: string;
    readonly value: unknown;
}

function Resizer({ cell }: { cell: HeaderCellInfo<BudgetedTask> }) {
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

function FillHandle({ cell }: { cell: CellInfo<BudgetedTask> }) {
    const { state, props } = useFillHandle(cell);
    if (!state.visible) return null;
    return <span {...props} aria-hidden className={styles.handle(state)} />;
}

export default function AllFeatures() {
    // the app's rows: the grid never writes them
    const [tasks, setTasks] = useState<readonly BudgetedTask[]>(() =>
        budgetedTasks(300),
    );
    const [announcement, setAnnouncement] = useState("");
    // sorted in memory: the grid's indexes are the rows shown
    const local = useLocalRows(tasks, columns);
    // the grid's model from outside its root: a fill repeats the values it reads
    const gridRef = useDataGridRef<BudgetedTask>();

    /** Writes changes to the shown rows through the app's one rule, and says what it did. */
    function write(changes: readonly Change[], what: string) {
        const byId = new Map<number, BudgetedTask>();
        let refused = 0;
        for (const { rowIndex, columnKey, value } of changes) {
            const shown = local.rows[rowIndex];
            if (!shown) continue;
            const next = withField(
                byId.get(shown.id) ?? shown,
                columnKey,
                value,
            );
            if (next) byId.set(shown.id, next);
            else refused += 1;
        }
        setTasks((current) => current.map((task) => byId.get(task.id) ?? task));
        const written = changes.length - refused;
        setAnnouncement(
            `${what}: ${written} ${written === 1 ? "cell" : "cells"} written${
                refused > 0 ? `, ${refused} refused` : ""
            }.`,
        );
    }

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <span>
                    <kbd className={styles.key}>Enter</kbd> edits,{" "}
                    <kbd className={styles.key}>Shift</kbd> + arrows select,{" "}
                    <kbd className={styles.key}>Ctrl/⌘</kbd>
                    <kbd className={styles.key}>C</kbd>
                    <kbd className={styles.key}>V</kbd> copy and paste, the
                    corner's square fills
                </span>
                {/* the app's live region: a polite status, its text the app's own */}
                <span role="status" className={styles.status}>
                    {announcement}
                </span>
            </div>
            <DataGrid.Root
                {...local.props}
                gridRef={gridRef}
                columns={columns}
                rowKey={(task) => task.id}
                rowHeight={38}
                cellSelection="range"
                onCellEdit={(edit) =>
                    write([edit], `Saved ${columns[edit.columnIndex]?.name}`)
                }
                onRangePaste={({ range, values }) =>
                    write(
                        values.flatMap((texts, row) =>
                            texts.map((value, column) => ({
                                rowIndex: range.anchor.rowIndex + row,
                                columnKey:
                                    columns[range.anchor.columnIndex + column]
                                        ?.key ?? "",
                                value,
                            })),
                        ),
                        "Pasted",
                    )
                }
                onFill={(filled) =>
                    write(
                        repeatedFill(filled, (at) =>
                            gridRef.current?.model.get("cell-value-by", at),
                        ).map((cell) => ({
                            rowIndex: cell.rowIndex,
                            columnKey: columns[cell.columnIndex]?.key ?? "",
                            value: cell.value,
                        })),
                        "Filled",
                    )
                }
                className={styles.root}
            >
                <DataGrid.Grid aria-label="Tasks" className={styles.grid}>
                    <DataGrid.Header className={styles.header}>
                        <DataGrid.HeaderRow className={styles.headerRow}>
                            <DataGrid.HeaderCells<BudgetedTask>>
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
                                                <Resizer cell={cell} />
                                            </div>
                                        )}
                                    />
                                )}
                            </DataGrid.HeaderCells>
                        </DataGrid.HeaderRow>
                    </DataGrid.Header>
                    <DataGrid.Body>
                        <DataGrid.Rows<BudgetedTask>>
                            {(row) => (
                                <DataGrid.Row row={row} className={styles.row}>
                                    <DataGrid.Cells<BudgetedTask>>
                                        {(cell) => (
                                            <DataGrid.Cell
                                                cell={cell}
                                                className={styles.cell}
                                                // its own content (the value, or its editor
                                                // while edited), then, at the range's corner,
                                                // the fill handle
                                                render={(props) => (
                                                    <div {...props}>
                                                        {props.children}
                                                        <FillHandle
                                                            cell={cell}
                                                        />
                                                    </div>
                                                )}
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
