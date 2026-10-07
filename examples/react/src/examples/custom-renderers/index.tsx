"use client";

import {
    type CellInfo,
    type Column,
    DataGrid,
    type HeaderCellInfo,
    headerCellContent,
    useDataGrid,
    useGridView,
} from "@fragiola/data-grid-react";
import { useLocalRows } from "@fragiola/data-grid-react/local";
import { useSelectAll } from "@fragiola/data-grid-react/selection";
import { useState } from "react";
import { type Task, tasks } from "../_kit/tasks";
import { TextEditor } from "../editing/editors";
import * as styles from "./styles";

// React Data Grid has a renderer for each piece (`renderCheckbox`, `renderSortStatus`,
// `renderCell`, `renderRow`). Here there is nothing else: the checkbox, the sort indicator, a
// cell's and a row's look are the app's markup and classes, from the parts' state and the row.

const ROWS = tasks(500);
const IDS = ROWS.map((task) => task.id);

/** A native checkbox: checked, or neither checked nor not (`indeterminate`, set on the element). */
function Checkbox({
    label,
    checked,
    indeterminate = false,
    onToggle,
}: {
    label: string;
    checked: boolean;
    indeterminate?: boolean;
    onToggle: (shiftKey: boolean) => void;
}) {
    return (
        <input
            type="checkbox"
            aria-label={label}
            checked={checked}
            ref={(element) => {
                if (element) element.indeterminate = indeterminate;
            }}
            // a checkbox's change comes from its click: Shift+click selects a range
            onChange={(event) =>
                onToggle(
                    "shiftKey" in event.nativeEvent &&
                        event.nativeEvent.shiftKey === true,
                )
            }
            className={styles.checkbox}
        />
    );
}

function SelectRow({ rowIndex, name }: { rowIndex: number; name: string }) {
    const { model } = useDataGrid<Task>();
    // the view moves with the selection: the box follows
    useGridView();
    return (
        <Checkbox
            label={`Select ${name}`}
            checked={model.is("row-selected", { rowIndex })}
            onToggle={(extend) =>
                model.run("selected-rows.toggle", { rowIndex, extend })
            }
        />
    );
}

function SelectAll() {
    const all = useSelectAll(IDS);
    return (
        <Checkbox
            label="Select all"
            checked={all.status === "all"}
            indeterminate={all.status === "some"}
            onToggle={all.toggle}
        />
    );
}

const columns: Column<Task>[] = [
    {
        key: "select",
        width: 44,
        renderHeaderCell: () => <SelectAll />,
        renderCell: ({ row, rowIndex }) => (
            <SelectRow rowIndex={rowIndex} name={row.name} />
        ),
    },
    { key: "id", name: "#", width: 64, sortable: true },
    {
        key: "name",
        name: "Title",
        width: 220,
        sortable: true,
        editable: true,
        renderEditCell: (props) => (
            <TextEditor {...props} className={styles.editor} />
        ),
    },
    { key: "priority", name: "Priority", width: 110, sortable: true },
    { key: "status", name: "Status", width: 130, sortable: true },
    { key: "assignee", name: "Assignee", width: 110, sortable: true },
    { key: "due", name: "Due", width: 120, sortable: true },
];

/** A row styled from its data: a completed task. */
const completed = (task: Task | undefined) => task?.status === "Completed";

/** A cell styled from its value: a high priority. */
const highPriority = (cell: CellInfo<Task>) =>
    cell.column.key === "priority" && cell.value === "High";

export default function CustomRenderers() {
    const [rows, setRows] = useState<readonly Task[]>(ROWS);
    const local = useLocalRows(rows, columns);
    return (
        <div className={styles.frame}>
            <DataGrid.Root
                {...local.props}
                columns={columns}
                rowKey={(row) => row.id}
                rowHeight={36}
                rowSelection="multiple"
                onCellEdit={({ row, value }) =>
                    // the app writes the title: the grid never writes a row
                    setRows((current) =>
                        current.map((task) =>
                            task.id === row.id && typeof value === "string"
                                ? { ...task, name: value.trim() || task.name }
                                : task,
                        ),
                    )
                }
                className={styles.root}
            >
                <DataGrid.Grid aria-label="Tasks" className={styles.grid}>
                    <DataGrid.Header className={styles.header}>
                        <DataGrid.HeaderRow className={styles.headerRow}>
                            <DataGrid.HeaderCells<Task>>
                                {(cell) => <HeaderCell cell={cell} />}
                            </DataGrid.HeaderCells>
                        </DataGrid.HeaderRow>
                    </DataGrid.Header>
                    <DataGrid.Body>
                        <DataGrid.Rows<Task>>
                            {(row) => (
                                <DataGrid.Row
                                    row={row}
                                    // a row styled from its data: a completed task is tinted
                                    className={(state) =>
                                        styles.row(state, completed(row.row))
                                    }
                                >
                                    <DataGrid.Cells<Task>>
                                        {(cell) => (
                                            <DataGrid.Cell
                                                cell={cell}
                                                // a cell styled from its value: a high priority
                                                // stands out
                                                className={(state) =>
                                                    styles.cell(
                                                        state,
                                                        highPriority(cell),
                                                    )
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
        </div>
    );
}

/** A header cell with the app's own sort status: a triangle, and the column's place in the sort. */
function HeaderCell({ cell }: { cell: HeaderCellInfo<Task> }) {
    const { sortColumns } = useGridView();
    return (
        <DataGrid.HeaderCell
            cell={cell}
            className={styles.headerCell}
            render={(props, state) => (
                <div {...props}>
                    {headerCellContent(cell)}
                    {state.sortDirection ? (
                        <span aria-hidden className={styles.sortStatus}>
                            {state.sortDirection === "ascending" ? "▲" : "▼"}
                            {sortColumns.length > 1 ? (
                                <span className={styles.priority}>
                                    {state.sortPriority}
                                </span>
                            ) : null}
                        </span>
                    ) : null}
                </div>
            )}
        />
    );
}
