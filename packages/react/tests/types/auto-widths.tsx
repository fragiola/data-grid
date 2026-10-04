// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.

import {
    type Column,
    type ColumnGroup,
    type ColumnWidths,
    DataGrid,
    useDataGrid,
} from "../../src";

interface Person {
    id: string;
    name: string;
}

const columns: Column<Person>[] = [
    { key: "id", width: 60, autoSize: true },
    { key: "name", width: 120, flex: 1, maxWidth: 400, resizable: true },
    // @ts-expect-error: a flex is a number of parts
    { key: "bad", width: 60, flex: "1" },
    // @ts-expect-error: autoSize is yes or no
    { key: "worse", width: 60, autoSize: "yes" },
];
declare const people: Person[];

export function People() {
    return <DataGrid.Root columns={columns} rows={people} />;
}

export function FitAll() {
    const { engine } = useDataGrid<Person>();
    const auto: ColumnWidths = engine.get("column-auto-widths");
    void auto;
    engine.run("fit-columns", {});
    engine.run("fit-columns", { columnKeys: ["name"] });
    // @ts-expect-error: the keys are a list
    engine.run("fit-columns", { columnKeys: "name" });
    return null;
}

export const group: ColumnGroup<Person> = {
    key: "g",
    children: columns,
    // @ts-expect-error: a group neither flexes nor fits itself: its columns do
    flex: 1,
};
