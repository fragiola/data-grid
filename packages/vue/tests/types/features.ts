// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.
// A root's props, the composables' model and the refs are typed by the installed features
// (Epic #141): a template cannot pass a type argument, so `typedDataGrid` takes them.

import { defineComponent, h, type VNodeChild } from "vue";
import {
    type Column,
    createDataGridRef,
    DataGrid,
    typedDataGrid,
    useDataGrid,
    useDataGridRef,
    useRowWindow,
} from "../../src";
import { type SortColumn, sorting } from "../../src/sorting";

interface Person {
    name: string;
}

const columns: Column<Person, VNodeChild>[] = [
    { key: "name", width: 100, sortable: true },
];
declare const people: Person[];
const features = [sorting()] as const;

/** The props a component takes, as a template or `h` checks them. */
type PropsOf<C extends abstract new (...args: never) => { $props: object }> =
    InstanceType<C>["$props"];

// sorting's props compile only with it installed
const Bare = typedDataGrid<Person>();
export const bare: PropsOf<typeof Bare.Root> = {
    columns,
    rows: people,
    // @ts-expect-error
    sortColumns: [],
};
const Sorted = typedDataGrid<Person, typeof features>();
export const sorted: PropsOf<typeof Sorted.Root> = {
    columns,
    rows: people,
    features,
    defaultSortColumns: [{ columnKey: "name", direction: "ascending" }],
    onSortColumnsChange: (sort: readonly SortColumn[]) => sort.length,
};
h(Sorted.Root, { columns, rows: people, features, sortColumns: [] });
h(Sorted.Root, {
    columns,
    rows: people,
    features,
    // @ts-expect-error: a direction that is not one
    sortColumns: [{ columnKey: "name", direction: "up" }],
});
// @ts-expect-error: features other than the ones it is typed with
h(Bare.Root, { columns, rows: people, features });

// the untyped primitives stay loose: any features, any of their props
h(DataGrid.Root, { columns: [], rows: [], features, sortColumns: [] });

// the composables' model: a feature's keys with its features named
export const Reader = defineComponent(() => {
    const plain = useDataGrid<Person>();
    // @ts-expect-error
    plain.model.run("sort-columns.toggle", { columnKey: "name" });
    // @ts-expect-error
    plain.model.get("sort-columns");
    const typed = useDataGrid<Person, typeof features>();
    typed.model.run("sort-columns.toggle", { columnKey: "name" });
    const sort: readonly SortColumn[] = typed.model.get("sort-columns");
    void sort;
    return () => null;
});

// a ref typed by the features carries them; any ref fits a root and the composables
export const WithRef = defineComponent(() => {
    const gridRef = useDataGridRef<Person, typeof features>();
    const untyped = useDataGridRef<Person>();
    const grid = useDataGrid(gridRef);
    grid.value?.model.run("sort-columns.toggle", { columnKey: "name" });
    useDataGrid(untyped).value?.model.run(
        // @ts-expect-error
        "sort-columns.toggle",
        { columnKey: "a" },
    );
    useRowWindow(gridRef);
    return () => [
        h(Sorted.Root, { columns, rows: people, features, gridRef }),
        h(Sorted.Root, { columns, rows: people, features, gridRef: untyped }),
    ];
});
export const outside = createDataGridRef<Person, typeof features>();
