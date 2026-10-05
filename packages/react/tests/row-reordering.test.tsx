import { act, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import {
    type CellInfo,
    type CellPosition,
    type Column,
    DataGrid,
    type DataGridRef,
    type RowMove,
    type RowState,
    type SortColumn,
    useDataGridRef,
    useRowDragHandle,
} from "../src";
import { useLocalRows } from "../src/local";
import { cellAt, root, rowAt, stubViewportSize, tags } from "./helpers";

// Row reordering (Epic #86, E2.3): `onRowMove` on `Root` makes the rows move, the app moving them
// in its own rows; `useRowDragHandle`'s props on the app's handle, the rows'
// `data-dragging`/`data-drop-target` and their state, the keys, the active cell following its
// row, and `useLocalRows`'s `moveRow`, in both structures. The drag's rules and the edge scroll
// are the engine's (core tests, the shared e2e spec).

interface Task {
    id: number;
    title: string;
}

const tasks: Task[] = Array.from({ length: 10 }, (_, id) => ({
    id,
    title: `Task ${id}`,
}));

const columns: Column<Task>[] = [
    { key: "title", name: "Title", width: 200, sortable: true },
    { key: "id", name: "#", width: 100 },
];

stubViewportSize(400, 300);

/** The states the rows rendered last, by index. */
const states = new Map<number, RowState>();

/** The app's handle, in a row's first cell: the hook's props on an element of its own. */
function Handle({ cell }: { cell: CellInfo<Task> }) {
    const { state, props } = useRowDragHandle(cell);
    return (
        <span {...props} data-testid={`handle-${cell.rowIndex}`}>
            {state.reorderable ? "⋮" : ""}
        </span>
    );
}

interface GridProps {
    onRowMove?: ((move: RowMove) => void) | undefined;
    activePosition?: CellPosition | null;
    onActivePositionChange?: (position: CellPosition | null) => void;
    sortColumns?: readonly SortColumn[];
    gridRef?: DataGridRef<Task>;
    rows?: readonly Task[];
    table?: boolean;
}

function Grid({ rows = tasks, table = false, ...props }: GridProps) {
    const tag = tags(table);
    return (
        <DataGrid.Root
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            rowHeight={20}
            headerRowHeight={20}
            {...props}
        >
            <DataGrid.Grid render={tag.grid}>
                <DataGrid.Header render={tag.header}>
                    <DataGrid.HeaderRow render={tag.headerRow} />
                </DataGrid.Header>
                <DataGrid.Body render={tag.body}>
                    <DataGrid.Rows<Task>>
                        {(row) => (
                            <DataGrid.Row
                                row={row}
                                render={tag.row}
                                className={(state) => {
                                    states.set(state.rowIndex, state);
                                    return undefined;
                                }}
                            >
                                <DataGrid.Cells<Task>>
                                    {(cell) => (
                                        <DataGrid.Cell
                                            cell={cell}
                                            render={tag.cell}
                                        >
                                            {cell.columnIndex === 0 ? (
                                                <>
                                                    <Handle cell={cell} />
                                                    {String(cell.value)}
                                                </>
                                            ) : undefined}
                                        </DataGrid.Cell>
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

/** The app: its rows in its state, each move applied, the moves kept. */
function App({
    table = false,
    onMove,
}: {
    table?: boolean;
    onMove?: (move: RowMove) => void;
}) {
    const [rows, setRows] = useState(tasks);
    const gridRef = useDataGridRef<Task>();
    latestRef = gridRef;
    return (
        <Grid
            table={table}
            rows={rows}
            gridRef={gridRef}
            onRowMove={(move) => {
                onMove?.(move);
                setRows((current) => {
                    const rest = current.filter(
                        (_, index) => index !== move.fromIndex,
                    );
                    return [
                        ...rest.slice(0, move.toIndex),
                        ...current.slice(move.fromIndex, move.fromIndex + 1),
                        ...rest.slice(move.toIndex),
                    ];
                });
            }}
        />
    );
}

/** the last `App`'s grid */
let latestRef: DataGridRef<Task> | undefined;

/** The ids of the first rows, in order. */
function ids(container: HTMLElement, count = 5): string[] {
    return Array.from(
        { length: count },
        (_, rowIndex) => cellAt(container, rowIndex, 1).textContent ?? "",
    );
}

const handle = (container: HTMLElement, rowIndex: number) => {
    const element = container.querySelector(
        `[data-testid="handle-${rowIndex}"]`,
    );
    if (!(element instanceof HTMLElement)) throw new Error("no handle");
    return element;
};

// rows of 20px under a 20px header: row `i`'s cells' middle at 30 + 20i (jsdom lays out at 0)
const middleOf = (rowIndex: number) => 30 + 20 * rowIndex;

describe("a row's drag handle", () => {
    it.each([
        ["divs", false],
        ["a table", true],
    ])(
        "marks the dragged row and the drop target, and tells one move, as %s",
        (_, table) => {
            const onMove = vi.fn();
            const { container } = render(<App table={table} onMove={onMove} />);
            const first = handle(container, 1);
            expect(first).toHaveAttribute("aria-hidden", "true");
            expect(first).toHaveAttribute("data-grid-row-drag-handle", "1");
            expect(first).toHaveAttribute("data-grid-part", "row-drag-handle");
            expect(first).toHaveAttribute("data-reorderable", "");
            expect(first).not.toHaveAttribute("style");
            expect(rowAt(container, 1).tagName).toBe(table ? "TR" : "DIV");
            fireEvent.pointerDown(first, {
                button: 0,
                pointerId: 1,
                clientY: middleOf(1),
            });
            // under the slop: no drag yet
            fireEvent.pointerMove(first, {
                pointerId: 1,
                buttons: 1,
                clientY: middleOf(1) + 2,
            });
            expect(rowAt(container, 1)).not.toHaveAttribute("data-dragging");
            // row 3's lower half: after it
            fireEvent.pointerMove(first, {
                pointerId: 1,
                buttons: 1,
                clientY: middleOf(3) + 5,
            });
            expect(rowAt(container, 1)).toHaveAttribute("data-dragging", "");
            expect(handle(container, 1)).toHaveAttribute("data-dragging", "");
            expect(rowAt(container, 3)).toHaveAttribute(
                "data-drop-target",
                "after",
            );
            expect(states.get(1)).toMatchObject({
                dragging: true,
                dropTarget: null,
            });
            expect(states.get(3)).toMatchObject({
                dragging: false,
                dropTarget: "after",
            });
            // nothing moves before the release
            expect(ids(container)).toEqual(["0", "1", "2", "3", "4"]);
            fireEvent.pointerUp(first, {
                pointerId: 1,
                clientY: middleOf(3) + 5,
            });
            expect(onMove).toHaveBeenCalledTimes(1);
            expect(onMove).toHaveBeenCalledWith({
                fromIndex: 1,
                toIndex: 3,
                rowKey: 1,
            });
            expect(ids(container)).toEqual(["0", "2", "3", "1", "4"]);
            expect(
                container.querySelectorAll(
                    "[data-dragging], [data-drop-target]",
                ),
            ).toHaveLength(0);
        },
    );

    it("cancels on Escape: nothing moves", () => {
        const onMove = vi.fn();
        const { container } = render(<App onMove={onMove} />);
        const first = handle(container, 1);
        fireEvent.pointerDown(first, {
            button: 0,
            pointerId: 1,
            clientY: middleOf(1),
        });
        fireEvent.pointerMove(first, {
            pointerId: 1,
            buttons: 1,
            clientY: middleOf(4),
        });
        expect(rowAt(container, 4)).toHaveAttribute("data-drop-target");
        fireEvent.keyDown(first, { key: "Escape" });
        expect(container.querySelectorAll("[data-dragging]")).toHaveLength(0);
        fireEvent.pointerUp(first, { pointerId: 1, clientY: middleOf(4) });
        expect(onMove).not.toHaveBeenCalled();
    });

    it("does not drag under a sort, nor without onRowMove, which adds nothing to the rows", () => {
        const onRowMove = vi.fn();
        const { container, rerender } = render(
            <Grid
                onRowMove={onRowMove}
                sortColumns={[{ columnKey: "title", direction: "ascending" }]}
            />,
        );
        expect(handle(container, 1)).not.toHaveAttribute("data-reorderable");
        expect(handle(container, 1).textContent).toBe("");
        const press = () => {
            const first = handle(container, 1);
            fireEvent.pointerDown(first, {
                button: 0,
                pointerId: 1,
                clientY: middleOf(1),
            });
            fireEvent.pointerMove(first, {
                pointerId: 1,
                buttons: 1,
                clientY: middleOf(4),
            });
            fireEvent.pointerUp(first, { pointerId: 1, clientY: middleOf(4) });
        };
        press();
        expect(onRowMove).not.toHaveBeenCalled();
        expect(states.get(1)).toMatchObject({
            dragging: false,
            dropTarget: null,
        });
        rerender(<Grid />);
        press();
        expect(states.get(1)).toMatchObject({
            dragging: undefined,
            dropTarget: undefined,
        });
        expect(
            container.querySelectorAll(
                '[data-grid-part="row"][data-dragging], [data-grid-part="row"][data-drop-target], [data-reorderable]',
            ),
        ).toHaveLength(0);
    });
});

describe("a drag far away", () => {
    // jsdom keeps no scroll: the roots' offsets are kept here, as a browser does
    const tops = new WeakMap<HTMLElement, number>();
    beforeAll(() => {
        Object.defineProperty(HTMLElement.prototype, "scrollTop", {
            configurable: true,
            get(this: HTMLElement) {
                return tops.get(this) ?? 0;
            },
            set(this: HTMLElement, value: number) {
                tops.set(this, value);
            },
        });
    });
    afterAll(() => {
        delete (HTMLElement.prototype as { scrollTop?: number }).scrollTop;
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("keeps the dragged row rendered through the edge scroll, a controlled active cell untouched", () => {
        const frames: FrameRequestCallback[] = [];
        vi.spyOn(window, "requestAnimationFrame").mockImplementation(
            (callback) => frames.push(callback),
        );
        vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
        const many = Array.from({ length: 200 }, (_, id) => ({
            id,
            title: `Task ${id}`,
        }));
        const onRowMove = vi.fn();
        const onActivePositionChange = vi.fn();
        // a parent that ignores every change of the active cell
        const { container } = render(
            <Grid
                rows={many}
                onRowMove={onRowMove}
                activePosition={{ rowIndex: 0, columnIndex: 1 }}
                onActivePositionChange={onActivePositionChange}
            />,
        );
        const first = handle(container, 1);
        fireEvent.pointerDown(first, {
            button: 0,
            pointerId: 1,
            clientY: middleOf(1),
        });
        // past the bottom edge: the rows scroll to the last one, a frame at a time
        fireEvent.pointerMove(first, {
            pointerId: 1,
            buttons: 1,
            clientY: 400,
        });
        for (let i = 0; i < 400 && frames.length > 0; i++) {
            act(() => {
                for (const frame of frames.splice(0)) frame(0);
            });
        }
        expect(container.querySelector('[data-row-index="10"]')).toBeNull();
        expect(rowAt(container, 1)).toHaveAttribute("data-dragging", "");
        expect(rowAt(container, 199)).toHaveAttribute(
            "data-drop-target",
            "after",
        );
        fireEvent.pointerUp(handle(container, 1), {
            pointerId: 1,
            clientY: 400,
        });
        expect(onRowMove).toHaveBeenCalledTimes(1);
        expect(onRowMove).toHaveBeenCalledWith({
            fromIndex: 1,
            toIndex: 199,
            rowKey: 1,
        });
        expect(onActivePositionChange).not.toHaveBeenCalled();
    });
});

describe("the keys", () => {
    it("move the active cell's row, and the active cell follows it", () => {
        const onMove = vi.fn();
        const { container } = render(<App onMove={onMove} />);
        const cell = cellAt(container, 2, 1);
        act(() => cell.focus());
        fireEvent.keyDown(cell, {
            key: "ArrowDown",
            ctrlKey: true,
            shiftKey: true,
        });
        expect(onMove).toHaveBeenCalledWith({
            fromIndex: 2,
            toIndex: 3,
            rowKey: 2,
        });
        expect(ids(container)).toEqual(["0", "1", "3", "2", "4"]);
        expect(latestRef?.current?.model.get("active-position")).toEqual({
            rowIndex: 3,
            columnIndex: 1,
        });
        // focus stays on its cell, now at its new index
        expect(document.activeElement).toBe(cellAt(container, 3, 1));
        expect(cellAt(container, 3, 1)).toHaveAttribute("tabindex", "0");
        fireEvent.keyDown(cellAt(container, 3, 1), {
            key: "ArrowUp",
            metaKey: true,
            shiftKey: true,
        });
        expect(ids(container)).toEqual(["0", "1", "2", "3", "4"]);
        expect(document.activeElement).toBe(cellAt(container, 2, 1));
        expect(root(container)).toBeInTheDocument();
    });
});

describe("useLocalRows' moveRow", () => {
    it("moves a row of a filter's beside the row it lands next to on screen", () => {
        let move: ((move: RowMove) => void) | undefined;
        let shown: readonly Task[] = [];
        function Local() {
            const [rows, setRows] = useState<readonly Task[]>(tasks);
            const local = useLocalRows(rows, columns, {
                defaultFilters: { id: [1, 3, 5, 7] },
            });
            shown = local.rows;
            move = (next) => setRows(local.moveRow(next));
            return null;
        }
        render(<Local />);
        expect(shown.map((task) => task.id)).toEqual([1, 3, 5, 7]);
        // 7 before 3, on screen
        act(() => move?.({ fromIndex: 3, toIndex: 1, rowKey: 7 }));
        expect(shown.map((task) => task.id)).toEqual([1, 7, 3, 5]);
    });

    it("tells equal rows apart by their place: a page's rows move where they are", () => {
        const letters: readonly string[] = ["x", "y", "x", "y", "x"];
        const letter: Column<string>[] = [
            { key: "letter", width: 100, getValue: (row) => row },
        ];
        let result: readonly string[] = [];
        let shown: readonly string[] = [];
        function Paged() {
            const local = useLocalRows(letters, letter, {
                pageSize: 2,
                defaultPageIndex: 1,
            });
            shown = local.rows;
            result = local.moveRow({ fromIndex: 0, toIndex: 1 });
            return null;
        }
        render(<Paged />);
        expect(shown).toEqual(["x", "y"]);
        // the "x" at 2 and the "y" at 3 swapped, not the first ones
        expect(result).toEqual(["x", "y", "y", "x", "x"]);
    });

    it("is stable, and moves told before a render apply one after the other", () => {
        const kept: ((move: {
            fromIndex: number;
            toIndex: number;
        }) => readonly Task[])[] = [];
        let shown: readonly Task[] = [];
        let apply: (moves: readonly RowMove[]) => void = () => {};
        function Local() {
            const [rows, setRows] = useState<readonly Task[]>(tasks);
            const local = useLocalRows(rows, columns);
            kept.push(local.moveRow);
            shown = local.rows;
            apply = (moves) => {
                for (const next of moves) setRows(local.moveRow(next));
            };
            return null;
        }
        render(<Local />);
        // 0 to the end, then (the rows on screen moved by then) 1, now first, after 2
        act(() =>
            apply([
                { fromIndex: 0, toIndex: 9, rowKey: 0 },
                { fromIndex: 0, toIndex: 1, rowKey: 1 },
            ]),
        );
        expect(shown.map((task) => task.id)).toEqual([
            2, 1, 3, 4, 5, 6, 7, 8, 9, 0,
        ]);
        expect(new Set(kept).size).toBe(1);
    });
});
