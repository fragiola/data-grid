// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.

import { h, type VNodeChild } from "vue";
import { type Column, typedDataGrid } from "../../src";

interface Person {
    name: string;
    age: number;
}

// one generic, the row type: typed parts take the app's columns and rows; renderers return vnodes
const columns: Column<Person, VNodeChild>[] = [
    { key: "name", width: 100, renderCell: ({ row }) => h("b", row.name) },
    { key: "age", width: 60, getValue: (row) => row.age },
];
const people: Person[] = [{ name: "Ada", age: 36 }];
const DataGrid = typedDataGrid<Person>();

h(DataGrid.Root, { columns, rows: people });
h(DataGrid.Root, { columns, rowCount: 10, getRow: (index) => people[index] });

// @ts-expect-error rows of another type
h(DataGrid.Root, { columns, rows: [{ title: "x" }] });

const wrong: Column<{ title: string }, VNodeChild>[] = [
    { key: "title", width: 10 },
];
// @ts-expect-error columns of another row type
h(DataGrid.Root, { columns: wrong, rows: people });
