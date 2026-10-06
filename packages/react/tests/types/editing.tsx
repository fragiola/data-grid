// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.

import { useState } from "react";
import {
    type CellEditEvent,
    type Column,
    DataGrid,
    type EditingCell,
    useCellEdit,
    useDataGrid,
} from "../../src";

interface Task {
    id: string;
    title: string;
    done: boolean;
}

const columns: Column<Task>[] = [
    {
        key: "title",
        width: 200,
        // by the row: typed
        editable: (row, rowIndex) => !row.done && rowIndex >= 0,
        renderEditCell: ({
            row,
            value,
            startKey,
            onChange,
            onCommit,
            onCancel,
        }) => (
            <input
                defaultValue={startKey ?? String(value)}
                placeholder={row.title}
                onChange={(event) => onChange(event.target.value)}
                onBlur={() => onCommit()}
                onKeyDown={(event) => {
                    if (event.key === "q") onCommit("quit");
                    if (event.key === "x") onCancel();
                }}
            />
        ),
    },
    { key: "done", width: 80, editable: true },
];
declare const tasks: Task[];
declare function setTask(id: string, patch: Partial<Task>): void;

export function Tasks() {
    const [editing, setEditing] = useState<EditingCell | null>(null);
    return (
        <DataGrid.Root
            columns={columns}
            rows={tasks}
            editingCell={editing}
            onEditingCellChange={setEditing}
            onCellEdit={({ row, columnKey, value }: CellEditEvent<Task>) => {
                const id: string = row.id;
                if (columnKey === "title" && typeof value === "string") {
                    setTask(id, { title: value });
                }
            }}
        />
    );
}

export function OwnEditor({
    cell,
}: {
    cell: Parameters<typeof useCellEdit<Task>>[0];
}) {
    const edit = useCellEdit(cell);
    const title: string | undefined = edit?.row.title;
    return <span>{title}</span>;
}

export function Commands() {
    const { model, engine } = useDataGrid<Task>();
    model.run("editing-cell.set", {
        rowIndex: 0,
        columnIndex: 0,
        startKey: "a",
    });
    model.run("editing-cell.clear");
    engine.run("edit-cell", { rowIndex: 0, columnIndex: 0 });
    engine.run("change-edit", { value: "draft" });
    engine.run("commit-edit", {});
    engine.run("cancel-edit", {});
    const editable: boolean = model.is("cell-editable", {
        rowIndex: 0,
        columnIndex: 0,
    });
    // @ts-expect-error: a key that started an edit is a string
    model.run("editing-cell.set", { rowIndex: 0, columnIndex: 0, startKey: 1 });
    return editable;
}

export const wrong: Column<Task> = {
    key: "title",
    width: 100,
    // @ts-expect-error: editable by the row, as a boolean
    editable: (row: Task) => row.title,
};
