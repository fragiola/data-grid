// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.

import {
    type Column,
    DataGrid,
    type DataGridRef,
    useDataGrid,
    useDataGridRef,
} from "../../src";

interface Person {
    name: string;
}

interface Order {
    total: number;
}

const columns: Column<Person>[] = [{ key: "name", width: 100 }];
declare const people: Person[];
declare const personRef: DataGridRef<Person>;
declare const orderRef: DataGridRef<Order>;

// the ref carries the row type into the model
export function Reader() {
    const gridRef = useDataGridRef<Person>();
    const grid = useDataGrid(gridRef);
    const row: Person | undefined = grid?.model.get("row-by", { index: 0 });
    // @ts-expect-error
    const wrong: Order | undefined = grid?.model.get("row-by", { index: 0 });
    // `current` is null while no root holds it
    // @ts-expect-error
    gridRef.current.model.run("rows.changed");
    gridRef.current?.model.run("rows.changed", { start: 0, end: 10 });
    void row;
    void wrong;
    return null;
}

export const fits = (
    <DataGrid.Root columns={columns} rows={people} gridRef={personRef} />
);

// a ref of another row type does not fit the root
export const misfits = (
    // @ts-expect-error
    <DataGrid.Root columns={columns} rows={people} gridRef={orderRef} />
);
