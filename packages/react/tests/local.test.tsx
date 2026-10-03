import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Column, DataGrid, type SortColumn } from "../src";
import { type LocalRowsResult, useLocalRows } from "../src/local";

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

beforeAll(() => {
    for (const [property, size] of [
        ["clientWidth", 400],
        ["clientHeight", 400],
    ] as const) {
        Object.defineProperty(HTMLElement.prototype, property, {
            configurable: true,
            get(this: HTMLElement) {
                return this.dataset.gridPart === "root" ? size : 0;
            },
        });
    }
});

afterAll(() => {
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
    delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
});

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
    const local = useLocalRows(rows, columns, { pageSize });
    latest = local;
    return (
        <DataGrid.Root columns={columns} rowHeight={20} {...local.props}>
            <DataGrid.Grid render={table ? <table /> : undefined}>
                <DataGrid.Header render={table ? <thead /> : undefined}>
                    <DataGrid.HeaderRow render={table ? <tr /> : undefined}>
                        <DataGrid.HeaderCells<Person>>
                            {(cell) => (
                                <DataGrid.HeaderCell
                                    cell={cell}
                                    render={table ? <th /> : undefined}
                                />
                            )}
                        </DataGrid.HeaderCells>
                    </DataGrid.HeaderRow>
                </DataGrid.Header>
                <DataGrid.Body render={table ? <tbody /> : undefined}>
                    <DataGrid.Rows<Person>>
                        {(row) => (
                            <DataGrid.Row
                                row={row}
                                render={table ? <tr /> : undefined}
                            >
                                <DataGrid.Cells<Person>>
                                    {(cell) => (
                                        <DataGrid.Cell
                                            cell={cell}
                                            render={table ? <td /> : undefined}
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

function header(container: HTMLElement, columnIndex: number): HTMLElement {
    const cell = container.querySelector(
        `[data-grid-part="header-cell"][data-column-index="${columnIndex}"]`,
    );
    if (!(cell instanceof HTMLElement)) throw new Error("no header cell");
    return cell;
}

for (const table of [false, true]) {
    describe(`useLocalRows, as ${table ? "a table" : "divs"}`, () => {
        it("sorts the rows when the header is clicked, through the spread props", () => {
            const { container } = render(<People table={table} />);
            expect(names(container)).toEqual(people.map((row) => row.name));
            fireEvent.click(header(container, 0));
            expect(names(container)).toEqual([
                "Ana",
                "Bruno",
                "Carla",
                "Davi",
                "Élodie",
            ]);
            expect(header(container, 0)).toHaveAttribute(
                "aria-sort",
                "ascending",
            );
            fireEvent.click(header(container, 1));
            expect(names(container)).toEqual([
                "Davi",
                "Ana",
                "Bruno",
                "Élodie",
                "Carla",
            ]);
            fireEvent.click(header(container, 1));
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
                    <DataGrid.Root columns={columns} {...local.props}>
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
            const local = useLocalRows(people, columns);
            seen.add(local.props.onSortColumnsChange);
            return (
                <DataGrid.Root columns={columns} {...local.props}>
                    <DataGrid.Grid>
                        <DataGrid.Header />
                    </DataGrid.Grid>
                </DataGrid.Root>
            );
        }
        const { container } = render(<Watch />);
        fireEvent.click(header(container, 0));
        fireEvent.click(header(container, 1));
        expect(seen.size).toBe(1);
    });
});
