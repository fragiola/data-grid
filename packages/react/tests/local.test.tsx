import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
    type Column,
    createDataGridRef,
    DataGrid,
    type DataGridFeature,
    type DataGridModel,
    type DataGridRef,
} from "../src";
import { filtering } from "../src/filtering";
import { type LocalRowsResult, useLocalRows } from "../src/local";
import { pagination } from "../src/pagination";
import { search } from "../src/search";
import { type SortColumn, sorting } from "../src/sorting";
import {
    FEATURES as GRID_FEATURES,
    headerAt,
    stubViewportSize,
    tags,
} from "./helpers";

const FEATURES = [sorting(), ...GRID_FEATURES] as const;

// One hook for rows in memory (Epic #47, L1): its props spread onto Root make the header sort the
// rows, and its controls filter, search and page what the grid shows.

interface Person {
    id: number;
    name: string;
    age: number;
    team: string;
}

const people: Person[] = [
    { id: 1, name: "Carla", age: 41, team: "Core" },
    { id: 2, name: "Ana", age: 29, team: "Design" },
    { id: 3, name: "Bruno", age: 35, team: "Core" },
    { id: 4, name: "Davi", age: 23, team: "Growth" },
    { id: 5, name: "Élodie", age: 35, team: "Design" },
];

const columns: Column<Person>[] = [
    { key: "name", name: "Name", width: 120, sortable: true },
    { key: "age", name: "Age", width: 80, sortable: true },
    { key: "team", name: "Team", width: 120 },
];

stubViewportSize(400, 400);

let latest: LocalRowsResult<Person> | undefined;

function People({
    rows = people,
    pageSize,
    table = false,
}: {
    rows?: Person[];
    pageSize?: number;
    table?: boolean;
}) {
    const local = useLocalRows(rows, columns, { features: FEATURES, pageSize });
    latest = local;
    const tag = tags(table);
    return (
        <DataGrid.Root
            columns={columns}
            rowHeight={20}
            features={FEATURES}
            {...local.props}
        >
            <DataGrid.Grid render={tag.grid}>
                <DataGrid.Header render={tag.header}>
                    <DataGrid.HeaderRow render={tag.headerRow}>
                        <DataGrid.HeaderCells<Person>>
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
                    <DataGrid.Rows<Person>>
                        {(row) => (
                            <DataGrid.Row row={row} render={tag.row}>
                                <DataGrid.Cells<Person>>
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

/** The names the grid renders, in order. */
function names(container: HTMLElement): string[] {
    return [
        ...container.querySelectorAll(
            '[data-grid-part="cell"][data-column-index="0"]',
        ),
    ].map((cell) => cell.textContent ?? "");
}

for (const table of [false, true]) {
    describe(`useLocalRows, as ${table ? "a table" : "divs"}`, () => {
        it("sorts the rows when the header is clicked, through the spread props", () => {
            const { container } = render(<People table={table} />);
            expect(names(container)).toEqual(people.map((row) => row.name));
            fireEvent.click(headerAt(container, 0));
            expect(names(container)).toEqual([
                "Ana",
                "Bruno",
                "Carla",
                "Davi",
                "Élodie",
            ]);
            expect(headerAt(container, 0)).toHaveAttribute(
                "aria-sort",
                "ascending",
            );
            fireEvent.click(headerAt(container, 1));
            expect(names(container)).toEqual([
                "Davi",
                "Ana",
                "Bruno",
                "Élodie",
                "Carla",
            ]);
            fireEvent.click(headerAt(container, 1));
            expect(names(container)[0]).toBe("Carla");
            expect(latest?.sort.columns).toEqual([
                { columnKey: "age", direction: "descending" },
            ]);
        });

        it("filters, searches and pages what the grid shows, back to the first page on a filter", () => {
            const { container } = render(<People table={table} pageSize={2} />);
            expect(names(container)).toEqual(["Carla", "Ana"]);
            expect(latest?.page).toMatchObject({
                index: 0,
                count: 3,
                canNext: true,
            });
            act(() => latest?.page.next());
            expect(names(container)).toEqual(["Bruno", "Davi"]);
            act(() => latest?.page.last());
            expect(names(container)).toEqual(["Élodie"]);
            expect(latest?.page.canNext).toBe(false);
            act(() => latest?.filter.set("team", ["Core", "Design"]));
            expect(latest?.page.index).toBe(0);
            expect(latest?.filteredCount).toBe(4);
            expect(names(container)).toEqual(["Carla", "Ana"]);
            act(() => latest?.filter.setSearch("elo"));
            expect(names(container)).toEqual(["Élodie"]);
            expect(latest).toMatchObject({ total: 5, filteredCount: 1 });
            act(() => {
                latest?.filter.clear();
                latest?.filter.setSearch("");
                latest?.page.setSize(undefined);
            });
            expect(names(container)).toHaveLength(5);
        });
    });
}

describe("useLocalRows across renders", () => {
    it("keeps the sort, the filters and the page (inside the pages left) when the rows change", () => {
        function Deleting() {
            const [rows, setRows] = useState(people);
            const local = useLocalRows(rows, columns, {
                features: FEATURES,
                pageSize: 2,
                defaultSortColumns: [
                    { columnKey: "name", direction: "ascending" },
                ],
            });
            latest = local;
            return (
                <>
                    <button
                        type="button"
                        onClick={() => setRows((r) => r.slice(0, 3))}
                    >
                        delete
                    </button>
                    <button type="button" onClick={() => setRows(people)}>
                        restore
                    </button>
                    <DataGrid.Root
                        columns={columns}
                        features={FEATURES}
                        {...local.props}
                    >
                        <DataGrid.Grid>
                            <DataGrid.Body />
                        </DataGrid.Grid>
                    </DataGrid.Root>
                </>
            );
        }
        const { container } = render(<Deleting />);
        act(() => latest?.page.last());
        expect(names(container)).toEqual(["Élodie"]);
        fireEvent.click(screen.getByText("delete"));
        // Carla, Ana, Bruno left: sorted, on the last page there is
        expect(latest?.page).toMatchObject({ index: 1, count: 2 });
        expect(names(container)).toEqual(["Carla"]);
        // the page shown is the page: rows growing back leave the view there
        fireEvent.click(screen.getByText("restore"));
        expect(latest?.page).toMatchObject({ index: 1, count: 3 });
        expect(latest?.sort.columns).toEqual([
            { columnKey: "name", direction: "ascending" },
        ]);
    });

    it("follows a new pageSize", () => {
        const { container, rerender } = render(<People pageSize={2} />);
        expect(names(container)).toHaveLength(2);
        rerender(<People pageSize={4} />);
        expect(latest?.page).toMatchObject({ size: 4, count: 2 });
        expect(names(container)).toHaveLength(4);
    });

    it("hands the grid the same onSortColumnsChange on every render", () => {
        const seen = new Set<(sortColumns: readonly SortColumn[]) => void>();
        function Watch() {
            const local = useLocalRows(people, columns, { features: FEATURES });
            seen.add(local.props.onSortColumnsChange);
            return (
                <DataGrid.Root
                    columns={columns}
                    features={FEATURES}
                    {...local.props}
                >
                    <DataGrid.Grid>
                        <DataGrid.Header />
                    </DataGrid.Grid>
                </DataGrid.Root>
            );
        }
        const { container } = render(<Watch />);
        fireEvent.click(headerAt(container, 0));
        fireEvent.click(headerAt(container, 1));
        expect(seen.size).toBe(1);
    });
});

describe("useLocalRows over the features (Epic #153)", () => {
    function Model({
        features,
        gridRef,
        renders,
    }: {
        features: readonly DataGridFeature[];
        gridRef?: DataGridRef<Person>;
        renders?: { count: number };
    }) {
        const local = useLocalRows(people, columns, {
            features,
            pageSize: 2,
            defaultFilters: { team: "Core" },
        });
        latest = local as LocalRowsResult<Person>;
        if (renders) renders.count += 1;
        return (
            <DataGrid.Root
                columns={columns}
                features={features}
                gridRef={gridRef}
                {...local.props}
            >
                <DataGrid.Grid>
                    <DataGrid.Body>
                        <DataGrid.Rows<Person>>
                            {(row) => (
                                <DataGrid.Row row={row}>
                                    <DataGrid.Cells<Person>>
                                        {(cell) => (
                                            <DataGrid.Cell cell={cell} />
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

    it("skips the stages of the features not installed, and hands no prop of theirs", () => {
        const { container } = render(<Model features={[sorting()]} />);
        // no filter, no page: every row, the filters kept
        expect(names(container)).toEqual(people.map((row) => row.name));
        expect(latest?.filter.values).toEqual({ team: "Core" });
        expect(Object.keys(latest?.props ?? {}).sort()).toEqual([
            "onSortColumnsChange",
            "rows",
            "sortColumns",
        ]);
    });

    it("hands the root's model the state, and takes a command run on it back, in one render", () => {
        const gridRef = createDataGridRef<Person>();
        const renders = { count: 0 };
        const features = [sorting(), filtering(), search(), pagination()];
        const { container } = render(
            <Model features={features} gridRef={gridRef} renders={renders} />,
        );
        expect(names(container)).toEqual(["Carla", "Bruno"]);
        const model = gridRef.current?.model as DataGridModel<
            Person,
            unknown,
            typeof features
        >;
        expect(model.get("column-filters")).toEqual({ team: "Core" });
        expect(model.get("page-info")).toMatchObject({
            pageIndex: 0,
            pageSize: 2,
            pageCount: 1,
            rowCount: 2,
        });
        const before = renders.count;
        act(() => {
            model.run("column-filters.clear", undefined);
        });
        expect(renders.count - before).toBe(1);
        expect(names(container)).toEqual(["Carla", "Ana"]);
        expect(model.get("page-count")).toBe(3);
        act(() => {
            model.run("page.set", { pageIndex: 2 });
        });
        expect(names(container)).toEqual(["Élodie"]);
        expect(latest?.page.index).toBe(2);
        act(() => {
            model.run("search.set", { text: "an" });
        });
        // the search goes back to the first page
        expect(names(container)).toEqual(["Ana"]);
        expect(model.get("page-info").pageIndex).toBe(0);
        act(() => latest?.filter.set("team", "Design"));
        expect(model.get("column-filters")).toEqual({ team: "Design" });
    });
});
