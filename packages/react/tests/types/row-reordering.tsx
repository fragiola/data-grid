// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.

import { moveRow } from "@fragiola/data-grid/local";
import {
    type CellInfo,
    type Column,
    DataGrid,
    type ReorderSide,
    type RowInfo,
    type RowKey,
    type RowMove,
    type RowReorder,
    useDataGrid,
    useRow,
    useRowDragHandle,
} from "../../src";
import { useLocalRows } from "../../src/local";

interface Task {
    id: string;
    title: string;
}

const columns: Column<Task>[] = [{ key: "title", width: 200 }];
declare const tasks: Task[];
declare function setTasks(tasks: readonly Task[]): void;

export function Tasks() {
    return (
        <DataGrid.Root
            columns={columns}
            rows={tasks}
            onRowMove={({ fromIndex, toIndex, rowKey }) => {
                const key: RowKey = rowKey;
                void key;
                // the app's rows, moved: the same row type
                const moved: readonly Task[] = moveRow(
                    tasks,
                    fromIndex,
                    toIndex,
                );
                setTasks(moved);
            }}
        />
    );
}

export function Wrong() {
    return (
        <DataGrid.Root
            columns={columns}
            rows={tasks}
            // @ts-expect-error: a move's indexes are numbers
            onRowMove={(move: Omit<RowMove, "toIndex"> & { toIndex: string }) =>
                move.toIndex
            }
        />
    );
}

export function Handle({ cell }: { cell: CellInfo<Task> }) {
    // a cell's info or a row's
    const { state, props } = useRowDragHandle(cell);
    const reorderable: boolean = state.reorderable;
    const dragging: boolean = state.dragging;
    void reorderable;
    void dragging;
    return <span {...props} />;
}

export function Row({ row }: { row: RowInfo<Task> }) {
    useRowDragHandle(row);
    const { state } = useRow(row);
    // undefined while the grid's rows do not move
    const dragging: boolean | undefined = state.dragging;
    const side: ReorderSide | null | undefined = state.dropTarget;
    // @ts-expect-error: not a boolean while the rows do not move
    const always: boolean = state.dragging;
    void dragging;
    void side;
    void always;
    return null;
}

export function Engine() {
    const { engine } = useDataGrid<Task>();
    const reorder: RowReorder | null = engine.get("row-reorder");
    if (reorder && reorder.targetIndex !== null) {
        const side: ReorderSide = reorder.side;
        void side;
    }
    engine.subscribe("row-move", (move) => {
        const toIndex: number = move.toIndex;
        void toIndex;
    });
    return null;
}

export function Local() {
    const local = useLocalRows(tasks, columns);
    const moved: readonly Task[] = local.moveRow({ fromIndex: 0, toIndex: 2 });
    void moved;
    return null;
}
