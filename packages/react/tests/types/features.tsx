// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.
// A root's props, the hooks' model and the refs are typed by the installed features (Epic #141).

import {
    type Column,
    createDataGridRef,
    DataGrid,
    useDataGrid,
    useDataGridRef,
    useRowWindow,
} from "../../src";
import { type SortColumn, sorting } from "../../src/sorting";

interface Person {
    name: string;
}

const columns: Column<Person>[] = [{ key: "name", width: 100, sortable: true }];
declare const people: Person[];
const features = [sorting()];

// sorting's props compile only with it installed
export const bare = (
    // @ts-expect-error
    <DataGrid.Root columns={columns} rows={people} sortColumns={[]} />
);
export const sorted = (
    <DataGrid.Root
        columns={columns}
        rows={people}
        features={features}
        defaultSortColumns={[{ columnKey: "name", direction: "ascending" }]}
        onSortColumnsChange={(sort: readonly SortColumn[]) => sort.length}
    />
);
export const inline = (
    <DataGrid.Root
        columns={columns}
        rows={people}
        features={[sorting()]}
        sortColumns={[]}
    />
);
export const wrongSort = (
    <DataGrid.Root
        columns={columns}
        rows={people}
        features={features}
        // @ts-expect-error: a direction that is not one
        sortColumns={[{ columnKey: "name", direction: "up" }]}
    />
);

// the hooks' model: a feature's keys with its features named
export function Reader() {
    const plain = useDataGrid<Person>();
    // @ts-expect-error
    plain.model.run("sort-columns.toggle", { columnKey: "name" });
    // @ts-expect-error
    plain.model.get("sort-columns");
    const typed = useDataGrid<Person, typeof features>();
    typed.model.run("sort-columns.toggle", { columnKey: "name" });
    const sort: readonly SortColumn[] = typed.model.get("sort-columns");
    void sort;
    return null;
}

// a ref typed by the features carries them; any ref fits a root and the hooks
export function WithRef() {
    const gridRef = useDataGridRef<Person, typeof features>();
    const untyped = useDataGridRef<Person>();
    const grid = useDataGrid(gridRef);
    grid?.model.run("sort-columns.toggle", { columnKey: "name" });
    // @ts-expect-error
    useDataGrid(untyped)?.model.run("sort-columns.toggle", { columnKey: "a" });
    useRowWindow(gridRef);
    return (
        <>
            <DataGrid.Root
                columns={columns}
                rows={people}
                features={features}
                gridRef={gridRef}
            />
            <DataGrid.Root
                columns={columns}
                rows={people}
                features={features}
                gridRef={untyped}
            />
        </>
    );
}
export const outside = createDataGridRef<Person, typeof features>();
