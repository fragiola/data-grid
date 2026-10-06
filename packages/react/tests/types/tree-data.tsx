// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.

import { type Column, DataGrid } from "../../src";
import { useLocalRows } from "../../src/local";

interface Folder {
    name: string;
    items?: Folder[];
}

interface Order {
    total: number;
}

const columns: Column<Folder>[] = [{ key: "name", width: 200 }];
declare const folders: Folder[];
declare const orders: Order[];

export function Tree() {
    const local = useLocalRows(folders, columns, {
        // the rows under a row are rows of the type
        getSubRows: (folder) => folder.items,
        rowKey: (folder) => folder.name,
    });
    const keys: readonly (string | number)[] = local.group.subRowKeysOf(0);
    void keys;
    return <DataGrid.Root columns={columns} {...local.props} />;
}

export function WrongSubRows() {
    // the rows under a row are rows of the type
    // @ts-expect-error
    useLocalRows(folders, columns, { getSubRows: () => orders });
}
