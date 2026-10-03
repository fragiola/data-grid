// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.

import {
    type Column,
    type ColumnGroup,
    type ColumnOrGroup,
    createDataGridModel,
} from "../../src";

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
// rows.changed takes a range, or nothing for every row
grid.run("rows.changed");
grid.run("rows.changed", { start: 10, end: 20 });
// @ts-expect-error
grid.run("rows.changed", { start: "10" });

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

// column groups: a column inside a group still gets the row type
const grouped: ColumnOrGroup<Person>[] = [
    {
        key: "person",
        renderHeaderCell: ({ group, columnIndex, columnSpan }) =>
            `${group.key} ${columnIndex}+${columnSpan}`,
        children: [
            {
                key: "name",
                width: 100,
                renderCell: ({ row }) => row.name.toUpperCase(),
            },
            {
                key: "inner",
                children: [
                    {
                        key: "age",
                        width: 60,
                        // @ts-expect-error
                        renderCell: ({ row }: { row: Order }) => row.total,
                    },
                ],
            },
        ],
    },
];
grid.run("columns.set", { columns: grouped });

// a group has no cells of its own and no width: it spans its columns
const groupWithCells: ColumnGroup<Person> = {
    key: "g",
    children: [],
    // @ts-expect-error
    renderCell: () => "x",
};
// @ts-expect-error
const groupWithWidth: ColumnOrGroup<Person> = {
    key: "g",
    width: 10,
    children: [],
};
const columnWithChildren: Column<Person> = {
    key: "c",
    width: 10,
    // @ts-expect-error
    children: [],
};

// a column can sort the grid; a group cannot
const sortableColumn: Column<Person> = {
    key: "age",
    width: 60,
    sortable: true,
};
// @ts-expect-error
const sortableGroup: ColumnOrGroup<Person> = {
    key: "g",
    sortable: true,
    children: [sortableColumn],
};
grid.run("sort-columns.toggle", { columnKey: "age", multi: true });
grid.run("sort-columns.set", {
    // @ts-expect-error
    sortColumns: [{ columnKey: "age", direction: "up" }],
});
void sortableGroup;

// a column pins at the start; a group is pinned by its columns, and "end" is not there yet
const pinnedColumn: Column<Person> = {
    key: "name",
    width: 60,
    pinned: "start",
};
// @ts-expect-error
const pinnedEnd: Column<Person> = { key: "age", width: 60, pinned: "end" };
// @ts-expect-error
const pinnedGroup: ColumnOrGroup<Person> = {
    key: "g",
    pinned: "start",
    children: [pinnedColumn],
};
void pinnedEnd;
void pinnedGroup;

// a row toggles by its index or by its key, never both; a detail's height is a function of the row
grid.run("expanded-rows.toggle", { rowIndex: 0 });
grid.run("expanded-rows.toggle", { rowKey: "a" });
// @ts-expect-error
grid.run("expanded-rows.toggle", { rowIndex: 0, rowKey: "a" });
// @ts-expect-error
grid.run("expanded-rows.set", { rowKeys: [true] });
grid.run("sizes.set", { detailHeight: (row: Person) => row.name.length });
// @ts-expect-error
grid.run("sizes.set", { detailHeight: (row: Order) => row.total });
const expandedKeys: readonly (string | number)[] =
    grid.get("expanded-row-keys");
void expandedKeys;

void groupWithCells;
void groupWithWidth;
void columnWithChildren;
void badKey;
void wrongRow;
void row;
void count;
void notARow;
