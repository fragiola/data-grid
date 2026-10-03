// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.

import { type Column, DataGrid } from "../../src";
import { useLocalRows } from "../../src/local";

interface Person {
    name: string;
    age: number;
}

interface Order {
    total: number;
}

const columns: Column<Person>[] = [
    { key: "age", width: 60, compare: (a, b) => a.age - b.age },
];
declare const people: Person[];
declare const orders: Order[];

export function People() {
    const local = useLocalRows(people, columns, { pageSize: 20 });
    // the rows keep their type
    const first: Person | undefined = local.rows[0];
    // @ts-expect-error
    const wrong: Order | undefined = local.rows[0];
    void first;
    void wrong;
    return <DataGrid.Root columns={columns} {...local.props} />;
}

export function Mismatch() {
    // the columns and the rows share one row type
    // @ts-expect-error
    useLocalRows(orders, columns);
    const local = useLocalRows(people, columns);
    const orderColumns: Column<Order>[] = [{ key: "total", width: 60 }];
    // @ts-expect-error
    return <DataGrid.Root columns={orderColumns} {...local.props} />;
}
