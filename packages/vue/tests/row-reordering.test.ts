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
    defineComponent,
    type PropType,
    type ShallowRef,
    shallowRef,
    type VNodeChild,
} from "vue";
import {
    type CellInfo,
    type CellPosition,
    type Column,
    createDataGridRef,
    type DataGridRef,
    type RowInfo,
    type RowMove,
    type RowState,
    typedDataGrid,
} from "../src";
import { useLocalRows } from "../src/local";
import { useRowDragHandle } from "../src/row-reorder";
import { type SortColumn, sorting } from "../src/sorting";
import {
    FEATURES as ALL,
    cellAt,
    fire,
    h,
    keyDown,
    pointerDown,
    renderGrid,
    root,
    rowAt,
    settled,
    stubViewportSize,
    tags,
} from "./helpers";

// Row reordering (Epic #86, E2.3): `onRowMove` on `Root` makes the rows move, the app moving them
// in its own rows; `useRowDragHandle`'s props on the app's handle, the rows'
// `data-dragging`/`data-drop-target` and their state, the keys, the active cell following its
// row, and `useLocalRows`'s `moveRow`, in both structures. The drag's rules and the edge scroll
// are the engine's (core tests, the shared e2e spec).

interface Task {
    id: number;
    title: string;
}

const FEATURES = [sorting(), ...ALL] as const;

const G = typedDataGrid<Task, typeof FEATURES>();

const tasks: Task[] = Array.from({ length: 10 }, (_, id) => ({
    id,
    title: `Task ${id}`,
}));

const columns: Column<Task, VNodeChild>[] = [
    { key: "title", name: "Title", width: 200, sortable: true },
    { key: "id", name: "#", width: 100 },
];

stubViewportSize(400, 300);

/** The states the rows rendered last, by index. */
const states = new Map<number, RowState>();

/** The app's handle, in a row's first cell: the composable's props on an element of its own. */
const Handle = defineComponent({
    props: {
        cell: { type: Object as PropType<CellInfo<Task>>, required: true },
    },
    setup(props) {
        const { state, props: own } = useRowDragHandle(() => props.cell);
        return () =>
            h(
                "span",
                {
                    ...own.value,
                    "data-testid": `handle-${props.cell.rowIndex}`,
                },
                state.value.reorderable ? "⋮" : "",
            );
    },
});

interface GridProps {
    onRowMove?: ((move: RowMove) => void) | undefined;
    activePosition?: CellPosition | null;
    onActivePositionChange?: (position: CellPosition | null) => void;
    sortColumns?: readonly SortColumn[];
    gridRef?: DataGridRef<Task>;
    rows?: readonly Task[];
    table?: boolean;
}

function grid({ rows = tasks, table = false, ...props }: GridProps) {
    const tag = tags(table);
    return h(
        G.Root,
        {
            columns,
            rows,
            rowKey: (row: Task) => row.id,
            rowHeight: 20,
            headerRowHeight: 20,
            features: FEATURES,
            ...props,
        },
        () => [
            h(G.Grid, { as: tag.grid }, () => [
                h(G.Header, { as: tag.header }, () => [
                    h(G.HeaderRow, { as: tag.headerRow }),
                ]),
                h(G.Body, { as: tag.body }, () => [
                    h(G.Rows, null, {
                        default: ({ row }: { row: RowInfo<Task> }) => [
                            h(
                                G.Row,
                                { row, as: tag.row },
                                {
                                    // the row's state, as it renders
                                    default: ({
                                        state,
                                    }: {
                                        state: RowState;
                                    }) => {
                                        states.set(state.rowIndex, state);
                                        return [
                                            h(G.Cells, null, {
                                                default: ({
                                                    cell,
                                                }: {
                                                    cell: CellInfo<Task>;
                                                }) => [
                                                    h(
                                                        G.Cell,
                                                        { cell, as: tag.cell },
                                                        cell.columnIndex === 0
                                                            ? {
                                                                  default:
                                                                      () => [
                                                                          h(
                                                                              Handle,
                                                                              {
                                                                                  cell,
                                                                              },
                                                                          ),
                                                                          String(
                                                                              cell.value,
                                                                          ),
                                                                      ],
                                                              }
                                                            : undefined,
                                                    ),
                                                ],
                                            }),
                                        ];
                                    },
                                },
                            ),
                        ],
                    }),
                ]),
            ]),
        ],
    );
}

/** Mounts the grid with `props`; `update` gives it new ones (a parent re-rendering). */
function mountGrid(props: GridProps) {
    const current: ShallowRef<GridProps> = shallowRef(props);
    const mounted = renderGrid(() => grid(current.value));
    return {
        ...mounted,
        update: async (next: GridProps) => {
            current.value = next;
            await settled();
        },
    };
}

/** the last app's grid */
let latestRef: DataGridRef<Task, typeof FEATURES> | undefined;

/** The app: its rows in its state, each move applied, the moves kept. */
function mountApp({
    table = false,
    onMove,
}: {
    table?: boolean;
    onMove?: (move: RowMove) => void;
}) {
    const rows = shallowRef<readonly Task[]>(tasks);
    const gridRef = createDataGridRef<Task, typeof FEATURES>();
    latestRef = gridRef;
    return renderGrid(() =>
        grid({
            table,
            rows: rows.value,
            gridRef,
            onRowMove: (move) => {
                onMove?.(move);
                const current = rows.value;
                const rest = current.filter(
                    (_, index) => index !== move.fromIndex,
                );
                rows.value = [
                    ...rest.slice(0, move.toIndex),
                    ...current.slice(move.fromIndex, move.fromIndex + 1),
                    ...rest.slice(move.toIndex),
                ];
            },
        }),
    );
}

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

/** A pointer event of `type` on `target`, bubbling and cancelable. */
function pointer(type: string, target: EventTarget, init: PointerEventInit) {
    const Pointer =
        typeof PointerEvent === "function" ? PointerEvent : MouseEvent;
    return fire(
        target,
        new Pointer(type, { bubbles: true, cancelable: true, ...init }),
    );
}

// rows of 20px under a 20px header: row `i`'s cells' middle at 30 + 20i (jsdom lays out at 0)
const middleOf = (rowIndex: number) => 30 + 20 * rowIndex;

describe("a row's drag handle", () => {
    it.each([
        ["divs", false],
        ["a table", true],
    ])(
        "marks the dragged row and the drop target, and tells one move, as %s",
        async (_, table) => {
            const onMove = vi.fn();
            const { container } = mountApp({ table, onMove });
            await settled();
            const first = handle(container, 1);
            expect(first).toHaveAttribute("aria-hidden", "true");
            expect(first).toHaveAttribute("data-grid-row-drag-handle", "1");
            expect(first).toHaveAttribute("data-grid-part", "row-drag-handle");
            expect(first).toHaveAttribute("data-reorderable", "");
            expect(first).not.toHaveAttribute("style");
            expect(rowAt(container, 1).tagName).toBe(table ? "TR" : "DIV");
            pointerDown(first, { pointerId: 1, clientY: middleOf(1) });
            await settled();
            // under the slop: no drag yet
            pointer("pointermove", first, {
                pointerId: 1,
                buttons: 1,
                clientY: middleOf(1) + 2,
            });
            await settled();
            expect(rowAt(container, 1)).not.toHaveAttribute("data-dragging");
            // row 3's lower half: after it
            pointer("pointermove", first, {
                pointerId: 1,
                buttons: 1,
                clientY: middleOf(3) + 5,
            });
            await settled();
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
            pointer("pointerup", first, {
                pointerId: 1,
                clientY: middleOf(3) + 5,
            });
            await settled();
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

    it("cancels on Escape: nothing moves", async () => {
        const onMove = vi.fn();
        const { container } = mountApp({ onMove });
        await settled();
        const first = handle(container, 1);
        pointerDown(first, { pointerId: 1, clientY: middleOf(1) });
        pointer("pointermove", first, {
            pointerId: 1,
            buttons: 1,
            clientY: middleOf(4),
        });
        await settled();
        expect(rowAt(container, 4)).toHaveAttribute("data-drop-target");
        keyDown(first, { key: "Escape" });
        await settled();
        expect(container.querySelectorAll("[data-dragging]")).toHaveLength(0);
        pointer("pointerup", first, { pointerId: 1, clientY: middleOf(4) });
        await settled();
        expect(onMove).not.toHaveBeenCalled();
    });

    it("does not drag under a sort, nor without onRowMove, which adds nothing to the rows", async () => {
        const onRowMove = vi.fn();
        const { container, update } = mountGrid({
            onRowMove,
            sortColumns: [{ columnKey: "title", direction: "ascending" }],
        });
        await settled();
        expect(handle(container, 1)).not.toHaveAttribute("data-reorderable");
        expect(handle(container, 1).textContent).toBe("");
        const press = async () => {
            const first = handle(container, 1);
            pointerDown(first, { pointerId: 1, clientY: middleOf(1) });
            pointer("pointermove", first, {
                pointerId: 1,
                buttons: 1,
                clientY: middleOf(4),
            });
            await settled();
            pointer("pointerup", first, { pointerId: 1, clientY: middleOf(4) });
            await settled();
        };
        await press();
        expect(onRowMove).not.toHaveBeenCalled();
        expect(states.get(1)).toMatchObject({
            dragging: false,
            dropTarget: null,
        });
        await update({});
        await press();
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

    it("keeps the dragged row rendered through the edge scroll, a controlled active cell untouched", async () => {
        const frames: FrameRequestCallback[] = [];
        vi.spyOn(window, "requestAnimationFrame").mockImplementation(
            (callback) => frames.push(callback),
        );
        vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
        const many = Array.from({ length: 60 }, (_, id) => ({
            id,
            title: `Task ${id}`,
        }));
        const onRowMove = vi.fn();
        const onActivePositionChange = vi.fn();
        // a parent that ignores every change of the active cell
        const { container } = mountGrid({
            rows: many,
            onRowMove,
            activePosition: { rowIndex: 0, columnIndex: 1 },
            onActivePositionChange,
        });
        await settled();
        const first = handle(container, 1);
        pointerDown(first, { pointerId: 1, clientY: middleOf(1) });
        // past the bottom edge: the rows scroll to the last one, a frame at a time
        pointer("pointermove", first, {
            pointerId: 1,
            buttons: 1,
            clientY: 400,
        });
        await settled();
        // 60 rows of 20px: about 50 frames of the edge scroll's 20px
        for (let i = 0; i < 100 && frames.length > 0; i++) {
            for (const frame of frames.splice(0)) frame(0);
            await settled();
        }
        expect(container.querySelector('[data-row-index="10"]')).toBeNull();
        expect(rowAt(container, 1)).toHaveAttribute("data-dragging", "");
        expect(rowAt(container, 59)).toHaveAttribute(
            "data-drop-target",
            "after",
        );
        pointer("pointerup", handle(container, 1), {
            pointerId: 1,
            clientY: 400,
        });
        await settled();
        expect(onRowMove).toHaveBeenCalledTimes(1);
        expect(onRowMove).toHaveBeenCalledWith({
            fromIndex: 1,
            toIndex: 59,
            rowKey: 1,
        });
        expect(onActivePositionChange).not.toHaveBeenCalled();
    });
});

describe("the keys", () => {
    it("move the active cell's row, and the active cell follows it", async () => {
        const onMove = vi.fn();
        const { container } = mountApp({ onMove });
        await settled();
        const cell = cellAt(container, 2, 1);
        cell.focus();
        await settled();
        keyDown(cell, { key: "ArrowDown", ctrlKey: true, shiftKey: true });
        await settled();
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
        keyDown(cellAt(container, 3, 1), {
            key: "ArrowUp",
            metaKey: true,
            shiftKey: true,
        });
        await settled();
        expect(ids(container)).toEqual(["0", "1", "2", "3", "4"]);
        expect(document.activeElement).toBe(cellAt(container, 2, 1));
        expect(root(container)).toBeInTheDocument();
    });
});

describe("useLocalRows' moveRow", () => {
    it("moves a row of a filter's beside the row it lands next to on screen", async () => {
        let move: ((move: RowMove) => void) | undefined;
        let shown: readonly Task[] = [];
        const Local = defineComponent({
            setup() {
                const rows = shallowRef<readonly Task[]>(tasks);
                const local = useLocalRows(() => rows.value, columns, {
                    defaultFilters: { id: [1, 3, 5, 7] },
                });
                move = (next) => {
                    rows.value = local.moveRow(next);
                };
                return () => {
                    shown = local.rows;
                    return null;
                };
            },
        });
        renderGrid(Local);
        await settled();
        expect(shown.map((task) => task.id)).toEqual([1, 3, 5, 7]);
        // 7 before 3, on screen
        move?.({ fromIndex: 3, toIndex: 1, rowKey: 7 });
        await settled();
        expect(shown.map((task) => task.id)).toEqual([1, 7, 3, 5]);
    });

    it("tells equal rows apart by their place: a page's rows move where they are", async () => {
        const letters: readonly string[] = ["x", "y", "x", "y", "x"];
        const letter: Column<string, VNodeChild>[] = [
            { key: "letter", width: 100, getValue: (row) => row },
        ];
        let result: readonly string[] = [];
        let shown: readonly string[] = [];
        const Paged = defineComponent({
            setup() {
                const local = useLocalRows(letters, letter, {
                    pageSize: 2,
                    defaultPageIndex: 1,
                });
                return () => {
                    shown = local.rows;
                    result = local.moveRow({ fromIndex: 0, toIndex: 1 });
                    return null;
                };
            },
        });
        renderGrid(Paged);
        await settled();
        expect(shown).toEqual(["x", "y"]);
        // the "x" at 2 and the "y" at 3 swapped, not the first ones
        expect(result).toEqual(["x", "y", "y", "x", "x"]);
    });

    it("is stable, and moves told before a render apply one after the other", async () => {
        const kept: ((move: {
            fromIndex: number;
            toIndex: number;
        }) => readonly Task[])[] = [];
        let shown: readonly Task[] = [];
        let apply: (moves: readonly RowMove[]) => void = () => {};
        const Local = defineComponent({
            setup() {
                const rows = shallowRef<readonly Task[]>(tasks);
                const local = useLocalRows(() => rows.value, columns);
                apply = (moves) => {
                    for (const next of moves) rows.value = local.moveRow(next);
                };
                return () => {
                    kept.push(local.moveRow);
                    shown = local.rows;
                    return null;
                };
            },
        });
        renderGrid(Local);
        await settled();
        // 0 to the end, then (the rows on screen moved by then) 1, now first, after 2
        apply([
            { fromIndex: 0, toIndex: 9, rowKey: 0 },
            { fromIndex: 0, toIndex: 1, rowKey: 1 },
        ]);
        await settled();
        expect(shown.map((task) => task.id)).toEqual([
            2, 1, 3, 4, 5, 6, 7, 8, 9, 0,
        ]);
        expect(new Set(kept).size).toBe(1);
    });
});
