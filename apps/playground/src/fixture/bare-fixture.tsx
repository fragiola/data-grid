import { type Column, DataGrid } from "@fragiola/data-grid-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// The bare grid (Epic #141): the grid with no feature installed, nothing but the main entry. It
// renders, scrolls (both axes, scaled: 1,000,000 rows and 1,000 columns past `maxScrollSize`) and
// virtualizes as any grid; its sortable columns do not sort and carry no sort attribute. Without
// navigation (Epic #144) it is the APG table pattern: `role="table"`, `cell`, no tab stop on the
// grid nor its cells, and the arrow keys move nothing. Without the column features (Epic #148)
// its first column, pinned, resizable and reorderable, scrolls with the others and neither moves
// nor resizes. As a table (`?kind=table`) or as divs (the default). `e2e/bare.spec.ts` drives
// both.

interface BareRow {
    id: number;
}

const ROW_COUNT = 1_000_000;
const COLUMN_COUNT = 1_000;

const columns: Column<BareRow>[] = Array.from(
    { length: COLUMN_COUNT },
    (_, columnIndex) => ({
        key: `c${columnIndex}`,
        name: `C${columnIndex}`,
        width: 100,
        // without sorting installed, a sortable column is a column
        sortable: true,
        // and without the column features, so is a pinned, resizable, reorderable one
        ...(columnIndex === 0
            ? {
                  pinned: "start" as const,
                  resizable: true,
                  reorderable: true,
              }
            : {}),
        getValue: (row: BareRow) => `${row.id}:${columnIndex}`,
    }),
);

const getRow = (id: number): BareRow => ({ id });

const TABLE = {
    grid: <table />,
    header: <thead />,
    headerRow: <tr />,
    headerCell: <th />,
    body: <tbody />,
    row: <tr />,
    cell: <td />,
};

function BareGrid({ table }: { table: boolean }) {
    const tag: Partial<typeof TABLE> = table ? TABLE : {};
    return (
        <DataGrid.Root
            columns={columns}
            rowCount={ROW_COUNT}
            getRow={getRow}
            rowHeight={24}
            maxScrollSize={80_000}
            data-testid="viewport"
            style={{ width: 600, height: 400, overflow: "auto" }}
        >
            <DataGrid.Grid render={tag.grid} aria-label="Bare grid">
                <DataGrid.Header render={tag.header}>
                    <DataGrid.HeaderRow render={tag.headerRow}>
                        <DataGrid.HeaderCells<BareRow>>
                            {(cell) => (
                                <DataGrid.HeaderCell
                                    cell={cell}
                                    render={tag.headerCell}
                                />
                            )}
                        </DataGrid.HeaderCells>
                    </DataGrid.HeaderRow>
                </DataGrid.Header>
                <DataGrid.Body render={tag.body}>
                    <DataGrid.Rows<BareRow>>
                        {(row) => (
                            <DataGrid.Row row={row} render={tag.row}>
                                <DataGrid.Cells<BareRow>>
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
            </DataGrid.Grid>
        </DataGrid.Root>
    );
}

export function mountBareFixture() {
    const table = new URLSearchParams(location.search).get("kind") === "table";
    const root = document.getElementById("root");
    if (!root) throw new Error("#root is missing");
    createRoot(root).render(
        <StrictMode>
            <BareGrid table={table} />
        </StrictMode>,
    );
}
