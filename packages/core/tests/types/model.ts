// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.

import {
    type Column,
    type ColumnGroup,
    type ColumnOrGroup,
    createDataGridEngine,
    createDataGridModel,
} from "../../src";
import { columnGroupCollapse } from "../../src/column-group-collapse";
import { columnPinning } from "../../src/column-pinning";
import { columnReorder } from "../../src/column-reorder";
import { columnResize } from "../../src/column-resize";
import { navigation } from "../../src/navigation";
import { rowExpansion } from "../../src/row-expansion";

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
// the column features (Epic #148): their keys type with them installed only
const columnGrid = createDataGridModel({
    columns,
    rows: [] as Person[],
    features: [
        columnResize(),
        columnReorder(),
        columnPinning(),
        columnGroupCollapse(),
    ],
});
// @ts-expect-error
grid.run("column-order.reset");
// @ts-expect-error
grid.run("column-widths.reset", {});
// @ts-expect-error
grid.get("collapsed-group-keys");
// @ts-expect-error
grid.is("group-collapsed", { groupKey: "g" });
// @ts-expect-error
grid.get("pinned-column-keys");
const pinnedKeys: { readonly start: readonly string[] } =
    columnGrid.get("pinned-column-keys");
void pinnedKeys;
// the active position's commands are navigation's (Epic #144)
const navigated = createDataGridModel({
    columns,
    rows: [] as Person[],
    features: [navigation()],
});

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
navigated.run("active-position.set", { rowIndex: 1 });
// @ts-expect-error
navigated.run("active-position.move", { direction: "sideways" });
// @ts-expect-error
grid.run("columns.set", { columns: [{ key: "x" }] });
navigated.run("active-position.clear");
// without navigation, its commands do not compile
// @ts-expect-error
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
navigated.run(some);

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
navigated.use((ctx, next) => {
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
// sorting is a feature (Epic #141): its keys are typed by `features` (tests/types/features.ts)
// @ts-expect-error
grid.run("sort-columns.toggle", { columnKey: "age", multi: true });
void sortableGroup;

// a column pins at the start or at the end (Epic #85); a group is pinned by its columns
const pinnedColumn: Column<Person> = {
    key: "name",
    width: 60,
    pinned: "start",
};
const pinnedEnd: Column<Person> = { key: "age", width: 60, pinned: "end" };
const pinnedMiddle: Column<Person> = {
    key: "age",
    width: 60,
    // @ts-expect-error
    pinned: "middle",
};
// @ts-expect-error
const pinnedGroup: ColumnOrGroup<Person> = {
    key: "g",
    pinned: "start",
    children: [pinnedColumn],
};
// compare and filter receive the row type; a group has neither
const comparing: Column<Person> = {
    key: "age",
    width: 60,
    compare: (a, b) => a.age - b.age,
    filter: (value, filterValue, row) => row.age > 0 && value === filterValue,
};
const wrongCompare: Column<Person> = {
    key: "total",
    width: 60,
    // @ts-expect-error
    compare: (a: Order, b: Order) => a.total - b.total,
};
// @ts-expect-error
const comparingGroup: ColumnOrGroup<Person> = {
    key: "g",
    compare: () => 0,
    children: [comparing],
};
void wrongCompare;
void comparingGroup;
void pinnedEnd;
void pinnedMiddle;
void pinnedGroup;

// a row toggles by its index or by its key, never both; a detail's height is a function of the row
// (row expansion's keys, Epic #151: they do not compile without it)
// @ts-expect-error
grid.run("expanded-rows.toggle", { rowIndex: 0 });
const expanding = createDataGridModel({
    columns,
    rows: [] as Person[],
    features: [rowExpansion()],
    detailHeight: (row: Person) => row.name.length,
});
expanding.run("expanded-rows.toggle", { rowIndex: 0 });
expanding.run("expanded-rows.toggle", { rowKey: "a" });
// @ts-expect-error
expanding.run("expanded-rows.toggle", { rowIndex: 0, rowKey: "a" });
// @ts-expect-error
expanding.run("expanded-rows.set", { rowKeys: [true] });
grid.run("sizes.set", { detailHeight: (row: Person) => row.name.length });
// @ts-expect-error
grid.run("sizes.set", { detailHeight: (row: Order) => row.total });
const expandedKeys: readonly (string | number)[] =
    expanding.get("expanded-row-keys");
void expandedKeys;

// a column or a group moves before or after a sibling; the order is keys; a reset takes none
columnGrid.run("column-order.move", {
    columnKey: "name",
    targetKey: "id",
    side: "before",
});
// @ts-expect-error
columnGrid.run("column-order.move", { columnKey: "name", targetKey: "id" });
columnGrid.run("column-order.move", {
    columnKey: "name",
    targetKey: "id",
    // @ts-expect-error
    side: "beside",
});
// @ts-expect-error
columnGrid.run("column-order.set", { columnOrder: [1] });
columnGrid.run("column-order.reset");
const columnOrder: readonly string[] = columnGrid.get("column-order");
void columnOrder;
const reorderableGroup: ColumnOrGroup<Person> = {
    key: "g",
    reorderable: true,
    children: [{ key: "name", width: 80, reorderable: true }],
};
void reorderableGroup;

// a column flexes or fits itself (Epic #80); a group does neither
const flexColumn: Column<Person> = {
    key: "name",
    width: 80,
    flex: 1,
    autoSize: true,
};
void flexColumn;
// @ts-expect-error
const flexGroup: ColumnOrGroup<Person> = {
    key: "g",
    flex: 1,
    children: [{ key: "name", width: 80 }],
};
void flexGroup;
columnGrid.run("column-widths.resize", {
    columnKey: "name",
    width: 120,
    autoWidths: { name: 100 },
});

// the engine's widths are a read of their own (Epic #80)
const engine = createDataGridEngine(grid);
// @ts-expect-error
engine.get("column-auto-widths", { columnKey: "name" });
const autoWidths: Readonly<Record<string, number>> =
    engine.get("column-auto-widths");
void autoWidths;
engine.run("fit-columns", {});
engine.run("fit-columns", { columnKeys: ["name"] });
// @ts-expect-error
engine.run("fit-columns", { columnKeys: "name" });

// a column's span (Epic #85): the row is there only for a row's cell, typed by the row type
const spanning: Column<Person> = {
    key: "name",
    width: 100,
    colSpan: (args) => (args.type === "row" ? args.row.age : undefined),
};
void spanning;
const untyped: Column<Person> = {
    key: "name",
    width: 100,
    // @ts-expect-error
    colSpan: (args) => args.row.age,
};
void untyped;
// @ts-expect-error
const spanningGroup: ColumnOrGroup<Person> = {
    key: "g",
    colSpan: () => 2,
    children: [{ key: "name", width: 80 }],
};
void spanningGroup;

// collapsible groups (Epic #85, E1.3): a group collapses, a child shows in a state
const collapsible: ColumnOrGroup<Person> = {
    key: "g",
    collapsible: true,
    children: [
        { key: "name", width: 80 },
        { key: "age", width: 80, groupShow: "expanded" },
    ],
};
void collapsible;
const collapsingColumn: Column<Person> = {
    key: "a",
    width: 1,
    // @ts-expect-error: a column does not collapse
    collapsible: true,
};
void collapsingColumn;
// @ts-expect-error
const wrongShow: Column<Person> = { key: "a", width: 1, groupShow: "open" };
void wrongShow;
const collapsed: readonly string[] = columnGrid.get("collapsed-group-keys");
void collapsed;
columnGrid.run("column-groups.toggle", { groupKey: "g" });
columnGrid.run("column-groups.set", { groupKeys: ["g"] });
// @ts-expect-error
columnGrid.run("column-groups.toggle", { columnKey: "g" });
// @ts-expect-error
columnGrid.run("column-groups.set", { groupKeys: [1] });
const isCollapsed: boolean = columnGrid.is("group-collapsed", {
    groupKey: "g",
});
void isCollapsed;

void groupWithCells;
void groupWithWidth;
void columnWithChildren;
void badKey;
void wrongRow;
void row;
void count;
void notARow;
