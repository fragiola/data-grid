// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.

import {
    type Column,
    type ColumnGroup,
    type ColumnResizerState,
    type ColumnWidths,
    DataGrid,
    type HeaderCellInfo,
    useColumnResizer,
} from "../../src";

interface Person {
    id: string;
    age: number;
}

const columns: Column<Person>[] = [
    { key: "id", width: 60, resizable: true, minWidth: 40, maxWidth: 200 },
    // @ts-expect-error: a limit is a number of pixels
    { key: "age", width: 60, resizable: true, minWidth: "40px" },
];
declare const people: Person[];

export function People({ widths }: { widths: ColumnWidths }) {
    return (
        <DataGrid.Root
            columns={columns}
            rows={people}
            columnWidths={widths}
            onColumnWidthsChange={(next) => {
                const width: number | undefined = next.id;
                void width;
            }}
        />
    );
}

export function Wrong() {
    return (
        <DataGrid.Root
            columns={columns}
            rows={people}
            // @ts-expect-error: widths are numbers, by column key
            defaultColumnWidths={{ id: "120px" }}
        />
    );
}

export function Resizer({ cell }: { cell: HeaderCellInfo<Person> }) {
    const { state, props } = useColumnResizer(cell);
    const shown: ColumnResizerState = state;
    const max: number | undefined = shown.maxWidth;
    void max;
    // @ts-expect-error: a resizer's state is read, never written
    state.width = 10;
    return <div {...props} />;
}

export const group: ColumnGroup<Person> = {
    key: "g",
    children: columns,
    // @ts-expect-error: a group is resized by its columns, it has no limits of its own
    minWidth: 100,
};
