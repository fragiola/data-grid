import { act, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
    type Column,
    DataGrid,
    type DataGridRef,
    type RootProps,
    type SortColumn,
    useDataGridRef,
} from "../src";

// Sorting (Epic #27): `sortable` columns, the sort controlled or not like the active position
// (S5), toggled by a click, Enter or Space on a header cell after the consumer's handlers (S4),
// shown through aria-sort and data-* (S6). The grid never orders the rows (S7).

interface Person {
    id: number;
    name: string;
    age: number;
}

const people: Person[] = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    name: `Person ${i}`,
    age: 20 + (i % 7),
}));

const columns: Column<Person>[] = [
    { key: "name", name: "Name", width: 150, sortable: true },
    { key: "age", name: "Age", width: 80, sortable: true },
    {
        key: "id",
        name: "Id",
        width: 80,
        renderHeaderCell: () => (
            <>
                Id <button type="button">menu</button>
            </>
        ),
    },
];

beforeAll(() => {
    for (const [property, size] of [
        ["clientWidth", 400],
        ["clientHeight", 235],
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

type GridProps = Pick<
    RootProps<Person>,
    | "sortColumns"
    | "defaultSortColumns"
    | "onSortColumnsChange"
    | "onClick"
    | "render"
    | "gridRef"
> & { cells?: Column<Person>[]; table?: boolean };

function Grid({ cells = columns, table, ...props }: GridProps) {
    return table ? (
        <DataGrid.Root columns={cells} rows={people} rowHeight={20} {...props}>
            <DataGrid.Grid render={<table />}>
                <DataGrid.Header render={<thead />}>
                    <DataGrid.HeaderRow render={<tr />}>
                        <DataGrid.HeaderCells<Person>>
                            {(cell) => (
                                <DataGrid.HeaderCell
                                    cell={cell}
                                    render={<th />}
                                />
                            )}
                        </DataGrid.HeaderCells>
                    </DataGrid.HeaderRow>
                </DataGrid.Header>
                <DataGrid.Body render={<tbody />} />
            </DataGrid.Grid>
        </DataGrid.Root>
    ) : (
        <DataGrid.Root columns={cells} rows={people} rowHeight={20} {...props}>
            <DataGrid.Grid>
                <DataGrid.Header />
                <DataGrid.Body />
            </DataGrid.Grid>
        </DataGrid.Root>
    );
}

function header(container: HTMLElement, columnIndex: number): HTMLElement {
    const cell = container.querySelector(
        `[data-grid-part="header-cell"][data-column-index="${columnIndex}"]`,
    );
    if (!(cell instanceof HTMLElement)) throw new Error("no header cell");
    return cell;
}

/** Each header cell's sort, as its attributes show it. */
function shown(container: HTMLElement) {
    return [0, 1, 2].map((columnIndex) => {
        const cell = header(container, columnIndex);
        return [
            cell.getAttribute("aria-sort"),
            cell.getAttribute("data-sort"),
            cell.getAttribute("data-sort-priority"),
            cell.hasAttribute("data-sortable"),
        ];
    });
}

describe("uncontrolled", () => {
    it("toggles on a click, tells the change, and shows it", () => {
        const onSortColumnsChange = vi.fn();
        const { container } = render(
            <Grid onSortColumnsChange={onSortColumnsChange} />,
        );
        expect(shown(container)).toEqual([
            [null, null, null, true],
            [null, null, null, true],
            [null, null, null, false],
        ]);
        fireEvent.click(header(container, 0));
        expect(onSortColumnsChange).toHaveBeenLastCalledWith([
            { columnKey: "name", direction: "ascending" },
        ]);
        expect(shown(container)[0]).toEqual([
            "ascending",
            "ascending",
            "1",
            true,
        ]);
        fireEvent.click(header(container, 0));
        expect(shown(container)[0]).toEqual([
            "descending",
            "descending",
            "1",
            true,
        ]);
    });

    it("adds a column with Ctrl, aria-sort staying on the first one", () => {
        const { container } = render(
            <Grid
                defaultSortColumns={[
                    { columnKey: "age", direction: "descending" },
                ]}
            />,
        );
        fireEvent.click(header(container, 0), { ctrlKey: true });
        expect(shown(container)).toEqual([
            [null, "ascending", "2", true],
            ["descending", "descending", "1", true],
            [null, null, null, false],
        ]);
    });

    it("toggles on Enter and Space on the active header cell", () => {
        const { container } = render(<Grid />);
        const name = header(container, 0);
        act(() => name.focus());
        fireEvent.keyDown(name, { key: "Enter" });
        expect(shown(container)[0]?.[1]).toBe("ascending");
        fireEvent.keyDown(name, { key: " " });
        expect(shown(container)[0]?.[1]).toBe("descending");
    });

    it("tells the app when its starting sort names a column that is not sortable", () => {
        const onSortColumnsChange = vi.fn();
        render(
            <Grid
                defaultSortColumns={[
                    { columnKey: "id", direction: "ascending" },
                    { columnKey: "age", direction: "descending" },
                ]}
                onSortColumnsChange={onSortColumnsChange}
            />,
        );
        expect(onSortColumnsChange).toHaveBeenCalledTimes(1);
        expect(onSortColumnsChange).toHaveBeenCalledWith([
            { columnKey: "age", direction: "descending" },
        ]);
    });

    it("leaves a control inside a header cell its own clicks", () => {
        const onSortColumnsChange = vi.fn();
        const { container } = render(
            <Grid
                cells={[
                    {
                        key: "name",
                        width: 150,
                        sortable: true,
                        renderHeaderCell: () => (
                            <>
                                Name <button type="button">menu</button>
                            </>
                        ),
                    },
                ]}
                onSortColumnsChange={onSortColumnsChange}
            />,
        );
        const button = header(container, 0).querySelector("button");
        if (!button) throw new Error("no button");
        fireEvent.click(button);
        expect(onSortColumnsChange).not.toHaveBeenCalled();
    });
});

describe("controlled", () => {
    it("asks on a click, and shows the sort only when the prop follows", () => {
        const onSortColumnsChange = vi.fn();
        const { container, rerender } = render(
            <Grid sortColumns={[]} onSortColumnsChange={onSortColumnsChange} />,
        );
        fireEvent.click(header(container, 1));
        expect(onSortColumnsChange).toHaveBeenCalledWith([
            { columnKey: "age", direction: "ascending" },
        ]);
        expect(shown(container)[1]?.[1]).toBeNull();
        rerender(
            <Grid
                sortColumns={[{ columnKey: "age", direction: "ascending" }]}
                onSortColumnsChange={onSortColumnsChange}
            />,
        );
        expect(shown(container)[1]?.[1]).toBe("ascending");
        expect(onSortColumnsChange).toHaveBeenCalledTimes(1);
    });

    it("works with a parent that follows", () => {
        function Parent() {
            const [sortColumns, setSortColumns] = useState<
                readonly SortColumn[]
            >([]);
            return (
                <Grid
                    sortColumns={sortColumns}
                    onSortColumnsChange={setSortColumns}
                />
            );
        }
        const { container } = render(<Parent />);
        fireEvent.click(header(container, 0));
        fireEvent.click(header(container, 1), { metaKey: true });
        expect(shown(container)).toEqual([
            ["ascending", "ascending", "1", true],
            [null, "ascending", "2", true],
            [null, null, null, false],
        ]);
    });

    it("keeps what it can of a prop naming a column that is not sortable, at mount or later", () => {
        const onSortColumnsChange = vi.fn();
        const mixed: SortColumn[] = [
            { columnKey: "name", direction: "ascending" },
            { columnKey: "id", direction: "ascending" },
        ];
        const { container, rerender } = render(
            <Grid sortColumns={[]} onSortColumnsChange={onSortColumnsChange} />,
        );
        rerender(
            <Grid
                sortColumns={mixed}
                onSortColumnsChange={onSortColumnsChange}
            />,
        );
        expect(shown(container)[0]?.[1]).toBe("ascending");
        expect(onSortColumnsChange).toHaveBeenLastCalledWith([
            { columnKey: "name", direction: "ascending" },
        ]);
    });

    it("tells the parent when the columns drop a sorted column", () => {
        const onSortColumnsChange = vi.fn();
        const sortColumns: SortColumn[] = [
            { columnKey: "name", direction: "ascending" },
            { columnKey: "age", direction: "descending" },
        ];
        const { rerender } = render(
            <Grid
                sortColumns={sortColumns}
                onSortColumnsChange={onSortColumnsChange}
            />,
        );
        expect(onSortColumnsChange).not.toHaveBeenCalled();
        rerender(
            <Grid
                cells={[
                    { key: "name", width: 150 },
                    { key: "age", width: 80, sortable: true },
                ]}
                sortColumns={sortColumns}
                onSortColumnsChange={onSortColumnsChange}
            />,
        );
        expect(onSortColumnsChange).toHaveBeenLastCalledWith([
            { columnKey: "age", direction: "descending" },
        ]);
    });
});

describe("the model", () => {
    it("drives the same state: sort-columns.set through a gridRef asks or tells", () => {
        const onSortColumnsChange = vi.fn();
        let gridRef: DataGridRef<Person> | undefined;
        function App(props: GridProps) {
            const ref = useDataGridRef<Person>();
            gridRef = ref;
            return <Grid gridRef={ref} {...props} />;
        }
        const set = () =>
            act(() => {
                gridRef?.current?.model.run("sort-columns.set", {
                    sortColumns: [
                        { columnKey: "age", direction: "descending" },
                    ],
                });
            });
        const { container, rerender } = render(
            <App onSortColumnsChange={onSortColumnsChange} />,
        );
        set();
        expect(onSortColumnsChange).toHaveBeenCalledTimes(1);
        expect(shown(container)[1]?.[1]).toBe("descending");
        rerender(
            <App sortColumns={[]} onSortColumnsChange={onSortColumnsChange} />,
        );
        // controlled to none: the prop wins over what the model held
        expect(shown(container)[1]?.[1]).toBeNull();
        set();
        expect(onSortColumnsChange).toHaveBeenCalledTimes(2);
        expect(shown(container)[1]?.[1]).toBeNull();
    });
});

describe("cancelling", () => {
    it("a consumer's preventDefault on the header cell, the root or its render element cancels", () => {
        const onSortColumnsChange = vi.fn();
        const prevent = (event: { preventDefault(): void }) =>
            event.preventDefault();
        const views = [
            render(
                <Grid
                    onClick={prevent}
                    onSortColumnsChange={onSortColumnsChange}
                />,
            ),
            render(
                <Grid
                    render={
                        // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: the cells inside are the interactive elements
                        <div onClick={prevent} />
                    }
                    onSortColumnsChange={onSortColumnsChange}
                />,
            ),
        ];
        for (const { container } of views) {
            fireEvent.click(header(container, 0));
        }
        // on the header cell itself: its own onClick runs first (bubbling)
        const { container } = render(
            <DataGrid.Root
                columns={columns}
                rows={people}
                onSortColumnsChange={onSortColumnsChange}
            >
                <DataGrid.Grid>
                    <DataGrid.Header>
                        <DataGrid.HeaderRow>
                            <DataGrid.HeaderCells<Person>>
                                {(cell) => (
                                    <DataGrid.HeaderCell
                                        cell={cell}
                                        onClick={prevent}
                                    />
                                )}
                            </DataGrid.HeaderCells>
                        </DataGrid.HeaderRow>
                    </DataGrid.Header>
                </DataGrid.Grid>
            </DataGrid.Root>,
        );
        fireEvent.click(header(container, 0));
        expect(onSortColumnsChange).not.toHaveBeenCalled();
    });
});

describe("structure", () => {
    it("puts aria-sort on a th as a table", () => {
        const { container } = render(
            <Grid
                table
                defaultSortColumns={[
                    { columnKey: "name", direction: "descending" },
                ]}
            />,
        );
        const th = header(container, 0);
        expect(th.tagName).toBe("TH");
        expect(th).toHaveAttribute("aria-sort", "descending");
    });

    it("adds no attribute to a grid without sortable columns", () => {
        const { container } = render(
            <Grid
                cells={columns.map(({ sortable: _, ...column }) => column)}
            />,
        );
        const sortAttributes = [
            ...container.querySelectorAll(
                "[aria-sort], [data-sortable], [data-sort], [data-sort-priority]",
            ),
        ];
        expect(sortAttributes).toHaveLength(0);
    });
});
