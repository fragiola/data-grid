// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.

import {
    type CellInfo,
    type Column,
    DataGrid,
    type GroupRow,
    type RowMeta,
    type RowMetaGetter,
    useGroupToggle,
} from "../../src";
import { groupKeyOf, useLocalRows } from "../../src/local";

interface Sale {
    country: string;
    amount: number;
}

interface Order {
    total: number;
}

const columns: Column<Sale>[] = [
    {
        key: "amount",
        width: 80,
        // a group row's cell: its group and the value, never a row of the type
        renderGroupCell: ({ group, value }) =>
            `${String(group.key)}: ${String(value)}`,
        colSpan: (args) => (args.type === "group" ? args.group.depth + 1 : 1),
    },
];
declare const sales: Sale[];

export function Grouped() {
    const local = useLocalRows(sales, columns, {
        groupBy: ["country"],
        // the aggregates read the rows of the type
        aggregates: {
            amount: (rows) => rows.reduce((t, r) => t + r.amount, 0),
        },
        rowKey: (row) => row.country,
        defaultExpandedGroupKeys: [groupKeyOf([["country", "France"]])],
    });
    // the data rows keep their type
    const first: Sale | undefined = local.rows[0];
    void first;
    return <DataGrid.Root columns={columns} {...local.props} />;
}

export function WrongAggregates() {
    // an aggregate reads the rows of the type
    // @ts-expect-error
    useLocalRows(sales, columns, {
        groupBy: ["country"],
        aggregates: { amount: (rows: readonly Order[]) => rows.length },
    });
}

/** A server's flattened rows, as the root takes them: one generic, the row type. */
export function Served({
    rowCount,
    getRow,
    getRowMeta,
}: {
    rowCount: number;
    getRow: (index: number) => Sale | undefined;
    getRowMeta: (index: number) => RowMeta | undefined;
}) {
    const group: GroupRow = {
        key: "g",
        columnKey: "country",
        value: "France",
        depth: 0,
        childCount: 2,
        aggregates: {},
    };
    void group;
    return (
        <DataGrid.Root
            columns={columns}
            rowCount={rowCount}
            getRow={getRow}
            getRowMeta={getRowMeta}
            defaultExpandedGroupKeys={["g"]}
            onExpandedGroupKeysChange={(keys) => keys.length}
        />
    );
}

export function Toggle({ cell }: { cell: CellInfo<Sale> }) {
    const { state, props } = useGroupToggle(cell);
    const expanded: boolean = state.expanded;
    // @ts-expect-error: a row's group is no row
    const row: Sale | undefined = cell.group;
    void expanded;
    void row;
    return <button type="button" {...props} />;
}

export function NotMeta() {
    // @ts-expect-error: getRowMeta answers a kind of row, not a row
    const getRowMeta: RowMetaGetter = () => sales[0];
    return (
        <DataGrid.Root columns={columns} rows={sales} getRowMeta={getRowMeta} />
    );
}
