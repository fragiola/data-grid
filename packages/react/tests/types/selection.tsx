// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.

import { type Column, DataGrid, type RowKey } from "../../src";
import { type SelectAll, useSelectAll } from "../../src/selection";

interface Person {
    id: string;
    locked: boolean;
}

const columns: Column<Person>[] = [{ key: "id", width: 60 }];
declare const people: Person[];

export function People({ keys }: { keys: readonly RowKey[] }) {
    return (
        <DataGrid.Root
            columns={columns}
            rows={people}
            rowSelection="multiple"
            // the row keeps its type
            isRowSelectable={(row) => !row.locked}
            selectedRowKeys={keys}
            onSelectedRowKeysChange={(next) => {
                const first: RowKey | undefined = next[0];
                void first;
            }}
        />
    );
}

export function Wrong() {
    return (
        <DataGrid.Root
            columns={columns}
            rows={people}
            // @ts-expect-error: not a mode
            rowSelection="many"
        />
    );
}

export function Header() {
    const all: SelectAll = useSelectAll(people.map((person) => person.id));
    // @ts-expect-error: a status is all, some or none
    const wrong: typeof all.status = "half";
    void wrong;
    return null;
}
