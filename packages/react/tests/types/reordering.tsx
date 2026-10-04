// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.

import {
    type Column,
    type ColumnGroup,
    type ColumnOrder,
    DataGrid,
    type HeaderCellInfo,
    type ReorderSide,
    useHeaderCell,
} from "../../src";

interface Person {
    id: string;
    age: number;
}

const columns: Column<Person>[] = [
    { key: "id", width: 60, reorderable: true },
    // @ts-expect-error: reorderable is a boolean
    { key: "age", width: 60, reorderable: "yes" },
];
declare const people: Person[];

export const group: ColumnGroup<Person> = {
    key: "g",
    children: columns,
    reorderable: true,
};

export function People({ order }: { order: ColumnOrder }) {
    return (
        <DataGrid.Root
            columns={columns}
            rows={people}
            columnOrder={order}
            onColumnOrderChange={(next) => {
                const first: string | undefined = next[0];
                void first;
                // @ts-expect-error: the order the grid gives is read, never written
                next.push("id");
            }}
        />
    );
}

export function Wrong() {
    return (
        <DataGrid.Root
            columns={columns}
            rows={people}
            // @ts-expect-error: an order lists keys
            defaultColumnOrder={[0, 1]}
        />
    );
}

export function Cell({ cell }: { cell: HeaderCellInfo<Person> }) {
    const { state } = useHeaderCell(cell);
    const reorderable: boolean = state.reorderable;
    const dragging: boolean = state.dragging;
    const side: ReorderSide | null = state.dropTarget;
    void [reorderable, dragging, side];
    // @ts-expect-error: a drop target is a side, or none
    const wrong: "left" | null = state.dropTarget;
    void wrong;
    return null;
}
