import {
    type Column,
    type ColumnOrGroup,
    DataGrid,
    type DataGridContextValue,
    useDataGrid,
} from "@fragiola/data-grid-react";
import { Profiler, StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";

// The unstyled grid Playwright drives (D5): the same grid as real table elements (`table`) or as
// divs (`div`), configured by the query string, so one spec runs against both.
//
//   ?rows=1000000        the row count (rows are computed from their index, nothing is stored);
//                        0 shows the empty state
//   &columns=1000        the column count (100px each)
//   &rowHeight=32        a row's height; &variable=1 makes it vary by index (24–48px)
//   &maxScrollSize=…     the scroll scaling cap
//   &width=800&height=600 the viewport's size
//   &groups=1            column groups (two header rows): C0 spans both rows, then groups of 4
//                        and 12 columns in turn (a 12-column group is wider than the viewport)
//
// For the spec: `window.grid` is the grid's model and engine, `window.commits` counts React
// commits of the grid (a Profiler), and a button before and after the grid take Tab.

interface FixtureRow {
    index: number;
}

declare global {
    interface Window {
        grid?: DataGridContextValue<FixtureRow>;
        commits: number;
    }
}

function numberParam(params: URLSearchParams, name: string, fallback: number) {
    const value = Number(params.get(name));
    return params.has(name) && Number.isFinite(value) ? value : fallback;
}

function Expose() {
    window.grid = useDataGrid<FixtureRow>();
    return null;
}

const getRow = (index: number): FixtureRow => ({ index });

/** The columns under groups: C0 alone, then groups of 4 and 12 columns in turn. */
function grouped(columns: Column<FixtureRow>[]): ColumnOrGroup<FixtureRow>[] {
    const [first, ...rest] = columns;
    const entries: ColumnOrGroup<FixtureRow>[] = first ? [first] : [];
    for (let start = 0, group = 0; start < rest.length; group++) {
        const size = group % 2 === 0 ? 4 : 12;
        entries.push({
            key: `G${group}`,
            name: `G${group}`,
            children: rest.slice(start, start + size),
        });
        start += size;
    }
    return entries;
}

// The empty state's content, centred in it (the part's own display is structural: a block)
const EMPTY_ROW = { display: "block", height: "100%" } as const;
const EMPTY_CONTENT = {
    display: "grid",
    height: "100%",
    placeItems: "center",
} as const;

function Fixture({ kind }: { kind: "table" | "div" }) {
    const params = new URLSearchParams(location.search);
    const rowCount = numberParam(params, "rows", 1_000);
    const columnCount = numberParam(params, "columns", 20);
    const fixedHeight = numberParam(params, "rowHeight", 32);
    const variable = params.get("variable") === "1";
    const maxScrollSize = params.has("maxScrollSize")
        ? numberParam(params, "maxScrollSize", 10_000_000)
        : undefined;
    const groups = params.get("groups") === "1";
    const width = numberParam(params, "width", 800);
    const height = numberParam(params, "height", 600);

    const columns = useMemo<ColumnOrGroup<FixtureRow>[]>(() => {
        const leaves = Array.from(
            { length: columnCount },
            (_, columnIndex): Column<FixtureRow> => ({
                key: `c${columnIndex}`,
                name: `C${columnIndex}`,
                width: 100,
                getValue: (row) => `${row.index}:${columnIndex}`,
            }),
        );
        return groups ? grouped(leaves) : leaves;
    }, [columnCount, groups]);
    const rowHeight = useMemo(
        () =>
            variable ? (index: number) => 24 + ((index * 7) % 25) : fixedHeight,
        [variable, fixedHeight],
    );
    const table = kind === "table";

    return (
        <>
            <button type="button" data-testid="before">
                before
            </button>
            <Profiler
                id="grid"
                onRender={() => {
                    window.commits += 1;
                }}
            >
                <DataGrid.Root<FixtureRow>
                    columns={columns}
                    rowCount={rowCount}
                    getRow={getRow}
                    rowHeight={rowHeight}
                    maxScrollSize={maxScrollSize}
                    data-testid="viewport"
                    style={{ width, height }}
                >
                    <Expose />
                    <DataGrid.Grid
                        aria-label="Fixture"
                        render={table ? <table /> : undefined}
                    >
                        <DataGrid.Header
                            render={table ? <thead /> : undefined}
                            style={{ background: "white", zIndex: 1 }}
                        >
                            <DataGrid.HeaderRows<FixtureRow>>
                                {(row) => (
                                    <DataGrid.HeaderRow
                                        row={row}
                                        render={table ? <tr /> : undefined}
                                    >
                                        <DataGrid.HeaderCells<FixtureRow>>
                                            {(cell) => (
                                                <DataGrid.HeaderCell
                                                    cell={cell}
                                                    render={
                                                        table ? (
                                                            <th />
                                                        ) : undefined
                                                    }
                                                />
                                            )}
                                        </DataGrid.HeaderCells>
                                    </DataGrid.HeaderRow>
                                )}
                            </DataGrid.HeaderRows>
                        </DataGrid.Header>
                        <DataGrid.Body render={table ? <tbody /> : undefined}>
                            <DataGrid.Rows<FixtureRow>>
                                {(row) => (
                                    <DataGrid.Row
                                        row={row}
                                        render={table ? <tr /> : undefined}
                                    >
                                        <DataGrid.Cells<FixtureRow>>
                                            {(cell) => (
                                                <DataGrid.Cell
                                                    cell={cell}
                                                    render={
                                                        table ? (
                                                            <td />
                                                        ) : undefined
                                                    }
                                                />
                                            )}
                                        </DataGrid.Cells>
                                    </DataGrid.Row>
                                )}
                            </DataGrid.Rows>
                        </DataGrid.Body>
                        <DataGrid.Empty render={table ? <tbody /> : undefined}>
                            {table ? (
                                <tr style={EMPTY_ROW}>
                                    <td style={EMPTY_CONTENT}>No rows</td>
                                </tr>
                            ) : (
                                // biome-ignore lint/a11y/useSemanticElements lint/a11y/useFocusableInteractive: a div grid's row, the grid owns focus
                                <div role="row" style={EMPTY_ROW}>
                                    {/* biome-ignore lint/a11y/useSemanticElements lint/a11y/useFocusableInteractive: a div grid's cell, the grid owns focus */}
                                    <div role="gridcell" style={EMPTY_CONTENT}>
                                        No rows
                                    </div>
                                </div>
                            )}
                        </DataGrid.Empty>
                    </DataGrid.Grid>
                </DataGrid.Root>
            </Profiler>
            <button type="button" data-testid="after">
                after
            </button>
        </>
    );
}

export function mountGridFixture(kind: "table" | "div") {
    window.commits = 0;
    const root = document.getElementById("root");
    if (!root) throw new Error("#root is missing");
    createRoot(root).render(
        <StrictMode>
            <Fixture kind={kind} />
        </StrictMode>,
    );
}
