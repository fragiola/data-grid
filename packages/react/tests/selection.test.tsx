import { act, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
    type Column,
    DataGrid,
    type DataGridRef,
    type RowKey,
    type RowSelection,
    useDataGridRef,
} from "../src";
import { useLocalRows } from "../src/local";
import { useSelectAll } from "../src/selection";

// Row selection (Epic #57, R1–R8): `Root` maps the selection (controlled or not), its mode and
// `isRowSelectable` onto the model; rows carry `data-selected` and `aria-selected`, the grid
// `aria-multiselectable`, as divs or as a table; `useSelectAll` drives a "select all" control.

interface Person {
    id: string;
    locked: boolean;
}

const people: Person[] = Array.from({ length: 20 }, (_, i) => ({
    id: `p${i}`,
    locked: i === 3,
}));

const columns: Column<Person>[] = [{ key: "id", name: "Id", width: 120 }];

beforeAll(() => {
    for (const [property, size] of [
        ["clientWidth", 400],
        ["clientHeight", 300],
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

const KEYS = people.map((person) => person.id);

/** A header checkbox through useSelectAll, as an app writes it. */
function SelectAll({ gridRef }: { gridRef?: DataGridRef<Person> }) {
    const all = useSelectAll(KEYS, gridRef);
    return (
        <input
            type="checkbox"
            aria-label="Select all"
            data-status={all.status}
            data-count={all.count}
            data-can-toggle={all.canToggle ? "" : undefined}
            checked={all.status === "all"}
            onChange={all.toggle}
        />
    );
}

type GridProps = {
    table?: boolean;
    /** `null`: rows not selectable */
    rowSelection?: RowSelection | null;
    selectedRowKeys?: readonly RowKey[];
    defaultSelectedRowKeys?: readonly RowKey[];
    onSelectedRowKeysChange?: (keys: readonly RowKey[]) => void;
    isRowSelectable?: (row: Person) => boolean;
    gridRef?: DataGridRef<Person>;
    rowStates?: boolean[];
};

function Grid({
    table = false,
    rowSelection = "multiple",
    rowStates,
    ...props
}: GridProps) {
    return (
        <DataGrid.Root
            columns={columns}
            rows={people}
            rowKey={(row) => row.id}
            rowHeight={20}
            rowSelection={rowSelection ?? undefined}
            {...props}
        >
            <DataGrid.Grid render={table ? <table /> : undefined}>
                <DataGrid.Header render={table ? <thead /> : undefined}>
                    <DataGrid.HeaderRow render={table ? <tr /> : undefined}>
                        <DataGrid.HeaderCells<Person>>
                            {(cell) => (
                                <DataGrid.HeaderCell
                                    cell={cell}
                                    render={table ? <th /> : undefined}
                                >
                                    <SelectAll />
                                </DataGrid.HeaderCell>
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
                                className={(state) => {
                                    if (row.rowIndex === 1) {
                                        rowStates?.push(state.selected);
                                    }
                                    return undefined;
                                }}
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

function rowAt(container: HTMLElement, rowIndex: number) {
    const element = container.querySelector(
        `[data-grid-part="row"][data-row-index="${rowIndex}"]`,
    );
    if (!(element instanceof HTMLElement)) throw new Error("no row");
    return element;
}

function cellAt(container: HTMLElement, rowIndex: number) {
    const element = container.querySelector(
        `[data-grid-part="cell"][data-row-index="${rowIndex}"][data-column-index="0"]`,
    );
    if (!(element instanceof HTMLElement)) throw new Error("no cell");
    return element;
}

const shiftSpace = (target: HTMLElement) =>
    fireEvent.keyDown(target, { key: " ", shiftKey: true });

for (const table of [false, true]) {
    describe(`selected rows, as ${table ? "a table" : "divs"}`, () => {
        it("carry data-selected and aria-selected, the grid aria-multiselectable", () => {
            const { container } = render(
                <Grid table={table} defaultSelectedRowKeys={["p1"]} />,
            );
            const grid = container.querySelector('[data-grid-part="grid"]');
            expect(grid).toHaveAttribute("aria-multiselectable", "true");
            expect(rowAt(container, 1)).toHaveAttribute("data-selected", "");
            expect(rowAt(container, 1)).toHaveAttribute(
                "aria-selected",
                "true",
            );
            expect(rowAt(container, 2)).not.toHaveAttribute("data-selected");
            expect(rowAt(container, 2)).toHaveAttribute(
                "aria-selected",
                "false",
            );
        });

        it("toggle on Shift+Space, uncontrolled, telling the app", () => {
            const onChange = vi.fn();
            const { container } = render(
                <Grid table={table} onSelectedRowKeysChange={onChange} />,
            );
            const cell = cellAt(container, 2);
            act(() => cell.focus());
            shiftSpace(cell);
            expect(onChange).toHaveBeenLastCalledWith(["p2"]);
            expect(rowAt(container, 2)).toHaveAttribute("data-selected", "");
        });
    });
}

describe("controlled selection", () => {
    it("follows the keys, asks for a toggle, and keeps the anchor for a range", () => {
        function Controlled() {
            const [keys, setKeys] = useState<readonly RowKey[]>([]);
            return (
                <Grid
                    selectedRowKeys={keys}
                    onSelectedRowKeysChange={setKeys}
                />
            );
        }
        const { container } = render(<Controlled />);
        const start = cellAt(container, 2);
        act(() => start.focus());
        shiftSpace(start);
        expect(rowAt(container, 2)).toHaveAttribute("data-selected", "");
        // the parent answered the toggle: the anchor is still row 2
        const cell = cellAt(container, 2);
        fireEvent.keyDown(cell, { key: "ArrowDown", shiftKey: true });
        fireEvent.keyDown(cellAt(container, 3), {
            key: "ArrowDown",
            shiftKey: true,
        });
        for (const index of [2, 3, 4]) {
            expect(rowAt(container, index)).toHaveAttribute(
                "data-selected",
                "",
            );
        }
    });

    it("keeps a Shift+click's anchor without one before, as uncontrolled", () => {
        let run: ((rowIndex: number, extend: boolean) => void) | undefined;
        function Controlled() {
            const [keys, setKeys] = useState<readonly RowKey[]>([]);
            const gridRef = useDataGridRef<Person>();
            run = (rowIndex, extend) =>
                gridRef.current?.model.run("selected-rows.toggle", {
                    rowIndex,
                    extend,
                });
            return (
                <Grid
                    gridRef={gridRef}
                    selectedRowKeys={keys}
                    onSelectedRowKeysChange={setKeys}
                />
            );
        }
        const { container } = render(<Controlled />);
        act(() => run?.(1, true));
        act(() => run?.(4, true));
        for (const index of [1, 2, 3, 4]) {
            expect(rowAt(container, index)).toHaveAttribute(
                "data-selected",
                "",
            );
        }
    });

    it("selects nothing the parent does not follow", () => {
        const onChange = vi.fn();
        const { container } = render(
            <Grid selectedRowKeys={[]} onSelectedRowKeysChange={onChange} />,
        );
        const cell = cellAt(container, 2);
        act(() => cell.focus());
        shiftSpace(cell);
        expect(onChange).toHaveBeenCalledWith(["p2"]);
        expect(rowAt(container, 2)).not.toHaveAttribute("data-selected");
    });
});

describe("modes and rows that cannot be selected", () => {
    it("single mode: no aria-multiselectable, one row at a time, the trimmed default told", () => {
        const onChange = vi.fn();
        const { container } = render(
            <Grid
                onSelectedRowKeysChange={onChange}
                rowSelection="single"
                defaultSelectedRowKeys={["p1", "p2"]}
            />,
        );
        expect(onChange).toHaveBeenCalledWith(["p2"]);
        const grid = container.querySelector('[data-grid-part="grid"]');
        expect(grid).not.toHaveAttribute("aria-multiselectable");
        expect(rowAt(container, 1)).not.toHaveAttribute("data-selected");
        expect(rowAt(container, 2)).toHaveAttribute("data-selected", "");
    });

    it("a row isRowSelectable refuses carries no aria-selected", () => {
        const { container } = render(
            <Grid isRowSelectable={(row) => !row.locked} />,
        );
        expect(rowAt(container, 3)).not.toHaveAttribute("aria-selected");
        expect(rowAt(container, 4)).toHaveAttribute("aria-selected", "false");
    });

    it("without rowSelection, rows carry nothing and Shift+Space is not the grid's", () => {
        function Plain() {
            return (
                <DataGrid.Root columns={columns} rows={people} rowHeight={20}>
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
        const { container } = render(<Plain />);
        expect(
            container.querySelectorAll("[aria-selected], [data-selected]"),
        ).toHaveLength(0);
        expect(container.querySelector("[aria-multiselectable]")).toBeNull();
        const cell = cellAt(container, 1);
        act(() => cell.focus());
        expect(shiftSpace(cell)).toBe(true);
    });

    it("turns off and on with the prop, the keys kept meanwhile", () => {
        const { container, rerender } = render(
            <Grid defaultSelectedRowKeys={["p1"]} />,
        );
        expect(rowAt(container, 1)).toHaveAttribute("data-selected", "");
        rerender(<Grid defaultSelectedRowKeys={["p1"]} rowSelection={null} />);
        expect(rowAt(container, 1)).not.toHaveAttribute("data-selected");
        expect(rowAt(container, 1)).not.toHaveAttribute("aria-selected");
        rerender(<Grid defaultSelectedRowKeys={["p1"]} />);
        expect(rowAt(container, 1)).toHaveAttribute("data-selected", "");
    });
});

describe("useSelectAll", () => {
    it("tells none, some or all, and toggles every key", () => {
        const { container } = render(<Grid />);
        const box = container.querySelector(
            'input[aria-label="Select all"]',
        ) as HTMLInputElement;
        expect(box.dataset.status).toBe("none");
        fireEvent.click(box);
        expect(box.dataset.status).toBe("all");
        expect(box.dataset.count).toBe("20");
        expect(rowAt(container, 5)).toHaveAttribute("data-selected", "");
        const cell = cellAt(container, 5);
        act(() => cell.focus());
        shiftSpace(cell);
        expect(box.dataset.status).toBe("some");
        fireEvent.click(box);
        expect(box.dataset.status).toBe("all");
        fireEvent.click(box);
        expect(box.dataset.status).toBe("none");
    });

    it("only clears in single mode, and selects nothing while rows are not selectable", () => {
        const { container, rerender } = render(
            <Grid rowSelection="single" defaultSelectedRowKeys={["p2"]} />,
        );
        const box = () =>
            container.querySelector(
                'input[aria-label="Select all"]',
            ) as HTMLInputElement;
        expect(box().dataset.status).toBe("some");
        expect(box()).toHaveAttribute("data-can-toggle");
        fireEvent.click(box());
        expect(box().dataset.status).toBe("none");
        expect(box()).not.toHaveAttribute("data-can-toggle");
        fireEvent.click(box());
        expect(box().dataset.status).toBe("none");
        rerender(<Grid rowSelection={null} defaultSelectedRowKeys={["p2"]} />);
        fireEvent.click(box());
        expect(box().dataset.status).toBe("none");
        expect(container.querySelectorAll("[data-selected]")).toHaveLength(0);
    });

    it("works outside the root through a gridRef", () => {
        function Outside() {
            const gridRef = useDataGridRef<Person>();
            return (
                <>
                    <SelectAll gridRef={gridRef} />
                    <Grid gridRef={gridRef} />
                </>
            );
        }
        const { container } = render(<Outside />);
        const outside = container.querySelector(
            ':scope > input[aria-label="Select all"]',
        ) as HTMLInputElement;
        fireEvent.click(outside);
        expect(outside.dataset.status).toBe("all");
        expect(rowAt(container, 0)).toHaveAttribute("data-selected", "");
    });
});

describe("a row's state", () => {
    it("reports selected", () => {
        const states: boolean[] = [];
        render(<Grid rowStates={states} defaultSelectedRowKeys={["p1"]} />);
        expect(states.at(-1)).toBe(true);
    });
});

describe("useLocalRows", () => {
    it("returns every page's filtered rows", () => {
        let result: ReturnType<typeof useLocalRows<Person>> | undefined;
        function Local() {
            result = useLocalRows(people, columns, { pageSize: 5 });
            return null;
        }
        render(<Local />);
        expect(result?.rows).toHaveLength(5);
        expect(result?.filteredRows).toHaveLength(20);
        act(() => result?.filter.setSearch("p1"));
        expect(result?.filteredRows.map((person) => person.id)).toEqual([
            "p1",
            "p10",
            "p11",
            "p12",
            "p13",
            "p14",
            "p15",
            "p16",
            "p17",
            "p18",
            "p19",
        ]);
    });
});
