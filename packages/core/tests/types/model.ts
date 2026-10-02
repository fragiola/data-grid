// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.

import { type Column, createDataGridModel } from "../../src";

interface Person {
    name: string;
    age: number;
}

interface Order {
    total: number;
}

// one generic: the row type flows into the getters and renderers
const columns: Column<Person>[] = [
    { key: "name", width: 100, getValue: (row) => row.name.toUpperCase() },
    {
        key: "age",
        width: 60,
        renderCell: ({ row, rowIndex }) => `${row.age} (${rowIndex})`,
    },
];

const grid = createDataGridModel<Person>({ columns, rows: [] });

// a column's key is a string
// @ts-expect-error
const badKey: Column<Person> = { key: 1, width: 10 };

// a renderer receives the grid's row type, not another
const wrongRow: Column<Person> = {
    key: "total",
    width: 10,
    // @ts-expect-error
    renderCell: ({ row }: { row: Order }) => row.total,
};

// payloads are checked per command
// @ts-expect-error
grid.run("active-position.set", { rowIndex: 1 });
// @ts-expect-error
grid.run("active-position.move", { direction: "sideways" });
// @ts-expect-error
grid.run("columns.set", { columns: [{ key: "x" }] });
grid.run("active-position.clear");
grid.run("sizes.set", { rowHeight: (index) => 20 + (index % 3) });

// with a name typed as a union of commands, the payload is required
declare const some: "columns.set" | "active-position.clear";
// @ts-expect-error
grid.run(some);

// reads are typed by their key
const row: Person | undefined = grid.get("row-by", { index: 0 });
const count: number = grid.get("row-count");
// @ts-expect-error
grid.get("row-by");
// @ts-expect-error
grid.get("row-count", { index: 0 });
// @ts-expect-error
const notARow: Order | undefined = grid.get("row-by", { index: 0 });

// middleware narrows the payload by command
grid.use((ctx, next) => {
    if (ctx.command === "active-position.move") {
        const direction: string = ctx.payload.direction;
        void direction;
        // @ts-expect-error
        void ctx.payload.rowIndex;
    }
    return next();
});

void badKey;
void wrongRow;
void row;
void count;
void notARow;
