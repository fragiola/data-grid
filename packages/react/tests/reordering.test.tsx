import { act, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
    type CellPosition,
    type Column,
    type ColumnOrder,
    type ColumnOrGroup,
    DataGrid,
    type DataGridModel,
    type DataGridRef,
    type HeaderCellState,
    type RootProps,
    useDataGridRef,
} from "../src";
import { cellAt, headerAt, stubViewportSize, tags } from "./helpers";

// Column reordering (Epic #75): the order controlled or not on `Root` (O1), the header cells'
// `data-reorderable`/`data-dragging`/`data-drop-target` and their state (O4), in both
// structures. The drag's rules, the edge scroll and the keys are the engine's (core tests, the
// shared e2e spec).

interface Person {
    id: number;
    name: string;
}

const people: Person[] = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    name: `Person ${i}`,
}));

// four columns of 100px: a, b and c reorderable, d not
const columns: Column<Person>[] = ["a", "b", "c", "d"].map((key) => ({
    key,
    name: key.toUpperCase(),
    width: 100,
    getValue: (row) => `${row.id}${key}`,
    reorderable: key !== "d",
}));

const grouped: ColumnOrGroup<Person>[] = [
    {
        key: "first",
        name: "First",
        reorderable: true,
        children: columns.slice(0, 2),
    },
    { key: "rest", name: "Rest", children: columns.slice(2) },
];

stubViewportSize(600, 300);

/** The states the header cells rendered last, by key. */
const states = new Map<string, HeaderCellState>();

type GridProps = Pick<
    RootProps<Person>,
    | "columnOrder"
    | "defaultColumnOrder"
    | "onColumnOrderChange"
    | "activePosition"
    | "defaultActivePosition"
    | "onActivePositionChange"
    | "gridRef"
> & {
    cells?: readonly ColumnOrGroup<Person>[];
    table?: boolean;
};

function Grid({ cells = columns, table = false, ...props }: GridProps) {
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
                                            className={(state) => {
                                                states.set(cell.key, state);
                                                return undefined;
                                            }}
                                        >
                                            {cell.key}
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

/** The columns' header cells (the last header row's), left to right: their text. */
function headerOrder(container: HTMLElement): string[] {
    return [0, 1, 2, 3].map(
        (columnIndex) => cellAt(container, -1, columnIndex).textContent ?? "",
    );
}

/** The first row's cells, left to right: their text. */
function bodyOrder(container: HTMLElement): string[] {
    return [0, 1, 2, 3].map(
        (columnIndex) => cellAt(container, 0, columnIndex).textContent ?? "",
    );
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
    const move = (
        columnKey: string,
        targetKey: string,
        side: "before" | "after",
    ) =>
        act(() => {
            gridRef?.current?.model.run("column-order.move", {
                columnKey,
                targetKey,
                side,
            });
        });
    return {
        ...view,
        move,
        model: () => gridRef?.current?.model,
        rerender: (next: GridProps) => view.rerender(<App {...next} />),
    };
}

describe("uncontrolled", () => {
    it("starts with defaultColumnOrder, moves, and tells each change once", () => {
        const onColumnOrderChange = vi.fn();
        const { container, move } = withRef({
            defaultColumnOrder: ["c", "a"],
            onColumnOrderChange,
        });
        // the listed ones take the places of the listed ones, in its order
        expect(headerOrder(container)).toEqual(["c", "b", "a", "d"]);
        expect(bodyOrder(container)).toEqual(["0c", "0b", "0a", "0d"]);
        expect(onColumnOrderChange).not.toHaveBeenCalled();
        move("b", "d", "after");
        expect(onColumnOrderChange).toHaveBeenCalledTimes(1);
        expect(onColumnOrderChange).toHaveBeenLastCalledWith([
            "c",
            "a",
            "d",
            "b",
        ]);
        expect(headerOrder(container)).toEqual(["c", "a", "d", "b"]);
        expect(bodyOrder(container)).toEqual(["0c", "0a", "0d", "0b"]);
        // landing where it is: nothing told
        move("b", "d", "after");
        expect(onColumnOrderChange).toHaveBeenCalledTimes(1);
    });

    it("tells the app the order it starts with when one listed a key twice", () => {
        const onColumnOrderChange = vi.fn();
        const { container } = render(
            <Grid
                defaultColumnOrder={["b", "a", "b"]}
                onColumnOrderChange={onColumnOrderChange}
            />,
        );
        expect(onColumnOrderChange).toHaveBeenCalledTimes(1);
        expect(onColumnOrderChange).toHaveBeenCalledWith(["b", "a"]);
        expect(headerOrder(container)).toEqual(["b", "a", "c", "d"]);
    });
});

describe("controlled", () => {
    it("asks on a move, and shows the order only when the prop follows", () => {
        const onColumnOrderChange = vi.fn();
        const { container, move, rerender } = withRef({
            columnOrder: [],
            onColumnOrderChange,
        });
        move("a", "c", "after");
        expect(onColumnOrderChange).toHaveBeenCalledWith(["b", "c", "a", "d"]);
        expect(headerOrder(container)).toEqual(["a", "b", "c", "d"]);
        rerender({ columnOrder: ["b", "c", "a", "d"], onColumnOrderChange });
        expect(headerOrder(container)).toEqual(["b", "c", "a", "d"]);
        expect(bodyOrder(container)).toEqual(["0b", "0c", "0a", "0d"]);
        // the root's own sync is never told back
        expect(onColumnOrderChange).toHaveBeenCalledTimes(1);
    });

    it("keeps the keys of a controlled prop, and tells the parent the order it holds", () => {
        const onColumnOrderChange = vi.fn();
        const { container, model, rerender } = withRef({
            columnOrder: ["c", "c", "b"],
            onColumnOrderChange,
        });
        expect(headerOrder(container)).toEqual(["a", "c", "b", "d"]);
        expect(onColumnOrderChange).toHaveBeenLastCalledWith(["c", "b"]);
        const told = onColumnOrderChange.mock.calls.length;
        // a key that is no column is kept: it may come back
        rerender({ columnOrder: ["gone", "d", "a"], onColumnOrderChange });
        expect(headerOrder(container)).toEqual(["d", "b", "c", "a"]);
        expect(model()?.get("column-order")).toEqual(["gone", "d", "a"]);
        expect(onColumnOrderChange).toHaveBeenCalledTimes(told);
    });

    it("works with a parent that follows, a group moving whole", () => {
        let order: ColumnOrder = [];
        let gridRef: DataGridRef<Person> | undefined;
        function Parent() {
            const [columnOrder, setColumnOrder] = useState<ColumnOrder>([]);
            order = columnOrder;
            gridRef = useDataGridRef<Person>();
            return (
                <Grid
                    cells={grouped}
                    gridRef={gridRef}
                    columnOrder={columnOrder}
                    onColumnOrderChange={setColumnOrder}
                />
            );
        }
        const { container } = render(<Parent />);
        act(() => {
            gridRef?.current?.model.run("column-order.move", {
                columnKey: "first",
                targetKey: "rest",
                side: "after",
            });
        });
        expect(order).toEqual(["rest", "first"]);
        expect(headerOrder(container)).toEqual(["c", "d", "a", "b"]);
        act(() => {
            gridRef?.current?.model.run("column-order.reset", {});
        });
        expect(order).toEqual([]);
        expect(headerOrder(container)).toEqual(["a", "b", "c", "d"]);
    });
});

describe("the active cell", () => {
    /** The positions `active-position.set` runs with from now on (a middleware's spy). */
    function positionsSet(model: DataGridModel<Person> | undefined) {
        const set: unknown[] = [];
        model?.use((ctx, next) => {
            if (ctx.command === "active-position.set") set.push(ctx.payload);
            return next();
        });
        return set;
    }

    it("follows its column when a controlled order follows, and the app is told", () => {
        const onActivePositionChange = vi.fn();
        const { container, rerender } = withRef({
            columnOrder: [],
            defaultActivePosition: { rowIndex: 2, columnIndex: 0 },
            onActivePositionChange,
        });
        rerender({
            columnOrder: ["b", "a"],
            onActivePositionChange,
        });
        expect(onActivePositionChange).toHaveBeenCalledTimes(1);
        expect(onActivePositionChange).toHaveBeenCalledWith({
            rowIndex: 2,
            columnIndex: 1,
        });
        expect(cellAt(container, 2, 1)).toHaveAttribute("data-active", "");
        expect(cellAt(container, 2, 1).textContent).toBe("2a");
    });

    it("follows its column with the order and the position both controlled, never back to its old place", () => {
        const onActivePositionChange = vi.fn();
        let gridRef: DataGridRef<Person> | undefined;
        function Parent() {
            const [columnOrder, setColumnOrder] = useState<ColumnOrder>([]);
            const [activePosition, setActivePosition] =
                useState<CellPosition | null>({ rowIndex: -1, columnIndex: 0 });
            gridRef = useDataGridRef<Person>();
            return (
                <Grid
                    gridRef={gridRef}
                    columnOrder={columnOrder}
                    onColumnOrderChange={setColumnOrder}
                    activePosition={activePosition}
                    onActivePositionChange={(position) => {
                        onActivePositionChange(position);
                        setActivePosition(position);
                    }}
                />
            );
        }
        const { container } = render(<Parent />);
        const a = headerAt(container, 0);
        act(() => a.focus());
        onActivePositionChange.mockClear();
        const set = positionsSet(gridRef?.current?.model);
        fireEvent.keyDown(a, {
            key: "ArrowRight",
            ctrlKey: true,
            shiftKey: true,
        });
        expect(headerOrder(container)).toEqual(["b", "a", "c", "d"]);
        expect(set).not.toContainEqual({ rowIndex: -1, columnIndex: 0 });
        expect(onActivePositionChange).toHaveBeenCalledTimes(1);
        expect(onActivePositionChange).toHaveBeenCalledWith({
            rowIndex: -1,
            columnIndex: 1,
        });
        expect(headerAt(container, 1)).toHaveAttribute("data-active", "");
        expect(headerAt(container, 1).textContent).toBe("a");
    });

    it("takes a new controlled position given in the same render as a new order", () => {
        const onActivePositionChange = vi.fn();
        const { container, model, rerender } = withRef({
            columnOrder: [],
            activePosition: { rowIndex: 2, columnIndex: 0 },
            onActivePositionChange,
        });
        rerender({
            columnOrder: ["b", "a"],
            activePosition: { rowIndex: 3, columnIndex: 2 },
            onActivePositionChange,
        });
        expect(model()?.get("active-position")).toEqual({
            rowIndex: 3,
            columnIndex: 2,
        });
        expect(cellAt(container, 3, 2)).toHaveAttribute("data-active", "");
        expect(onActivePositionChange).not.toHaveBeenCalled();
    });

    it("keeps the cell the order moved when the parent keeps its old position, told once", () => {
        const onActivePositionChange = vi.fn();
        const { container, model, rerender } = withRef({
            columnOrder: [],
            activePosition: { rowIndex: 2, columnIndex: 0 },
            onActivePositionChange,
        });
        const set = positionsSet(model());
        rerender({
            columnOrder: ["b", "a"],
            activePosition: { rowIndex: 2, columnIndex: 0 },
            onActivePositionChange,
        });
        expect(set).toEqual([]);
        expect(model()?.get("active-position")).toEqual({
            rowIndex: 2,
            columnIndex: 1,
        });
        expect(cellAt(container, 2, 1)).toHaveAttribute("data-active", "");
        expect(cellAt(container, 2, 1).textContent).toBe("2a");
        expect(onActivePositionChange).toHaveBeenCalledTimes(1);
        expect(onActivePositionChange).toHaveBeenCalledWith({
            rowIndex: 2,
            columnIndex: 1,
        });
    });
});

describe("an uncontrolled order and a controlled position", () => {
    it("keeps the position a move carried with its column when the parent keeps its old one, told once", () => {
        const onActivePositionChange = vi.fn();
        const props: GridProps = {
            defaultColumnOrder: [],
            activePosition: { rowIndex: -1, columnIndex: 0 },
            onActivePositionChange,
        };
        const { container, model, rerender } = withRef(props);
        const a = headerAt(container, 0);
        act(() => a.focus());
        const set: unknown[] = [];
        model()?.use((ctx, next) => {
            if (ctx.command === "active-position.set") set.push(ctx.payload);
            return next();
        });
        // the order's own commit moves the position in the same commit
        fireEvent.keyDown(a, {
            key: "ArrowRight",
            ctrlKey: true,
            shiftKey: true,
        });
        expect(headerOrder(container)).toEqual(["b", "a", "c", "d"]);
        expect(onActivePositionChange).toHaveBeenCalledTimes(1);
        expect(onActivePositionChange).toHaveBeenCalledWith({
            rowIndex: -1,
            columnIndex: 1,
        });
        // the parent renders again with its old position: it never pulls the cell back
        rerender({ ...props });
        expect(set).toEqual([]);
        expect(model()?.get("active-position")).toEqual({
            rowIndex: -1,
            columnIndex: 1,
        });
        expect(headerAt(container, 1)).toHaveAttribute("data-active", "");
        expect(headerAt(container, 1).textContent).toBe("a");
        expect(onActivePositionChange).toHaveBeenCalledTimes(1);
        // a position the parent changes wins again
        rerender({ ...props, activePosition: { rowIndex: 2, columnIndex: 3 } });
        expect(model()?.get("active-position")).toEqual({
            rowIndex: 2,
            columnIndex: 3,
        });
    });
});

describe("a header cell's drag", () => {
    const press = (target: HTMLElement, clientX: number) =>
        fireEvent.pointerDown(target, { button: 0, pointerId: 1, clientX });
    const move = (target: HTMLElement, clientX: number) =>
        fireEvent.pointerMove(target, { pointerId: 1, buttons: 1, clientX });

    it("marks the dragged cell and the drop target, and moves the column on release", () => {
        const onColumnOrderChange = vi.fn();
        const { container } = render(
            <Grid onColumnOrderChange={onColumnOrderChange} />,
        );
        const a = headerAt(container, 0);
        press(a, 50);
        // under the slop: no drag yet
        move(a, 52);
        expect(a).not.toHaveAttribute("data-dragging");
        // past c's middle (250): after it
        move(a, 260);
        expect(a).toHaveAttribute("data-dragging", "");
        expect(headerAt(container, 2)).toHaveAttribute(
            "data-drop-target",
            "after",
        );
        expect(states.get("a")).toMatchObject({
            reorderable: true,
            dragging: true,
            dropTarget: null,
        });
        expect(states.get("c")).toMatchObject({
            dragging: false,
            dropTarget: "after",
        });
        fireEvent.pointerUp(a, { pointerId: 1, clientX: 260 });
        expect(onColumnOrderChange).toHaveBeenCalledTimes(1);
        expect(onColumnOrderChange).toHaveBeenCalledWith(["b", "c", "a", "d"]);
        expect(headerOrder(container)).toEqual(["b", "c", "a", "d"]);
        expect(
            container.querySelectorAll("[data-dragging], [data-drop-target]"),
        ).toHaveLength(0);
    });

    it("cancels on Escape: nothing moves", () => {
        const onColumnOrderChange = vi.fn();
        const { container } = render(
            <Grid onColumnOrderChange={onColumnOrderChange} />,
        );
        const a = headerAt(container, 0);
        press(a, 50);
        move(a, 160);
        expect(headerAt(container, 1)).toHaveAttribute(
            "data-drop-target",
            "after",
        );
        fireEvent.keyDown(a, { key: "Escape" });
        expect(a).not.toHaveAttribute("data-dragging");
        fireEvent.pointerUp(a, { pointerId: 1, clientX: 160 });
        expect(onColumnOrderChange).not.toHaveBeenCalled();
        expect(headerOrder(container)).toEqual(["a", "b", "c", "d"]);
    });
});

describe("the keys", () => {
    it("move the active header cell's column, Ctrl+Shift with the arrows", () => {
        const onColumnOrderChange = vi.fn();
        const { container, model } = withRef({ onColumnOrderChange });
        const a = headerAt(container, 0);
        act(() => a.focus());
        fireEvent.keyDown(a, {
            key: "ArrowRight",
            ctrlKey: true,
            shiftKey: true,
        });
        expect(onColumnOrderChange).toHaveBeenCalledWith(["b", "a", "c", "d"]);
        expect(headerOrder(container)).toEqual(["b", "a", "c", "d"]);
        expect(model()?.get("active-position")).toEqual({
            rowIndex: -1,
            columnIndex: 1,
        });
    });
});

describe("structure", () => {
    it.each([
        ["divs", false],
        ["a table", true],
    ])("marks reorderable header cells, and a drag's, as %s", (_, table) => {
        const { container } = render(<Grid cells={grouped} table={table} />);
        const marked = () =>
            [
                ...container.querySelectorAll('[data-grid-part="header-cell"]'),
            ].map((cell) => [
                cell.textContent,
                cell.tagName,
                cell.hasAttribute("data-reorderable"),
                cell.hasAttribute("data-dragging"),
                cell.getAttribute("data-drop-target"),
            ]);
        const tag = table ? "TH" : "DIV";
        expect(marked()).toEqual([
            ["first", tag, true, false, null],
            ["rest", tag, false, false, null],
            ["a", tag, true, false, null],
            ["b", tag, true, false, null],
            ["c", tag, true, false, null],
            ["d", tag, false, false, null],
        ]);
        // a group drags among its siblings: over the rest's second half, after it
        const first = cellAt(container, -2, 0);
        fireEvent.pointerDown(first, { button: 0, pointerId: 1, clientX: 50 });
        fireEvent.pointerMove(first, {
            pointerId: 1,
            buttons: 1,
            clientX: 380,
        });
        expect(marked().slice(0, 2)).toEqual([
            ["first", tag, true, true, null],
            ["rest", tag, false, false, "after"],
        ]);
        fireEvent.pointerUp(first, { pointerId: 1, clientX: 380 });
        expect(headerOrder(container)).toEqual(["c", "d", "a", "b"]);
    });

    it("adds no attribute to a grid without reorderable columns", () => {
        const { container } = render(
            <Grid
                cells={columns.map(
                    ({ reorderable: _reorderable, ...column }) => column,
                )}
            />,
        );
        const a = headerAt(container, 0);
        fireEvent.pointerDown(a, { button: 0, pointerId: 1, clientX: 50 });
        fireEvent.pointerMove(a, { pointerId: 1, buttons: 1, clientX: 260 });
        fireEvent.pointerUp(a, { pointerId: 1, clientX: 260 });
        expect(
            container.querySelectorAll(
                "[data-reorderable], [data-dragging], [data-drop-target]",
            ),
        ).toHaveLength(0);
        expect(headerOrder(container)).toEqual(["a", "b", "c", "d"]);
    });
});
