import {
    ChangeDetectionStrategy,
    Component,
    input,
    signal,
} from "@angular/core";
import type { ComponentFixture } from "@angular/core/testing";
import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { injectLocalRows } from "../src/local";
import {
    type CellPosition,
    type Column,
    createDataGridRef,
    DATA_GRID,
    type DataGridNode,
    type DataGridRef,
    type RowMove,
    type RowState,
} from "../src/public-api";
import { DataGridSorting, type SortColumn, sorting } from "../src/sorting";
import {
    cellAt,
    fire,
    keyDown,
    pointerDown,
    render,
    root,
    rowAt,
    settled,
    stubViewportSize,
} from "./helpers";

// Row reordering (Epic #86, E2.3): `reorderableRows` on the root makes the rows move, told by
// `rowMove`, the app moving them in its own rows; `[dataGridRowDragHandle]` on the app's handle,
// the rows' `data-dragging`/`data-drop-target` and their state, the keys, the active cell
// following its row, and `injectLocalRows`'s `moveRow`, in both structures. The drag's rules and
// the edge scroll are the engine's (core tests, the shared e2e spec).

interface Task {
    id: number;
    title: string;
}

const tasks: Task[] = Array.from({ length: 10 }, (_, id) => ({
    id,
    title: `Task ${id}`,
}));

const columns: Column<Task, DataGridNode>[] = [
    { key: "title", name: "Title", width: 200, sortable: true },
    { key: "id", name: "#", width: 100 },
];

stubViewportSize(400, 300);

/** The states the rows rendered last, by index. */
const states = new Map<number, RowState>();

/** What the tests give the grid (React's root props). */
interface GridProps {
    onRowMove?: ((move: RowMove) => void) | undefined;
    activePosition?: CellPosition | null;
    onActivePositionChange?: (position: CellPosition | null) => void;
    sortColumns?: readonly SortColumn[];
}

/** A body cell: in the first column, the app's handle (a directive on its own span) and the value. */
const CELL = `@if (cell.columnIndex === 0) {<span [dataGridRowDragHandle]="cell" #handle="dataGridRowDragHandle" [attr.data-testid]="'handle-' + cell.rowIndex">{{ handle.state()?.reorderable ? "⋮" : "" }}</span>{{ cell.value }}} @else {<ng-container *dataGridCellContent />}`;

@Component({
    imports: [DATA_GRID, DataGridSorting],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div dataGridRoot [columns]="columns" [rows]="rows()" [rowKey]="rowKey" [rowHeight]="20" [headerRowHeight]="20"
            [gridRef]="gridRef()"
            [reorderableRows]="!!props().onRowMove" (rowMove)="props().onRowMove?.($event)"
            [activePosition]="props().activePosition" (activePositionChange)="props().onActivePositionChange?.($event)"
            [features]="features" dataGridSorting [sortColumns]="props().sortColumns">
            @if (table()) {
                <table dataGridGrid>
                    <thead *dataGridHeader>
                        <ng-template dataGridHeaderRows let-row>
                            <tr [dataGridHeaderRow]="row">
                                <ng-template dataGridHeaderCells let-cell>
                                    <th [dataGridHeaderCell]="cell"><ng-container *dataGridCellContent /></th>
                                </ng-template>
                            </tr>
                        </ng-template>
                    </thead>
                    <tbody dataGridBody>
                        <ng-template dataGridRows let-row>
                            <tr [dataGridRow]="row" #state="dataGridRow">{{ record(state.state()) }}
                                <ng-template dataGridCells let-cell>
                                    <td [dataGridCell]="cell">${CELL}</td>
                                </ng-template>
                            </tr>
                        </ng-template>
                    </tbody>
                </table>
            } @else {
                <div dataGridGrid>
                    <div *dataGridHeader>
                        <ng-template dataGridHeaderRows let-row>
                            <div [dataGridHeaderRow]="row">
                                <ng-template dataGridHeaderCells let-cell>
                                    <div [dataGridHeaderCell]="cell"><ng-container *dataGridCellContent /></div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                    <div dataGridBody>
                        <ng-template dataGridRows let-row>
                            <div [dataGridRow]="row" #state="dataGridRow">{{ record(state.state()) }}
                                <ng-template dataGridCells let-cell>
                                    <div [dataGridCell]="cell">${CELL}</div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                </div>
            }
        </div>
    `,
})
class Tasks {
    readonly features = [sorting()];
    readonly rows = input<readonly Task[]>(tasks);
    readonly table = input(false);
    readonly props = input<GridProps>({});
    readonly gridRef = input<DataGridRef<Task> | undefined>(undefined);
    readonly columns = columns;
    readonly rowKey = (row: Task) => row.id;

    /** the row's state, as it renders */
    record(state: RowState | undefined) {
        if (!state) return "";
        states.set(state.rowIndex, state);
        return "";
    }
}

/** Mounts the grid with `props`; `update` gives it new ones (a parent rendering again). */
async function mountGrid(props: GridProps, rows: readonly Task[] = tasks) {
    const mounted = await render(Tasks, (fixture) => {
        fixture.componentRef.setInput("props", props);
        fixture.componentRef.setInput("rows", rows);
    });
    return {
        ...mounted,
        update: async (next: GridProps) => {
            mounted.fixture.componentRef.setInput("props", next);
            await settled(mounted.fixture);
        },
    };
}

/** the last app's grid */
let latestRef: DataGridRef<Task> | undefined;

/** The app: its rows in its state, each move applied, the moves kept. */
function mountApp({
    table = false,
    onMove,
}: {
    table?: boolean;
    onMove?: (move: RowMove) => void;
}) {
    let rows: readonly Task[] = tasks;
    const gridRef = createDataGridRef<Task>();
    latestRef = gridRef;
    let fixture: ComponentFixture<Tasks> | undefined;
    return render(Tasks, (created) => {
        fixture = created;
        created.componentRef.setInput("table", table);
        created.componentRef.setInput("gridRef", gridRef);
        created.componentRef.setInput("props", {
            onRowMove: (move: RowMove) => {
                onMove?.(move);
                const current = rows;
                const rest = current.filter(
                    (_, index) => index !== move.fromIndex,
                );
                rows = [
                    ...rest.slice(0, move.toIndex),
                    ...current.slice(move.fromIndex, move.fromIndex + 1),
                    ...rest.slice(move.toIndex),
                ];
                fixture?.componentRef.setInput("rows", rows);
            },
        } satisfies GridProps);
    });
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
            const { container } = await mountApp({ table, onMove });
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
        const { container } = await mountApp({ onMove });
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

    it("does not drag under a sort, nor without reorderableRows, which adds nothing to the rows", async () => {
        const onRowMove = vi.fn();
        const { container, update } = await mountGrid({
            onRowMove,
            sortColumns: [{ columnKey: "title", direction: "ascending" }],
        });
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
        const { container } = await mountGrid(
            {
                onRowMove,
                activePosition: { rowIndex: 0, columnIndex: 1 },
                onActivePositionChange,
            },
            many,
        );
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
        const { container } = await mountApp({ onMove });
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

    it("render the app's moved rows before the next key, as React and Vue do (a key pressed fast moves the row again)", async () => {
        const onMove = vi.fn();
        const { container } = await mountApp({ onMove });
        const cell = cellAt(container, 0, 1);
        cell.focus();
        await settled();
        keyDown(cell, { key: "ArrowDown", ctrlKey: true, shiftKey: true });
        // the next key comes in a later task: by then, the moved rows are rendered and the
        // active cell has followed its row (no frame or timer in between)
        for (let i = 0; i < 10; i++) await Promise.resolve();
        expect(ids(container)).toEqual(["1", "0", "2", "3", "4"]);
        const active = document.activeElement as HTMLElement;
        expect(active).toBe(cellAt(container, 1, 1));
        keyDown(active, { key: "ArrowDown", ctrlKey: true, shiftKey: true });
        await settled();
        expect(onMove).toHaveBeenLastCalledWith({
            fromIndex: 1,
            toIndex: 2,
            rowKey: 0,
        });
        expect(ids(container)).toEqual(["1", "2", "0", "3", "4"]);
    });
});

describe("injectLocalRows' moveRow", () => {
    it("moves a row of a filter's beside the row it lands next to on screen", async () => {
        let shown: readonly Task[] = [];
        @Component({
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: "{{ observe() }}",
        })
        class Local {
            readonly rows = signal<readonly Task[]>(tasks);
            readonly local = injectLocalRows(this.rows, columns, {
                defaultFilters: { id: [1, 3, 5, 7] },
            });
            move(next: RowMove) {
                this.rows.set(this.local.moveRow(next));
            }
            observe() {
                shown = this.local.rows;
                return "";
            }
        }
        const { component, fixture } = await render(Local);
        expect(shown.map((task) => task.id)).toEqual([1, 3, 5, 7]);
        // 7 before 3, on screen
        component.move({ fromIndex: 3, toIndex: 1, rowKey: 7 });
        await settled(fixture);
        expect(shown.map((task) => task.id)).toEqual([1, 7, 3, 5]);
    });

    it("tells equal rows apart by their place: a page's rows move where they are", async () => {
        const letters: readonly string[] = ["x", "y", "x", "y", "x"];
        const letter: Column<string, DataGridNode>[] = [
            { key: "letter", width: 100, getValue: (row) => row },
        ];
        let result: readonly string[] = [];
        let shown: readonly string[] = [];
        @Component({
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: "{{ observe() }}",
        })
        class Paged {
            readonly local = injectLocalRows(letters, letter, {
                pageSize: 2,
                defaultPageIndex: 1,
            });
            observe() {
                shown = this.local.rows;
                result = this.local.moveRow({ fromIndex: 0, toIndex: 1 });
                return "";
            }
        }
        await render(Paged);
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
        @Component({
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: "{{ observe() }}",
        })
        class Local {
            readonly rows = signal<readonly Task[]>(tasks);
            readonly local = injectLocalRows(this.rows, columns);
            apply(moves: readonly RowMove[]) {
                for (const next of moves) {
                    this.rows.set(this.local.moveRow(next));
                }
            }
            observe() {
                kept.push(this.local.moveRow);
                shown = this.local.rows;
                return "";
            }
        }
        const { component, fixture } = await render(Local);
        // 0 to the end, then (the rows on screen moved by then) 1, now first, after 2
        component.apply([
            { fromIndex: 0, toIndex: 9, rowKey: 0 },
            { fromIndex: 0, toIndex: 1, rowKey: 1 },
        ]);
        await settled(fixture);
        expect(shown.map((task) => task.id)).toEqual([
            2, 1, 3, 4, 5, 6, 7, 8, 9, 0,
        ]);
        expect(kept.length).toBeGreaterThan(1);
        expect(new Set(kept).size).toBe(1);
    });
});
