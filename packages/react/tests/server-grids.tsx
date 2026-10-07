import type { ReactElement } from "react";
import {
    type Column,
    type ColumnOrGroup,
    DataGrid,
    type RootProps,
    type RowMeta,
} from "../src";
import { groupKeyOf, useLocalRows } from "../src/local";
import { tags } from "./helpers";

// The grids the server-rendering tests share (Epic #89, E5.1): `server.test.tsx` renders each one
// to a string in plain Node, `hydration.test.tsx` hydrates that string in jsdom. Each one renders
// every part a page would (the header, the summary rows, the body, the empty state), as a table
// or as divs.

export interface Sale {
    id: number;
    country: string;
    city: string;
    amount: number;
}

export const sales: Sale[] = Array.from({ length: 40 }, (_, id) => ({
    id,
    country: id % 2 ? "France" : "Brazil",
    city: `City ${id}`,
    amount: id * 10,
}));

const columns: Column<Sale>[] = [
    { key: "id", name: "Id", width: 80 },
    { key: "country", name: "Country", width: 120 },
    { key: "city", name: "City", width: 120 },
    {
        key: "amount",
        name: "Amount",
        width: 100,
        renderSummaryCell: ({ position }) => `${position} total`,
    },
];

const grouped: ColumnOrGroup<Sale>[] = [
    { key: "id", name: "Id", width: 80 },
    {
        key: "place",
        name: "Place",
        children: [
            { key: "country", name: "Country", width: 120 },
            { key: "city", name: "City", width: 120 },
        ],
    },
    { key: "amount", name: "Amount", width: 100 },
];

const pinned: Column<Sale>[] = [
    { key: "id", name: "Id", width: 80, pinned: "start" },
    { key: "country", name: "Country", width: 120 },
    { key: "city", name: "City", width: 120 },
    { key: "amount", name: "Amount", width: 100, pinned: "end" },
];

/** Tree meta (Epic #87): every even row a parent, expandable, the odd one after it its child. */
const rowKey = (row: Sale) => row.id;

const treeMeta = (index: number): RowMeta =>
    index % 2
        ? { depth: 1, parentIndex: index - 1, setSize: 1, posInSet: 1 }
        : { depth: 0, expandable: true };

/** A grid's root props over the sales: its columns and rows, else these. */
type GridOptions = Omit<
    RootProps<Sale>,
    "columns" | "rows" | "rowCount" | "getRow"
> & {
    columns?: readonly ColumnOrGroup<Sale>[];
    rows?: readonly Sale[];
    table?: boolean;
};

/** A whole grid: every part, as a table or as divs. */
function Composition({
    table = false,
    columns: given = columns,
    rows = sales,
    ...root
}: GridOptions) {
    const tag = tags(table);
    const summaryRows = (
        <DataGrid.SummaryRows>
            {(row) => (
                <DataGrid.SummaryRow row={row} render={tag.row}>
                    <DataGrid.SummaryCells<Sale>>
                        {(cell) => (
                            <DataGrid.SummaryCell
                                cell={cell}
                                render={tag.cell}
                            />
                        )}
                    </DataGrid.SummaryCells>
                </DataGrid.SummaryRow>
            )}
        </DataGrid.SummaryRows>
    );
    return (
        <DataGrid.Root
            columns={given}
            rows={rows}
            rowKey={rowKey}
            rowHeight={20}
            style={{ width: 400, height: 200 }}
            {...root}
        >
            <DataGrid.Grid render={tag.grid} aria-label="Sales">
                <DataGrid.Header render={tag.header}>
                    <DataGrid.HeaderRows<Sale>>
                        {(row) => (
                            <DataGrid.HeaderRow
                                row={row}
                                render={tag.headerRow}
                            >
                                <DataGrid.HeaderCells<Sale>>
                                    {(cell) => (
                                        <DataGrid.HeaderCell
                                            cell={cell}
                                            render={tag.headerCell}
                                        />
                                    )}
                                </DataGrid.HeaderCells>
                            </DataGrid.HeaderRow>
                        )}
                    </DataGrid.HeaderRows>
                </DataGrid.Header>
                <DataGrid.Summary
                    position="top"
                    render={table ? <tbody /> : undefined}
                >
                    {summaryRows}
                </DataGrid.Summary>
                <DataGrid.Body render={tag.body}>
                    <DataGrid.Rows<Sale>>
                        {(row) => (
                            <DataGrid.Row row={row} render={tag.row}>
                                <DataGrid.Cells<Sale>>
                                    {(cell) => (
                                        <DataGrid.Cell
                                            cell={cell}
                                            render={tag.cell}
                                        />
                                    )}
                                </DataGrid.Cells>
                            </DataGrid.Row>
                        )}
                    </DataGrid.Rows>
                </DataGrid.Body>
                <DataGrid.Summary
                    position="bottom"
                    render={table ? <tfoot /> : undefined}
                >
                    {summaryRows}
                </DataGrid.Summary>
                <DataGrid.Empty render={table ? <td /> : undefined}>
                    No sales
                </DataGrid.Empty>
            </DataGrid.Grid>
        </DataGrid.Root>
    );
}

/** Row groups in memory (Epic #87): `useLocalRows` groups by country, Brazil expanded. */
function RowGroups({ table }: { table: boolean }) {
    const local = useLocalRows(sales, columns, {
        groupBy: ["country"],
        rowKey,
        defaultExpandedGroupKeys: [groupKeyOf([["country", "Brazil"]])],
    });
    return <Composition table={table} {...local.props} />;
}

/** The grids, by name: each one as a table and as divs. */
export const SERVER_GRIDS = {
    rows: (table) => <Composition table={table} />,
    "column groups": (table) => <Composition table={table} columns={grouped} />,
    "row groups": (table) => <RowGroups table={table} />,
    "tree data": (table) => <Composition table={table} getRowMeta={treeMeta} />,
    "summary rows": (table) => (
        <Composition
            table={table}
            summaryRows={{ top: 1, bottom: 1 }}
            summaryRowHeight={25}
        />
    ),
    "pinned columns": (table) => <Composition table={table} columns={pinned} />,
    "an empty grid": (table) => <Composition table={table} rows={[]} />,
    "right to left": (table) => <Composition table={table} direction="rtl" />,
    "cell selection": (table) => (
        <Composition
            table={table}
            cellSelection="range"
            defaultActivePosition={{ rowIndex: 1, columnIndex: 1 }}
            defaultSelectedRange={{
                anchor: { rowIndex: 1, columnIndex: 1 },
                focus: { rowIndex: 2, columnIndex: 2 },
            }}
        />
    ),
} satisfies Record<string, (table: boolean) => ReactElement>;
