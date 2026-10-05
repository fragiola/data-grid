import { act, fireEvent, render } from "@testing-library/react";
import type * as React from "react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    type Column,
    type ColumnOrGroup,
    type ColumnResizerState,
    type ColumnWidths,
    DataGrid,
    type DataGridRef,
    type HeaderCellInfo,
    type RootProps,
    useColumnResizer,
    useDataGridRef,
} from "../src";
import { cellAt, headerAt, root, stubViewportSize, tags } from "./helpers";

// Column resizing (Epic #70): the widths controlled or not on `Root` (W1), a resizer's props and
// state from `useColumnResizer` (W3), the header cells' `data-resizable`/`data-resizing` (W8).
// The drag, the keys and the double click are the engine's (core tests, the shared e2e spec).
// Automatic widths (Epic #80): the parts and the handle read the width on screen, a flex share or
// an automatic width, which is the engine's and never reported (A6).

interface Person {
    id: number;
    name: string;
    age: number;
}

const people: Person[] = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    name: `Person ${i}`,
    age: 20 + (i % 7),
}));

const columns: Column<Person>[] = [
    { key: "name", name: "Name", width: 150, resizable: true },
    {
        key: "age",
        name: "Age",
        width: 80,
        resizable: true,
        minWidth: 60,
        maxWidth: 120,
    },
    { key: "id", name: "Id", width: 80 },
];

const grouped: ColumnOrGroup<Person>[] = [
    { key: "person", name: "Person", children: columns.slice(0, 2) },
    { key: "rest", name: "Rest", children: columns.slice(2) },
];

stubViewportSize(600, 300);

/** The states the resizers rendered last, by key. */
const states = new Map<string, ColumnResizerState>();

/** A resizer as an app writes it: the hook's props on an element of its own. */
function Resizer({ cell }: { cell: HeaderCellInfo<Person> }) {
    const { state, props } = useColumnResizer(cell);
    states.set(cell.key, state);
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the hook's props make it a separator
    return <div {...props} aria-label={`Resize ${cell.key}`} />;
}

type GridProps = Pick<
    RootProps<Person>,
    | "columnWidths"
    | "defaultColumnWidths"
    | "onColumnWidthsChange"
    | "activePosition"
    | "onActivePositionChange"
    | "onPointerDown"
    | "gridRef"
> & {
    cells?: readonly ColumnOrGroup<Person>[];
    table?: boolean;
    resizers?: boolean;
};

function Grid({
    cells = columns,
    table = false,
    resizers = true,
    ...props
}: GridProps) {
    const tag = tags(table);
    return (
        <DataGrid.Root columns={cells} rows={people} rowHeight={20} {...props}>
            <DataGrid.Grid render={tag.grid}>
                <DataGrid.Header render={tag.header}>
                    <DataGrid.HeaderRows<Person>>
                        {(row) => (
                            <DataGrid.HeaderRow
                                row={row}
                                render={tag.headerRow}
                            >
                                <DataGrid.HeaderCells<Person>>
                                    {(cell) => (
                                        <DataGrid.HeaderCell
                                            cell={cell}
                                            render={tag.headerCell}
                                        >
                                            {cell.key}
                                            {resizers ? (
                                                <Resizer cell={cell} />
                                            ) : null}
                                        </DataGrid.HeaderCell>
                                    )}
                                </DataGrid.HeaderCells>
                            </DataGrid.HeaderRow>
                        )}
                    </DataGrid.HeaderRows>
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

function resizerOf(container: HTMLElement, key: string): HTMLElement {
    const element = container.querySelector(
        `[data-grid-column-resizer="${key}"]`,
    );
    if (!(element instanceof HTMLElement)) throw new Error(`no ${key}`);
    return element;
}

/** The width of a column's header cell and its first body cell, as their style sets them. */
function widthsOf(container: HTMLElement, columnIndex: number) {
    return [
        cellAt(container, -1, columnIndex).style.width,
        cellAt(container, 0, columnIndex).style.width,
    ];
}

/** A grid with a handle on it from outside, to run commands on. */
function withRef(props: GridProps) {
    let gridRef: DataGridRef<Person> | undefined;
    function App(given: GridProps) {
        const ref = useDataGridRef<Person>();
        gridRef = ref;
        return <Grid gridRef={ref} {...given} />;
    }
    const view = render(<App {...props} />);
    /** The model and the engine of the root on screen. */
    const grid = () => {
        const current = gridRef?.current;
        if (!current) throw new Error("no grid");
        return current;
    };
    const resize = (columnKey: string, width: number) =>
        act(() => {
            grid().model.run("column-widths.resize", { columnKey, width });
        });
    return {
        ...view,
        grid,
        resize,
        rerender: (next: GridProps) => view.rerender(<App {...next} />),
    };
}

describe("uncontrolled", () => {
    it("starts with defaultColumnWidths, resizes, and tells each change once", () => {
        const onColumnWidthsChange = vi.fn();
        const { container, resize } = withRef({
            defaultColumnWidths: { name: 200 },
            onColumnWidthsChange,
        });
        expect(widthsOf(container, 0)).toEqual(["200px", "200px"]);
        expect(onColumnWidthsChange).not.toHaveBeenCalled();
        resize("age", 100);
        expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
        expect(onColumnWidthsChange).toHaveBeenLastCalledWith({
            name: 200,
            age: 100,
        });
        expect(widthsOf(container, 1)).toEqual(["100px", "100px"]);
        // the next column follows
        expect(headerAt(container, 2).style.left).toBe("300px");
        expect(resizerOf(container, "age")).toHaveAttribute(
            "aria-valuenow",
            "100",
        );
        // within its limits: no change, nothing told
        resize("age", 500);
        resize("age", 500);
        expect(onColumnWidthsChange).toHaveBeenCalledTimes(2);
        expect(widthsOf(container, 1)).toEqual(["120px", "120px"]);
    });
});

describe("controlled", () => {
    it("asks on a resize, and shows the width only when the prop follows", () => {
        const onColumnWidthsChange = vi.fn();
        const { container, resize, rerender } = withRef({
            columnWidths: {},
            onColumnWidthsChange,
        });
        resize("name", 180);
        expect(onColumnWidthsChange).toHaveBeenCalledWith({ name: 180 });
        expect(widthsOf(container, 0)).toEqual(["150px", "150px"]);
        rerender({ columnWidths: { name: 180 }, onColumnWidthsChange });
        expect(widthsOf(container, 0)).toEqual(["180px", "180px"]);
        // the root's own sync is never told back
        expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
    });

    it("works with a parent that follows", () => {
        let widths: ColumnWidths = {};
        let gridRef: DataGridRef<Person> | undefined;
        function Parent({ cells }: { cells: ColumnOrGroup<Person>[] }) {
            const [columnWidths, setColumnWidths] = useState<ColumnWidths>({});
            widths = columnWidths;
            gridRef = useDataGridRef<Person>();
            return (
                <Grid
                    cells={cells}
                    gridRef={gridRef}
                    columnWidths={columnWidths}
                    onColumnWidthsChange={setColumnWidths}
                />
            );
        }
        const { container } = render(<Parent cells={grouped} />);
        act(() => {
            gridRef?.current?.model.run("column-widths.resize", {
                columnKey: "person",
                width: 345,
            });
        });
        // the group's 115px more shared by their widths: 75 and 40
        expect(widths).toEqual({ name: 225, age: 120 });
        expect(widthsOf(container, 0)).toEqual(["225px", "225px"]);
        act(() => {
            gridRef?.current?.model.run("column-widths.reset", {});
        });
        expect(widths).toEqual({});
        expect(widthsOf(container, 1)).toEqual(["80px", "80px"]);
    });
});

describe("useColumnResizer", () => {
    it("gives a separator's ARIA, the marking attribute and its part, and no style", () => {
        const { container } = render(<Grid />);
        const age = resizerOf(container, "age");
        expect(age).toHaveAttribute("role", "separator");
        expect(age).toHaveAttribute("aria-orientation", "vertical");
        expect(age).toHaveAttribute("aria-valuenow", "80");
        expect(age).toHaveAttribute("aria-valuemin", "60");
        expect(age).toHaveAttribute("aria-valuemax", "120");
        expect(age).toHaveAttribute("data-grid-part", "column-resizer");
        expect(age).toHaveAttribute("tabindex", "0");
        expect(age).not.toHaveAttribute("style");
        expect(age).not.toHaveAttribute("data-resizing");
        // no maximum: the view's width (wider than the column) for ARIA
        expect(resizerOf(container, "name")).toHaveAttribute(
            "aria-valuemax",
            "600",
        );
        expect(states.get("age")).toEqual({
            columnKey: "age",
            resizable: true,
            resizing: false,
            width: 80,
            minWidth: 60,
            maxWidth: 120,
            edge: "end",
        });
        expect(states.get("id")?.resizable).toBe(false);
    });

    it("gives no props under a header cell whose columns do not resize", () => {
        const { container } = render(<Grid />);
        const id = container.querySelector('[aria-label="Resize id"]');
        expect(id?.getAttributeNames()).toEqual(["aria-label"]);
    });

    it("gives a group's resizer its columns' width and limits together", () => {
        const { container } = render(<Grid cells={grouped} />);
        const person = resizerOf(container, "person");
        expect(person).toHaveAttribute("aria-valuenow", "230");
        // the name at 40 (the default minimum), the age at 60
        expect(person).toHaveAttribute("aria-valuemin", "100");
        expect(person).toHaveAttribute("aria-valuemax", "600");
        expect(states.get("rest")?.resizable).toBe(false);
    });

    it("marks the resizer and its header cell while a drag resizes", () => {
        const { container } = render(<Grid />);
        const age = resizerOf(container, "age");
        fireEvent.pointerDown(age, { button: 0, pointerId: 1, clientX: 300 });
        expect(age).toHaveAttribute("data-resizing", "");
        expect(headerAt(container, 1)).toHaveAttribute("data-resizing", "");
        expect(headerAt(container, 0)).not.toHaveAttribute("data-resizing");
        expect(states.get("age")?.resizing).toBe(true);
        fireEvent.pointerUp(age, { pointerId: 1, clientX: 300 });
        expect(age).not.toHaveAttribute("data-resizing");
        expect(headerAt(container, 1)).not.toHaveAttribute("data-resizing");
    });

    it("starts a drag after the consumer's onPointerDown: preventDefault cancels it", () => {
        const onPointerDown = vi.fn((event: React.PointerEvent) =>
            event.preventDefault(),
        );
        const { container } = render(<Grid onPointerDown={onPointerDown} />);
        const age = resizerOf(container, "age");
        fireEvent.pointerDown(age, { button: 0, pointerId: 1, clientX: 300 });
        expect(onPointerDown).toHaveBeenCalledTimes(1);
        expect(age).not.toHaveAttribute("data-resizing");
        expect(states.get("age")?.resizing).toBe(false);
    });
});

describe("structure", () => {
    it.each([
        ["divs", false],
        ["a table", true],
    ])("marks resizable header cells, as %s", (_, table) => {
        const { container } = render(<Grid cells={grouped} table={table} />);
        const resizable = [
            ...container.querySelectorAll('[data-grid-part="header-cell"]'),
        ].map((cell) => [
            cell.textContent,
            cell.tagName,
            cell.hasAttribute("data-resizable"),
        ]);
        const tag = table ? "TH" : "DIV";
        expect(resizable).toEqual([
            ["person", tag, true],
            ["rest", tag, false],
            ["name", tag, true],
            ["age", tag, true],
            ["id", tag, false],
        ]);
        // the resizer is the app's element, inside its header cell
        expect(
            resizerOf(container, "age").closest(
                '[data-grid-part="header-cell"]',
            ),
        ).toBe(headerAt(container, 1));
    });

    it("adds no attribute to a grid without resizable columns", () => {
        const { container } = render(
            <Grid
                cells={columns.map(
                    ({
                        resizable: _resizable,
                        minWidth: _min,
                        maxWidth: _max,
                        ...column
                    }) => column,
                )}
                resizers={false}
            />,
        );
        expect(
            container.querySelectorAll(
                "[data-resizable], [data-resizing], [data-grid-column-resizer]",
            ),
        ).toHaveLength(0);
    });
});

describe("the widths a root is given", () => {
    it("tells the app the widths it starts with when some were not widths", () => {
        const onColumnWidthsChange = vi.fn();
        const { container } = render(
            <Grid
                defaultColumnWidths={{ name: 200, age: -1 }}
                onColumnWidthsChange={onColumnWidthsChange}
            />,
        );
        expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
        expect(onColumnWidthsChange).toHaveBeenCalledWith({ name: 200 });
        expect(widthsOf(container, 0)).toEqual(["200px", "200px"]);
    });

    it("keeps the widths of a controlled prop, and tells the parent the ones it holds", () => {
        const onColumnWidthsChange = vi.fn();
        const { container, rerender } = withRef({
            columnWidths: { name: 180, age: -1 },
            onColumnWidthsChange,
        });
        expect(widthsOf(container, 0)).toEqual(["180px", "180px"]);
        expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ name: 180 });
        rerender({
            columnWidths: { name: 190, age: Number.NaN },
            onColumnWidthsChange,
        });
        expect(widthsOf(container, 0)).toEqual(["190px", "190px"]);
        expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ name: 190 });
    });

    it("follows controlled widths before a controlled position scrolls into view", () => {
        const wide: Column<Person>[] = Array.from({ length: 20 }, (_, i) => ({
            key: `w${i}`,
            width: 100,
            resizable: true,
        }));
        const onActivePositionChange = vi.fn();
        let gridRef: DataGridRef<Person> | undefined;
        function App(props: GridProps) {
            gridRef = useDataGridRef<Person>();
            return (
                <Grid
                    cells={wide}
                    gridRef={gridRef}
                    onActivePositionChange={onActivePositionChange}
                    {...props}
                />
            );
        }
        const { container, rerender } = render(
            <App activePosition={null} columnWidths={{}} />,
        );
        // in one render: the first three columns widen, and the 16th becomes active
        rerender(
            <App
                activePosition={{ rowIndex: 0, columnIndex: 15 }}
                columnWidths={{ w0: 400, w1: 400, w2: 400 }}
            />,
        );
        // against the new widths: it starts at 3 × 400 + 12 × 100 and ends at the view's end
        expect(root(container).scrollLeft).toBe(2_500 - 600);
        act(() => {
            fireEvent.scroll(root(container));
        });
        const visible = gridRef?.current?.engine.get("column-window").visible;
        expect(visible?.start).toBeLessThanOrEqual(15);
        expect(visible?.end).toBeGreaterThan(15);
    });

    it("takes widths for columns that arrive in the same render", () => {
        const onColumnWidthsChange = vi.fn();
        const extra: Column<Person> = {
            key: "extra",
            width: 50,
            resizable: true,
        };
        const { container, rerender } = render(
            <Grid
                columnWidths={{}}
                onColumnWidthsChange={onColumnWidthsChange}
            />,
        );
        rerender(
            <Grid
                cells={[...columns, extra]}
                columnWidths={{ extra: 90 }}
                onColumnWidthsChange={onColumnWidthsChange}
            />,
        );
        expect(widthsOf(container, 3)).toEqual(["90px", "90px"]);
        expect(onColumnWidthsChange).not.toHaveBeenCalled();
    });
});

describe("a controlled drag", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    /** The animation frames the engine asks for, run when the test says. */
    function fakeFrames() {
        const frames: FrameRequestCallback[] = [];
        vi.spyOn(window, "requestAnimationFrame").mockImplementation(
            (callback) => frames.push(callback),
        );
        vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
        return () =>
            act(() => {
                for (const frame of frames.splice(0)) frame(0);
            });
    }

    function Parent({
        onChange,
    }: {
        onChange: (widths: ColumnWidths) => void;
    }) {
        const [columnWidths, setColumnWidths] = useState<ColumnWidths>({});
        return (
            <Grid
                columnWidths={columnWidths}
                onColumnWidthsChange={(next) => {
                    onChange(next);
                    setColumnWidths(next);
                }}
            />
        );
    }

    const move = (target: HTMLElement, clientX: number) =>
        fireEvent.pointerMove(target, { pointerId: 1, buttons: 1, clientX });

    it("asks the parent once a frame, and Escape asks for the width it started from", () => {
        const flush = fakeFrames();
        const onChange = vi.fn();
        const { container } = render(<Parent onChange={onChange} />);
        const age = resizerOf(container, "age");
        fireEvent.pointerDown(age, { button: 0, pointerId: 1, clientX: 300 });
        move(age, 310);
        move(age, 320);
        move(age, 330);
        expect(onChange).not.toHaveBeenCalled();
        flush();
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenLastCalledWith({ age: 110 });
        expect(widthsOf(container, 1)).toEqual(["110px", "110px"]);
        move(age, 325);
        move(age, 335);
        flush();
        expect(onChange).toHaveBeenCalledTimes(2);
        expect(widthsOf(container, 1)).toEqual(["115px", "115px"]);
        fireEvent.keyDown(document, { key: "Escape" });
        expect(onChange).toHaveBeenCalledTimes(3);
        // a resize back to its start, its own width: no width of the record's
        expect(onChange).toHaveBeenLastCalledWith({});
        expect(widthsOf(container, 1)).toEqual(["80px", "80px"]);
        expect(age).not.toHaveAttribute("data-resizing");
    });
});

describe("automatic widths (Epic #80)", () => {
    /** "name" flexes one part, "age" two up to its 120px; "id" is fixed. */
    const flexing: Column<Person>[] = [
        { key: "name", name: "Name", width: 150, resizable: true, flex: 1 },
        {
            key: "age",
            name: "Age",
            width: 80,
            resizable: true,
            minWidth: 60,
            maxWidth: 120,
            flex: 2,
        },
        { key: "id", name: "Id", width: 80 },
    ];

    /**
     * Fakes the layout a measure reads (A3): an element is 8px a character of its text while
     * its inline width is `max-content`, else 0 wide (jsdom lays nothing out). Returns how many
     * elements were measured.
     */
    function fakeContentWidths() {
        let measured = 0;
        vi.spyOn(
            HTMLElement.prototype,
            "getBoundingClientRect",
        ).mockImplementation(function (this: HTMLElement) {
            const content = this.style.width === "max-content";
            if (content) measured += 1;
            return DOMRect.fromRect({
                width: content ? (this.textContent?.length ?? 0) * 8 : 0,
                height: 20,
            });
        });
        return () => measured;
    }

    /** The widest of a column's rendered cells as the fake measures it: 8px a character. */
    function fakedWidth(container: HTMLElement, columnIndex: number) {
        const cells = container.querySelectorAll(
            `[data-row-index][data-column-index="${columnIndex}"]`,
        );
        return Math.max(
            ...[...cells].map((cell) => (cell.textContent?.length ?? 0) * 8),
        );
    }

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each([
        ["divs", false],
        ["a table", true],
    ])(
        "gives flex columns their share of the view on screen, as %s",
        (_, table) => {
            const onColumnWidthsChange = vi.fn();
            const { container, grid } = withRef({
                cells: flexing,
                table,
                onColumnWidthsChange,
            });
            // 520 left of 600: "age" stops at 120, "name" takes the rest
            expect(widthsOf(container, 0)).toEqual(["400px", "400px"]);
            expect(widthsOf(container, 1)).toEqual(["120px", "120px"]);
            expect(headerAt(container, 2).style.left).toBe("520px");
            // the handle and its state read the width on screen; the limits are the column's
            const name = resizerOf(container, "name");
            expect(name).toHaveAttribute("aria-valuenow", "400");
            expect(name).toHaveAttribute("aria-valuemin", "40");
            expect(name).toHaveAttribute("aria-valuemax", "600");
            expect(states.get("name")?.width).toBe(400);
            expect(resizerOf(container, "age")).toHaveAttribute(
                "aria-valuenow",
                "120",
            );
            // the shares are the engine's, never the model's widths
            expect(grid().engine.get("column-auto-widths")).toEqual({
                name: 400,
                age: 120,
            });
            expect(grid().model.get("column-widths")).toEqual({});
            expect(onColumnWidthsChange).not.toHaveBeenCalled();
        },
    );

    it("gives a group's handle its flex columns' widths on screen", () => {
        const { container } = render(
            <Grid
                cells={[
                    {
                        key: "person",
                        name: "Person",
                        children: flexing.slice(0, 2),
                    },
                    { key: "rest", name: "Rest", children: flexing.slice(2) },
                ]}
            />,
        );
        expect(resizerOf(container, "person")).toHaveAttribute(
            "aria-valuenow",
            "520",
        );
        expect(states.get("person")?.width).toBe(520);
    });

    it("makes a resized flex column fixed, and a reset makes it flex again", () => {
        const onColumnWidthsChange = vi.fn();
        const { container, grid, resize } = withRef({
            cells: flexing,
            onColumnWidthsChange,
        });
        resize("name", 200);
        expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ name: 200 });
        // "age" keeps its maximum: the view is not filled
        expect(widthsOf(container, 0)).toEqual(["200px", "200px"]);
        expect(resizerOf(container, "name")).toHaveAttribute(
            "aria-valuenow",
            "200",
        );
        act(() => {
            grid().model.run("column-widths.reset", { columnKey: "name" });
        });
        expect(onColumnWidthsChange).toHaveBeenLastCalledWith({});
        expect(widthsOf(container, 0)).toEqual(["400px", "400px"]);
        expect(resizerOf(container, "name")).toHaveAttribute(
            "aria-valuenow",
            "400",
        );
    });

    it("fits an autoSize column once its rows render: the grid's width, never reported", () => {
        const measured = fakeContentWidths();
        const onColumnWidthsChange = vi.fn();
        const { container, grid, resize } = withRef({
            cells: [
                {
                    key: "name",
                    name: "Name",
                    width: 150,
                    resizable: true,
                    autoSize: true,
                },
                ...columns.slice(1),
            ],
            onColumnWidthsChange,
        });
        // its widest rendered text, "Person 10", 9 characters
        expect(fakedWidth(container, 0)).toBe(72);
        expect(widthsOf(container, 0)).toEqual(["72px", "72px"]);
        expect(resizerOf(container, "name")).toHaveAttribute(
            "aria-valuenow",
            "72",
        );
        expect(states.get("name")?.width).toBe(72);
        expect(grid().engine.get("column-auto-widths")).toEqual({ name: 72 });
        expect(onColumnWidthsChange).not.toHaveBeenCalled();
        // once: a resize and a reset measure nothing again, the reset gives its width back
        const count = measured();
        resize("name", 200);
        expect(widthsOf(container, 0)).toEqual(["200px", "200px"]);
        act(() => {
            grid().model.run("column-widths.reset", {});
        });
        expect(widthsOf(container, 0)).toEqual(["72px", "72px"]);
        expect(measured()).toBe(count);
    });

    it("fits every rendered resizable column with fit-columns, in one change", () => {
        fakeContentWidths();
        const onColumnWidthsChange = vi.fn();
        const { container, grid } = withRef({ onColumnWidthsChange });
        // the premise: "name" measures within its limits, "age" under its 60px minimum
        expect(fakedWidth(container, 0)).toBe(72);
        expect(fakedWidth(container, 1)).toBeGreaterThan(0);
        expect(fakedWidth(container, 1)).toBeLessThan(60);
        act(() => {
            grid().engine.run("fit-columns", {});
        });
        // "age" at its minimum; "id" does not resize
        expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
        expect(onColumnWidthsChange).toHaveBeenLastCalledWith({
            name: 72,
            age: 60,
        });
        expect(widthsOf(container, 0)).toEqual(["72px", "72px"]);
        expect(resizerOf(container, "age")).toHaveAttribute(
            "aria-valuenow",
            "60",
        );
        expect(widthsOf(container, 2)).toEqual(["80px", "80px"]);
    });

    it("measures nothing and has no widths of its own without flex or autoSize", () => {
        const measured = fakeContentWidths();
        const { grid } = withRef({});
        expect(grid().engine.get("column-auto-widths")).toEqual({});
        expect(measured()).toBe(0);
    });
});
