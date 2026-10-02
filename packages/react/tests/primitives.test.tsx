import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef, StrictMode, useState } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
    type CellPosition,
    type Column,
    DataGrid,
    type DataGridContextValue,
    type RootProps,
    useDataGrid,
} from "../src";

// The primitive contract (AGENTS.md): render, never asChild; refs merged; props forwarded and
// handlers composed; className/style as functions; structural inline style only; state through
// data-* and ARIA; no text and no names of their own. jsdom lays nothing out: the viewport's
// size is faked on the root element.

interface Person {
    id: number;
    name: string;
    age: number;
}

const people: Person[] = Array.from({ length: 1_000 }, (_, i) => ({
    id: i,
    name: `Person ${i}`,
    age: 20 + (i % 50),
}));

const columns: Column<Person>[] = [
    { key: "name", name: "Name", width: 200 },
    { key: "age", name: "Age", width: 100 },
    {
        key: "label",
        width: 150,
        renderCell: ({ row }) => <b>{row.name.toUpperCase()}</b>,
        renderHeaderCell: () => <i>Label</i>,
    },
];

const VIEWPORT = { width: 400, height: 235 };

beforeAll(() => {
    for (const [property, size] of [
        ["clientWidth", VIEWPORT.width],
        ["clientHeight", VIEWPORT.height],
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

/** The allowed structural inline style keys (AGENTS.md, the primitive contract). */
const STRUCTURAL = new Set([
    "position",
    "top",
    "left",
    "width",
    "height",
    "inset",
    "transform",
    "display",
    "overflow",
    "contain",
    "box-sizing",
]);

type DivGridProps = Pick<
    RootProps<Person>,
    | "headerRowHeight"
    | "activePosition"
    | "defaultActivePosition"
    | "onActivePositionChange"
    | "onRowWindowChange"
    | "onColumnWindowChange"
> & { rows?: Person[] };

function DivGrid({ rows = people, ...props }: DivGridProps = {}) {
    return (
        <DataGrid.Root columns={columns} rows={rows} rowHeight={20} {...props}>
            <DataGrid.Grid aria-label="People">
                <DataGrid.Header />
                <DataGrid.Body />
            </DataGrid.Grid>
        </DataGrid.Root>
    );
}

function TableGrid() {
    return (
        <DataGrid.Root columns={columns} rows={people} rowHeight={20}>
            <DataGrid.Grid aria-label="People" render={<table />}>
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
                <DataGrid.Body render={<tbody />}>
                    <DataGrid.Rows<Person>>
                        {(row) => (
                            <DataGrid.Row row={row} render={<tr />}>
                                <DataGrid.Cells<Person>>
                                    {(cell) => (
                                        <DataGrid.Cell
                                            cell={cell}
                                            render={<td />}
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

const parts = (container: HTMLElement, name: string) => [
    ...container.querySelectorAll<HTMLElement>(`[data-grid-part="${name}"]`),
];

describe("the structure", () => {
    it("renders divs by default, with the grid's roles and ARIA", () => {
        const { container } = render(<DivGrid />);
        const [grid] = parts(container, "grid");
        expect(grid?.tagName).toBe("DIV");
        expect(grid).toHaveAttribute("role", "grid");
        expect(grid).toHaveAttribute("aria-rowcount", "1001");
        expect(grid).toHaveAttribute("aria-colcount", "3");
        expect(parts(container, "header")[0]).toHaveAttribute(
            "role",
            "rowgroup",
        );
        expect(parts(container, "header-row")[0]).toHaveAttribute(
            "aria-rowindex",
            "1",
        );
        const headers = parts(container, "header-cell");
        expect(headers.map((h) => h.getAttribute("role"))).toEqual([
            "columnheader",
            "columnheader",
            "columnheader",
        ]);
        expect(headers.map((h) => h.textContent)).toEqual([
            "Name",
            "Age",
            "Label",
        ]);
        const rows = parts(container, "row");
        // 235px − 35px of header = 200px: 10 rows in view, 4 of overscan below
        expect(rows).toHaveLength(14);
        expect(rows[0]).toHaveAttribute("aria-rowindex", "2");
        const cells = parts(rows[0] as HTMLElement, "cell");
        expect(cells.map((c) => c.getAttribute("aria-colindex"))).toEqual([
            "1",
            "2",
            "3",
        ]);
        expect(cells.map((c) => c.textContent)).toEqual([
            "Person 0",
            "20",
            "PERSON 0",
        ]);
    });

    it("renders real table elements through render, with the same ARIA", () => {
        const { container } = render(<TableGrid />);
        expect(container.querySelector("table")).toHaveAttribute(
            "role",
            "grid",
        );
        expect(container.querySelectorAll("thead > tr > th")).toHaveLength(3);
        expect(container.querySelectorAll("tbody > tr")).toHaveLength(14);
        expect(container.querySelectorAll("tbody > tr > td")).toHaveLength(42);
        const td = container.querySelector("td");
        expect(td).toHaveAttribute("role", "gridcell");
        expect(td).toHaveAttribute("data-row-index", "0");
        expect(td).toHaveAttribute("data-column-index", "0");
    });

    it("sizes the grid for the whole dataset", () => {
        const { container } = render(<DivGrid />);
        const grid = parts(container, "grid")[0];
        expect(grid?.style.width).toBe("450px");
        expect(grid?.style.height).toBe(`${35 + 1_000 * 20}px`);
    });

    it("renders no header without a header row", () => {
        const { container } = render(<DivGrid headerRowHeight={0} />);
        expect(parts(container, "header")).toHaveLength(0);
        expect(parts(container, "grid")[0]).toHaveAttribute(
            "aria-rowcount",
            "1000",
        );
    });
});

describe("the primitive contract", () => {
    it("applies only structural inline style", () => {
        const { container } = render(<DivGrid />);
        for (const element of container.querySelectorAll<HTMLElement>(
            "[data-grid-part]",
        )) {
            for (const property of [...element.style]) {
                expect(
                    STRUCTURAL.has(property),
                    `${element.dataset.gridPart}: ${property}`,
                ).toBe(true);
            }
        }
    });

    it("sets no accessible name of its own", () => {
        const { container } = render(
            <DataGrid.Root columns={columns} rows={people}>
                <DataGrid.Grid>
                    <DataGrid.Header />
                    <DataGrid.Body />
                </DataGrid.Grid>
            </DataGrid.Root>,
        );
        expect(container.querySelectorAll("[aria-label]")).toHaveLength(0);
    });

    it("resolves className and style functions against the state; structural keys win", () => {
        const { container } = render(
            <DataGrid.Root
                columns={columns}
                rows={people}
                defaultActivePosition={{ rowIndex: 1, columnIndex: 1 }}
            >
                <DataGrid.Grid
                    className="grid"
                    style={{ color: "red", width: 1 }}
                >
                    <DataGrid.Body>
                        <DataGrid.Rows<Person>>
                            {(row) => (
                                <DataGrid.Row
                                    row={row}
                                    className={(state) =>
                                        state.active ? "row is-active" : "row"
                                    }
                                >
                                    <DataGrid.Cells<Person>>
                                        {(cell) => (
                                            <DataGrid.Cell
                                                cell={cell}
                                                style={(state) => ({
                                                    outlineWidth: state.active
                                                        ? 2
                                                        : 0,
                                                    position: "static",
                                                })}
                                            />
                                        )}
                                    </DataGrid.Cells>
                                </DataGrid.Row>
                            )}
                        </DataGrid.Rows>
                    </DataGrid.Body>
                </DataGrid.Grid>
            </DataGrid.Root>,
        );
        const grid = parts(container, "grid")[0];
        expect(grid).toHaveClass("grid");
        expect(grid?.style.color).toBe("red");
        expect(grid?.style.width).not.toBe("1px");
        const rows = parts(container, "row");
        expect(rows[1]).toHaveClass("row", "is-active");
        expect(rows[0]).not.toHaveClass("is-active");
        const active = container.querySelector<HTMLElement>(
            "[data-active][data-grid-part=cell]",
        );
        expect(active?.style.outlineWidth).toBe("2px");
        expect(active?.style.position).toBe("absolute");
    });

    it("renders through a render function with the props and the state", () => {
        const { container } = render(
            <DataGrid.Root columns={columns} rows={people}>
                <DataGrid.Grid
                    render={(props, state) => (
                        <section {...props} data-count={state.rowCount} />
                    )}
                >
                    <DataGrid.Body />
                </DataGrid.Grid>
            </DataGrid.Root>,
        );
        const section = container.querySelector("section");
        expect(section).toHaveAttribute("role", "grid");
        expect(section).toHaveAttribute("data-count", "1000");
    });

    it("merges refs, forwards props and composes handlers", () => {
        const ref = createRef<HTMLElement>();
        const onClick = vi.fn();
        const { container } = render(
            <DataGrid.Root columns={columns} rows={people}>
                <DataGrid.Grid ref={ref} id="people" onClick={onClick}>
                    <DataGrid.Body />
                </DataGrid.Grid>
            </DataGrid.Root>,
        );
        const grid = parts(container, "grid")[0];
        expect(ref.current).toBe(grid);
        expect(grid).toHaveAttribute("id", "people");
        fireEvent.click(grid as HTMLElement);
        expect(onClick).toHaveBeenCalledOnce();
    });

    it('marks state with present-or-absent data attributes, never "false"', () => {
        const loaded = new Map([[0, people[0]]]);
        const { container } = render(
            <DataGrid.Root
                columns={columns}
                rowCount={100}
                getRow={(index) => loaded.get(index)}
                defaultActivePosition={{ rowIndex: 0, columnIndex: 0 }}
            >
                <DataGrid.Grid>
                    <DataGrid.Body />
                </DataGrid.Grid>
            </DataGrid.Root>,
        );
        const rows = parts(container, "row");
        expect(rows[0]).not.toHaveAttribute("data-loading");
        expect(rows[0]).toHaveAttribute("data-active", "");
        expect(rows[1]).toHaveAttribute("data-loading", "");
        expect(rows[1]).not.toHaveAttribute("data-active");
        expect(container.innerHTML).not.toContain('="false"');
        // a row not loaded renders its cells, empty
        expect(
            parts(rows[1] as HTMLElement, "cell").map((c) => c.textContent),
        ).toEqual(["", "", ""]);
    });
});

describe("the active cell", () => {
    function Probe({
        onReady,
    }: {
        onReady: (value: DataGridContextValue<Person>) => void;
    }) {
        onReady(useDataGrid<Person>());
        return null;
    }

    it("works uncontrolled: the keyboard moves it, and the change is reported", () => {
        const onChange = vi.fn();
        const { container } = render(
            <DivGrid
                defaultActivePosition={{ rowIndex: 0, columnIndex: 0 }}
                onActivePositionChange={onChange}
            />,
        );
        const cell = container.querySelector<HTMLElement>(
            '[data-row-index="0"][data-column-index="0"]',
        );
        expect(cell).toHaveAttribute("tabindex", "0");
        fireEvent.keyDown(cell as HTMLElement, { key: "ArrowRight" });
        expect(onChange).toHaveBeenLastCalledWith({
            rowIndex: 0,
            columnIndex: 1,
        });
        expect(
            container.querySelector(
                '[data-row-index="0"][data-column-index="1"]',
            ),
        ).toHaveAttribute("data-active", "");
        expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    });

    it("works controlled: a move asks, and only the prop moves it", () => {
        const onChange = vi.fn();
        const { container, rerender } = render(
            <DivGrid
                activePosition={{ rowIndex: 2, columnIndex: 0 }}
                onActivePositionChange={onChange}
            />,
        );
        const at = (row: number, column: number) =>
            container.querySelector(
                `[data-row-index="${row}"][data-column-index="${column}"]`,
            );
        fireEvent.keyDown(at(2, 0) as HTMLElement, { key: "ArrowDown" });
        expect(onChange).toHaveBeenCalledWith({ rowIndex: 3, columnIndex: 0 });
        // the parent did not follow: still on row 2
        expect(at(2, 0)).toHaveAttribute("data-active", "");
        rerender(
            <DivGrid
                activePosition={{ rowIndex: 3, columnIndex: 0 }}
                onActivePositionChange={onChange}
            />,
        );
        expect(at(3, 0)).toHaveAttribute("data-active", "");
    });

    it("follows the model: useDataGrid().model.run changes the same state, through onChange when controlled", () => {
        let grid: DataGridContextValue<Person> | null = null;
        function Controlled() {
            const [position, setPosition] = useState<CellPosition | null>(null);
            return (
                <DataGrid.Root
                    columns={columns}
                    rows={people}
                    activePosition={position}
                    onActivePositionChange={setPosition}
                >
                    <Probe
                        onReady={(value) => {
                            grid = value;
                        }}
                    />
                    <DataGrid.Grid>
                        <DataGrid.Body />
                    </DataGrid.Grid>
                </DataGrid.Root>
            );
        }
        const { container } = render(<Controlled />);
        act(() => {
            grid?.model.run("active-position.set", {
                rowIndex: 4,
                columnIndex: 2,
            });
        });
        expect(
            container.querySelector(
                '[data-row-index="4"][data-column-index="2"]',
            ),
        ).toHaveAttribute("data-active", "");
    });

    it("lets a cell's own onKeyDown cancel a key", () => {
        const onChange = vi.fn();
        const { container } = render(
            <DataGrid.Root
                columns={columns}
                rows={people}
                defaultActivePosition={{ rowIndex: 0, columnIndex: 0 }}
                onActivePositionChange={onChange}
            >
                <DataGrid.Grid>
                    <DataGrid.Body>
                        <DataGrid.Rows<Person>>
                            {(row) => (
                                <DataGrid.Row row={row}>
                                    <DataGrid.Cells<Person>>
                                        {(cell) => (
                                            <DataGrid.Cell
                                                cell={cell}
                                                onKeyDown={(event) => {
                                                    if (
                                                        event.key ===
                                                        "ArrowRight"
                                                    )
                                                        event.preventDefault();
                                                }}
                                            />
                                        )}
                                    </DataGrid.Cells>
                                </DataGrid.Row>
                            )}
                        </DataGrid.Rows>
                    </DataGrid.Body>
                </DataGrid.Grid>
            </DataGrid.Root>,
        );
        const cell = container.querySelector(
            '[data-row-index="0"][data-column-index="0"]',
        ) as HTMLElement;
        fireEvent.keyDown(cell, { key: "ArrowRight" });
        expect(onChange).not.toHaveBeenCalled();
        fireEvent.keyDown(cell, { key: "ArrowDown" });
        expect(onChange).toHaveBeenCalledWith({ rowIndex: 1, columnIndex: 0 });
    });

    it("makes the grid the tab stop while no cell is active", () => {
        const { container } = render(<DivGrid />);
        expect(parts(container, "grid")[0]).toHaveAttribute("tabindex", "0");
        expect(
            container.querySelectorAll('[data-grid-part=cell][tabindex="0"]'),
        ).toHaveLength(0);
    });
});

describe("the empty state", () => {
    function EmptyGrid({ rows }: { rows: Person[] }) {
        return (
            <DataGrid.Root columns={columns} rows={rows} rowHeight={20}>
                <DataGrid.Grid aria-label="People">
                    <DataGrid.Header />
                    <DataGrid.Body />
                    <DataGrid.Empty className="empty">
                        <p>No people</p>
                    </DataGrid.Empty>
                </DataGrid.Grid>
            </DataGrid.Root>
        );
    }

    it("renders its children only while there are no rows, and marks the root and the grid", () => {
        const { container, rerender } = render(<EmptyGrid rows={[]} />);
        const [empty] = parts(container, "empty");
        expect(empty?.textContent).toBe("No people");
        expect(empty).toHaveClass("empty");
        expect(parts(container, "root")[0]).toHaveAttribute("data-empty", "");
        expect(parts(container, "grid")[0]).toHaveAttribute("data-empty", "");
        expect(parts(container, "row")).toHaveLength(0);
        // the header stays: the columns are still there
        expect(parts(container, "header-cell")).toHaveLength(3);

        rerender(<EmptyGrid rows={people.slice(0, 3)} />);
        expect(parts(container, "empty")).toHaveLength(0);
        expect(parts(container, "root")[0]).not.toHaveAttribute("data-empty");
        expect(parts(container, "grid")[0]).not.toHaveAttribute("data-empty");
        expect(parts(container, "row")).toHaveLength(3);
    });

    it("fills the visible body below the header, and stays in view sideways", () => {
        const { container } = render(<EmptyGrid rows={[]} />);
        const [empty] = parts(container, "empty");
        // the viewport is 400 × 235, the header 35 high
        expect(empty?.style.position).toBe("sticky");
        expect(empty?.style.left).toBe("0px");
        expect(empty?.style.width).toBe("400px");
        expect(empty?.style.height).toBe("200px");
        for (const property of [...(empty?.style ?? [])]) {
            expect(STRUCTURAL.has(property), property).toBe(true);
        }
        // the grid is at least as large as the visible area, so the empty state has room
        const [grid] = parts(container, "grid");
        expect(grid?.style.width).toBe("450px");
        expect(grid?.style.height).toBe("235px");
    });

    it("follows the primitive contract: render, ref, handlers, className and style", () => {
        const ref = createRef<HTMLTableSectionElement>();
        const onClick = vi.fn();
        const { container } = render(
            <DataGrid.Root columns={columns} rows={[]}>
                <DataGrid.Grid render={<table />}>
                    <DataGrid.Body render={<tbody />} />
                    <DataGrid.Empty
                        ref={ref}
                        render={<tbody />}
                        id="nothing"
                        onClick={onClick}
                        className={() => "from-a-function"}
                        style={{ color: "red", position: "static", width: 1 }}
                    >
                        <tr>
                            <td>No people</td>
                        </tr>
                    </DataGrid.Empty>
                </DataGrid.Grid>
            </DataGrid.Root>,
        );
        const [empty] = parts(container, "empty");
        expect(empty?.tagName).toBe("TBODY");
        expect(ref.current).toBe(empty);
        expect(empty).toHaveAttribute("id", "nothing");
        expect(empty).toHaveClass("from-a-function");
        // the consumer's style is merged under the structural one
        expect(empty?.style.color).toBe("red");
        expect(empty?.style.position).toBe("sticky");
        expect(empty?.style.width).toBe("400px");
        fireEvent.click(screen.getByText("No people"));
        expect(onClick).toHaveBeenCalledTimes(1);

        const rendered = vi.fn((props: object) => <div {...props} />);
        render(
            <DataGrid.Root columns={columns} rows={[]}>
                <DataGrid.Grid>
                    <DataGrid.Empty render={rendered} />
                </DataGrid.Grid>
            </DataGrid.Root>,
        );
        expect(rendered).toHaveBeenCalled();
        expect(rendered.mock.calls[0]?.[0]).toMatchObject({
            "data-grid-part": "empty",
        });
    });

    it("sets no role, text or name of its own", () => {
        const { container } = render(
            <DataGrid.Root columns={columns} rows={[]}>
                <DataGrid.Grid>
                    <DataGrid.Body />
                    <DataGrid.Empty />
                </DataGrid.Grid>
            </DataGrid.Root>,
        );
        const [empty] = parts(container, "empty");
        expect(empty).not.toHaveAttribute("role");
        expect(empty?.textContent).toBe("");
        expect(container.querySelectorAll("[aria-label]")).toHaveLength(0);
    });
});

describe("regressions", () => {
    it("goes back to the default row height when the prop is removed", () => {
        const { container, rerender } = render(
            <DataGrid.Root columns={columns} rows={people} rowHeight={50}>
                <DataGrid.Grid>
                    <DataGrid.Body />
                </DataGrid.Grid>
            </DataGrid.Root>,
        );
        expect(parts(container, "row")[0]?.style.height).toBe("50px");
        rerender(
            <DataGrid.Root columns={columns} rows={people}>
                <DataGrid.Grid>
                    <DataGrid.Body />
                </DataGrid.Grid>
            </DataGrid.Root>,
        );
        expect(parts(container, "row")[0]?.style.height).toBe("35px");
    });

    it("tells a controlled parent when the grid's shape moved the active cell", () => {
        const onChange = vi.fn();
        const { rerender } = render(
            <DivGrid
                activePosition={{ rowIndex: 50, columnIndex: 0 }}
                onActivePositionChange={onChange}
            />,
        );
        rerender(
            <DivGrid
                rows={people.slice(0, 10)}
                activePosition={{ rowIndex: 50, columnIndex: 0 }}
                onActivePositionChange={onChange}
            />,
        );
        expect(onChange).toHaveBeenCalledWith({ rowIndex: 9, columnIndex: 0 });
    });

    it("keeps a row's elements when it loads in place", () => {
        const loaded = new Map<number, Person>();
        const tree = (getRow: (index: number) => Person | undefined) => (
            <DataGrid.Root columns={columns} rowCount={100} getRow={getRow}>
                <DataGrid.Grid>
                    <DataGrid.Body />
                </DataGrid.Grid>
            </DataGrid.Root>
        );
        const { container, rerender } = render(
            tree((index) => loaded.get(index)),
        );
        const before = container.querySelector(
            '[data-row-index="3"][data-column-index="0"]',
        );
        loaded.set(3, people[3] as Person);
        rerender(tree((index) => loaded.get(index)));
        const after = container.querySelector(
            '[data-row-index="3"][data-column-index="0"]',
        );
        expect(after).toBe(before);
        expect(after?.textContent).toBe("Person 3");
    });
});

describe("epic review regressions", () => {
    it("keeps a controlled position the parent changes with the rows in the same update", () => {
        const onChange = vi.fn();
        const { container, rerender } = render(
            <DivGrid
                activePosition={{ rowIndex: 500, columnIndex: 0 }}
                onActivePositionChange={onChange}
            />,
        );
        rerender(
            <DivGrid
                rows={people.slice(0, 10)}
                activePosition={{ rowIndex: 0, columnIndex: 1 }}
                onActivePositionChange={onChange}
            />,
        );
        expect(onChange).not.toHaveBeenCalled();
        expect(
            container.querySelector(
                '[data-row-index="0"][data-column-index="1"]',
            ),
        ).toHaveAttribute("data-active", "");
    });

    it("lets the root's render element cancel a key", () => {
        const onChange = vi.fn();
        const section = (
            // biome-ignore lint/a11y/noStaticElementInteractions: the cells inside are the interactive elements
            <section
                onKeyDown={(event) => {
                    if (event.key === "ArrowDown") event.preventDefault();
                }}
            />
        );
        const { container } = render(
            <DataGrid.Root
                columns={columns}
                rows={people}
                defaultActivePosition={{ rowIndex: 0, columnIndex: 0 }}
                onActivePositionChange={onChange}
                render={section}
            >
                <DataGrid.Grid>
                    <DataGrid.Body />
                </DataGrid.Grid>
            </DataGrid.Root>,
        );
        const cell = container.querySelector(
            '[data-row-index="0"][data-column-index="0"]',
        ) as HTMLElement;
        fireEvent.keyDown(cell, { key: "ArrowDown" });
        expect(onChange).not.toHaveBeenCalled();
        fireEvent.keyDown(cell, { key: "ArrowRight" });
        expect(onChange).toHaveBeenCalledOnce();
    });

    it("ignores keys from a portal rendered by a cell", async () => {
        const { createPortal } = await import("react-dom");
        const onChange = vi.fn();
        render(
            <DataGrid.Root
                columns={columns}
                rows={people}
                defaultActivePosition={{ rowIndex: 0, columnIndex: 0 }}
                onActivePositionChange={onChange}
            >
                <DataGrid.Grid>
                    <DataGrid.Body>
                        <DataGrid.Rows<Person>>
                            {(row) => (
                                <DataGrid.Row row={row}>
                                    <DataGrid.Cells<Person>>
                                        {(cell) => (
                                            <DataGrid.Cell cell={cell}>
                                                {cell.rowIndex === 0 &&
                                                cell.columnIndex === 0
                                                    ? createPortal(
                                                          <button type="button">
                                                              menu
                                                          </button>,
                                                          document.body,
                                                      )
                                                    : undefined}
                                            </DataGrid.Cell>
                                        )}
                                    </DataGrid.Cells>
                                </DataGrid.Row>
                            )}
                        </DataGrid.Rows>
                    </DataGrid.Body>
                </DataGrid.Grid>
            </DataGrid.Root>,
        );
        fireEvent.keyDown(screen.getByRole("button", { name: "menu" }), {
            key: "ArrowDown",
        });
        expect(onChange).not.toHaveBeenCalled();
    });

    it("keeps the engine's transform on a layer whose style has one", () => {
        const { container } = render(
            <DataGrid.Root columns={columns} rows={people}>
                <DataGrid.Grid>
                    <DataGrid.Body
                        style={{ transform: "translateZ(0)", color: "red" }}
                    />
                </DataGrid.Grid>
            </DataGrid.Root>,
        );
        const body = parts(container, "body")[0];
        expect(body?.style.color).toBe("red");
        expect(body?.style.transform).toMatch(/^translate3d/);
    });
});

describe("the engine's life", () => {
    it("attaches once under StrictMode: one window event per scroll", () => {
        const onRowWindowChange = vi.fn();
        const { container } = render(
            <StrictMode>
                <DivGrid onRowWindowChange={onRowWindowChange} />
            </StrictMode>,
        );
        const root = parts(container, "root")[0] as HTMLElement;
        onRowWindowChange.mockClear();
        root.scrollTop = 100;
        fireEvent.scroll(root);
        expect(onRowWindowChange).toHaveBeenCalledTimes(1);
        expect(onRowWindowChange.mock.calls[0]?.[0].visible).toEqual({
            start: 5,
            end: 15,
        });
    });

    it("reports the first windows", () => {
        const onRowWindowChange = vi.fn();
        const onColumnWindowChange = vi.fn();
        render(
            <DivGrid
                onRowWindowChange={onRowWindowChange}
                onColumnWindowChange={onColumnWindowChange}
            />,
        );
        expect(onRowWindowChange).toHaveBeenCalledWith({
            visible: { start: 0, end: 10 },
            rendered: { start: 0, end: 14 },
        });
        expect(onColumnWindowChange).toHaveBeenCalledWith({
            // 400px wide: Name (200) and Age (100) fully, Label (from 300) partly
            visible: { start: 0, end: 3 },
            rendered: { start: 0, end: 3 },
        });
    });

    it("renders new rows when the props change", () => {
        const { container, rerender } = render(
            <DivGrid rows={people.slice(0, 3)} />,
        );
        expect(parts(container, "row")).toHaveLength(3);
        rerender(<DivGrid rows={people.slice(0, 5)} />);
        expect(parts(container, "row")).toHaveLength(5);
        expect(screen.getByText("Person 4")).toBeInTheDocument();
    });
});
