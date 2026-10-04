"use client";

import {
    type Column,
    DataGrid,
    type RowKey,
    type RowSelection,
    useDataGrid,
    useGridView,
} from "@fragiola/data-grid-react";
import { useSelectAll } from "@fragiola/data-grid-react/selection";
import { useId, useState } from "react";
import { Checkbox } from "#/components/ui/checkbox";
import { Switch } from "#/components/ui/switch";
import { type Task, tasks } from "../_kit/tasks";
import * as styles from "./styles";

const ROWS = tasks(200);

/** A completed task cannot be selected: the grid skips it in a range and in "select all". */
const isSelectable = (task: Task) => task.status !== "Completed";

/** The rows "select all" covers: the ones that can be selected. */
const SELECTABLE_IDS = ROWS.filter(isSelectable).map((task) => task.id);

/** A row's checkbox: the grid toggles the row, a Shift+click selects since the last one. */
function SelectRow({ rowIndex, name }: { rowIndex: number; name: string }) {
    const { model } = useDataGrid<Task>();
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

/** The header's checkbox: every selectable row, some (indeterminate) or none. */
function SelectAll() {
    const all = useSelectAll(SELECTABLE_IDS);
    return (
        <Checkbox.Root
            aria-label="Select all"
            checked={all.status === "all"}
            indeterminate={all.status === "some"}
            onCheckedChange={all.toggle}
            // one row at a time: it only clears
            disabled={!all.canToggle}
        >
            <Checkbox.Indicator />
        </Checkbox.Root>
    );
}

const columns: Column<Task>[] = [
    {
        key: "select",
        width: 48,
        renderHeaderCell: () => <SelectAll />,
        renderCell: ({ row, rowIndex }) => (
            <SelectRow rowIndex={rowIndex} name={row.name} />
        ),
    },
    { key: "name", name: "Task", width: 240 },
    { key: "status", name: "Status", width: 130 },
    { key: "assignee", name: "Assignee", width: 110 },
    { key: "priority", name: "Priority", width: 100 },
    { key: "due", name: "Due", width: 120 },
];

export default function RowSelectionExample() {
    const [mode, setMode] = useState<RowSelection>("multiple");
    // the grid selects; the app keeps the keys (here, to count them)
    const [selected, setSelected] = useState<readonly RowKey[]>([]);
    const modeLabel = useId();

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <span className={styles.mode}>
                    <Switch.Root
                        aria-labelledby={modeLabel}
                        checked={mode === "single"}
                        onCheckedChange={(single) =>
                            setMode(single ? "single" : "multiple")
                        }
                    >
                        <Switch.Thumb />
                    </Switch.Root>
                    <span id={modeLabel}>One at a time</span>
                </span>
                <span>
                    <kbd className={styles.key}>Shift</kbd>+
                    <kbd className={styles.key}>Space</kbd> a row
                </span>
                {mode === "multiple" ? (
                    <>
                        <span>
                            <kbd className={styles.key}>Shift</kbd>+
                            <kbd className={styles.key}>↓</kbd> extend
                        </span>
                        <span>
                            <kbd className={styles.key}>Ctrl</kbd>+
                            <kbd className={styles.key}>A</kbd> every row
                        </span>
                    </>
                ) : null}
                <span className={styles.count} data-testid="selected-count">
                    {selected.length} selected
                </span>
            </div>
            <DataGrid.Root
                columns={columns}
                rows={ROWS}
                rowKey={(row) => row.id}
                rowHeight={40}
                rowSelection={mode}
                isRowSelectable={isSelectable}
                selectedRowKeys={selected}
                onSelectedRowKeysChange={setSelected}
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
                                <DataGrid.Row
                                    row={row}
                                    className={(state) =>
                                        styles.row(
                                            state,
                                            row.row !== undefined &&
                                                !isSelectable(row.row),
                                        )
                                    }
                                >
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
