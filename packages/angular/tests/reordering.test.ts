import {
    ChangeDetectionStrategy,
    Component,
    input,
    linkedSignal,
    signal,
} from "@angular/core";
import type { ComponentFixture } from "@angular/core/testing";
import { describe, expect, it, vi } from "vitest";
import { DataGridColumnReorder } from "../src/column-reorder";
import { DataGridNavigation } from "../src/navigation";
import {
    type CellPosition,
    type Column,
    type ColumnOrder,
    type ColumnOrGroup,
    createDataGridRef,
    DATA_GRID,
    type DataGridContextValue,
    type DataGridNode,
    type DataGridRef,
    type HeaderCellState,
} from "../src/public-api";
import { type TestFeatures, type TestProps, TestRootProps } from "./grid";
import {
    cellAt,
    fire,
    headerAt,
    keyDown,
    pointerDown,
    render,
    settled,
    stubViewportSize,
} from "./helpers";

// Column reordering (Epic #75): the order controlled or not on the root (O1), the header cells'
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
const columns: Column<Person, DataGridNode>[] = ["a", "b", "c", "d"].map(
    (key) => ({
        key,
        name: key.toUpperCase(),
        width: 100,
        getValue: (row) => `${row.id}${key}`,
        reorderable: key !== "d",
    }),
);

const grouped: ColumnOrGroup<Person, DataGridNode>[] = [
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

/**
 * The reordering grid: its root's props whole, each header cell its key (its state recorded
 * through its `exportAs`), a gridRef; `followOrder` and `followPosition` make it a parent that
 * follows (the order, the position in its state, set by the root's outputs).
 */
@Component({
    selector: "reorder-grid",
    imports: [
        DATA_GRID,
        DataGridColumnReorder,
        DataGridNavigation,
        TestRootProps,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div dataGridRoot [columns]="props().columns" [testProps]="props()" [gridRef]="gridRef()"
            dataGridColumnReorder [columnOrder]="followOrder() ? order() : undefined" (columnOrderChange)="orderChanged($event)"
            dataGridNavigation [activePosition]="followPosition() === undefined ? undefined : position()"
            (activePositionChange)="positionChanged($event)">
            @if (table()) {
                <table dataGridGrid>
                    <thead *dataGridHeader>
                        <ng-template dataGridHeaderRows let-row>
                            <tr [dataGridHeaderRow]="row">
                                <ng-template dataGridHeaderCells let-cell>
                                    <th [dataGridHeaderCell]="cell" #header="dataGridHeaderCell">{{ cell.key }}{{ record(cell.key, header.state()) }}</th>
                                </ng-template>
                            </tr>
                        </ng-template>
                    </thead>
                    <tbody dataGridBody>
                        <ng-template dataGridRows let-row>
                            <tr [dataGridRow]="row">
                                <ng-template dataGridCells let-cell>
                                    <td [dataGridCell]="cell"><ng-container *dataGridCellContent /></td>
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
                                    <div [dataGridHeaderCell]="cell" #header="dataGridHeaderCell">{{ cell.key }}{{ record(cell.key, header.state()) }}</div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                    <div dataGridBody>
                        <ng-template dataGridRows let-row>
                            <div [dataGridRow]="row">
                                <ng-template dataGridCells let-cell>
                                    <div [dataGridCell]="cell"><ng-container *dataGridCellContent /></div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                </div>
            }
        </div>
    `,
})
class ReorderGrid {
    readonly props = input.required<TestProps<unknown>>();
    readonly table = input(false);
    readonly gridRef = input<DataGridRef | undefined>(undefined);
    readonly followOrder = input(false);
    /** the position a parent that follows starts with; `undefined`: it does not follow one */
    readonly followPosition = input<CellPosition | null | undefined>(undefined);
    /** told each position the parent follows */
    readonly onFollowPosition = input<
        ((position: CellPosition | null) => void) | undefined
    >(undefined);
    readonly order = signal<ColumnOrder>([]);
    /** the parent's position: the one it starts with, then each it follows */
    readonly position = linkedSignal<CellPosition | null>(
        () => this.followPosition() ?? null,
    );

    /** the state each header cell renders with (React reads it in a `className` function) */
    record(key: string, state: HeaderCellState | undefined) {
        if (!state) return "";
        states.set(key, state);
        return "";
    }

    orderChanged(next: ColumnOrder) {
        if (this.followOrder()) this.order.set(next);
    }

    positionChanged(next: CellPosition | null) {
        if (this.followPosition() === undefined) return;
        this.onFollowPosition()?.(next);
        this.position.set(next);
    }
}

type GridProps = Partial<TestProps<Person>> & {
    table?: boolean;
    gridRef?: DataGridRef;
    followOrder?: boolean;
    followPosition?: CellPosition | null;
    onFollowPosition?: (position: CellPosition | null) => void;
};

function setInputs(fixture: ComponentFixture<ReorderGrid>, props: GridProps) {
    const {
        table = false,
        gridRef,
        followOrder = false,
        followPosition,
        onFollowPosition,
        ...rest
    } = props;
    const inputs = {
        props: { columns, rows: people, rowHeight: 20, ...rest },
        table,
        gridRef,
        followOrder,
        followPosition,
        onFollowPosition,
    };
    for (const [name, value] of Object.entries(inputs)) {
        fixture.componentRef.setInput(name, value);
    }
}

/** Mounts a grid with `props` and lets it settle. */
async function mountGrid(props: GridProps = {}) {
    return render(ReorderGrid, (fixture) => setInputs(fixture, props));
}

/** A pointer event of `type` on `target`, bubbling and cancelable. */
function pointer(type: string, target: EventTarget, init: PointerEventInit) {
    const Pointer =
        typeof PointerEvent === "function" ? PointerEvent : MouseEvent;
    return fire(
        target,
        new Pointer(type, { bubbles: true, cancelable: true, ...init }),
    );
}

/** Focuses `element` and lets the grid follow. */
async function focus(element: HTMLElement) {
    element.focus();
    await settled();
}

/** Ctrl+Shift+→ on `target`: its column one place later. */
async function moveRight(target: HTMLElement) {
    keyDown(target, { key: "ArrowRight", ctrlKey: true, shiftKey: true });
    await settled();
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
async function withRef(initial: GridProps) {
    const gridRef = createDataGridRef<unknown, TestFeatures>();
    const view = await mountGrid({ gridRef, ...initial });
    const move = async (
        columnKey: string,
        targetKey: string,
        side: "before" | "after",
    ) => {
        gridRef.current?.model.run("column-order.move", {
            columnKey,
            targetKey,
            side,
        });
        await settled();
    };
    return {
        ...view,
        move,
        model: () => gridRef.current?.model,
        rerender: async (next: GridProps) => {
            setInputs(view.fixture, { gridRef, ...next });
            await settled(view.fixture);
        },
    };
}

describe("uncontrolled", () => {
    it("starts with defaultColumnOrder, moves, and tells each change once", async () => {
        const onColumnOrderChange = vi.fn();
        const { container, move } = await withRef({
            defaultColumnOrder: ["c", "a"],
            onColumnOrderChange,
        });
        // the listed ones take the places of the listed ones, in its order
        expect(headerOrder(container)).toEqual(["c", "b", "a", "d"]);
        expect(bodyOrder(container)).toEqual(["0c", "0b", "0a", "0d"]);
        expect(onColumnOrderChange).not.toHaveBeenCalled();
        await move("b", "d", "after");
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
        await move("b", "d", "after");
        expect(onColumnOrderChange).toHaveBeenCalledTimes(1);
    });

    it("tells the app the order it starts with when one listed a key twice", async () => {
        const onColumnOrderChange = vi.fn();
        const { container } = await mountGrid({
            defaultColumnOrder: ["b", "a", "b"],
            onColumnOrderChange,
        });
        expect(onColumnOrderChange).toHaveBeenCalledTimes(1);
        expect(onColumnOrderChange).toHaveBeenCalledWith(["b", "a"]);
        expect(headerOrder(container)).toEqual(["b", "a", "c", "d"]);
    });
});

describe("controlled", () => {
    it("asks on a move, and shows the order only when the prop follows", async () => {
        const onColumnOrderChange = vi.fn();
        const { container, move, rerender } = await withRef({
            columnOrder: [],
            onColumnOrderChange,
        });
        await move("a", "c", "after");
        expect(onColumnOrderChange).toHaveBeenCalledWith(["b", "c", "a", "d"]);
        expect(headerOrder(container)).toEqual(["a", "b", "c", "d"]);
        await rerender({
            columnOrder: ["b", "c", "a", "d"],
            onColumnOrderChange,
        });
        expect(headerOrder(container)).toEqual(["b", "c", "a", "d"]);
        expect(bodyOrder(container)).toEqual(["0b", "0c", "0a", "0d"]);
        // the root's own sync is never told back
        expect(onColumnOrderChange).toHaveBeenCalledTimes(1);
    });

    it("keeps the keys of a controlled prop, and tells the parent the order it holds", async () => {
        const onColumnOrderChange = vi.fn();
        const { container, model, rerender } = await withRef({
            columnOrder: ["c", "c", "b"],
            onColumnOrderChange,
        });
        expect(headerOrder(container)).toEqual(["a", "c", "b", "d"]);
        expect(onColumnOrderChange).toHaveBeenLastCalledWith(["c", "b"]);
        const told = onColumnOrderChange.mock.calls.length;
        // a key that is no column is kept: it may come back
        await rerender({
            columnOrder: ["gone", "d", "a"],
            onColumnOrderChange,
        });
        expect(headerOrder(container)).toEqual(["d", "b", "c", "a"]);
        expect(model()?.get("column-order")).toEqual(["gone", "d", "a"]);
        expect(onColumnOrderChange).toHaveBeenCalledTimes(told);
    });

    it("works with a parent that follows, a group moving whole", async () => {
        const gridRef = createDataGridRef<unknown, TestFeatures>();
        // a parent: the order in its state, set by the root's output
        const { container, component } = await mountGrid({
            columns: grouped,
            gridRef,
            followOrder: true,
        });
        gridRef.current?.model.run("column-order.move", {
            columnKey: "first",
            targetKey: "rest",
            side: "after",
        });
        await settled();
        expect(component.order()).toEqual(["rest", "first"]);
        expect(headerOrder(container)).toEqual(["c", "d", "a", "b"]);
        gridRef.current?.model.run("column-order.reset", {});
        await settled();
        expect(component.order()).toEqual([]);
        expect(headerOrder(container)).toEqual(["a", "b", "c", "d"]);
    });
});

describe("the active cell", () => {
    /** The positions `active-position.set` runs with from now on (a middleware's spy). */
    function positionsSet(model: DataGridContextValue["model"] | undefined) {
        const set: unknown[] = [];
        model?.use((ctx, next) => {
            if (ctx.command === "active-position.set") set.push(ctx.payload);
            return next();
        });
        return set;
    }

    it("follows its column when a controlled order follows, and the app is told", async () => {
        const onActivePositionChange = vi.fn();
        const { container, rerender } = await withRef({
            columnOrder: [],
            defaultActivePosition: { rowIndex: 2, columnIndex: 0 },
            onActivePositionChange,
        });
        await rerender({
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

    it("follows its column with the order and the position both controlled, never back to its old place", async () => {
        const onActivePositionChange = vi.fn();
        const gridRef = createDataGridRef<unknown, TestFeatures>();
        // a parent: both in its state, set by the root's outputs
        const { container } = await mountGrid({
            gridRef,
            followOrder: true,
            followPosition: { rowIndex: -1, columnIndex: 0 },
            onFollowPosition: onActivePositionChange,
        });
        const a = headerAt(container, 0);
        await focus(a);
        onActivePositionChange.mockClear();
        const set = positionsSet(gridRef.current?.model);
        await moveRight(a);
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

    it("takes a new controlled position given in the same render as a new order", async () => {
        const onActivePositionChange = vi.fn();
        const { container, model, rerender } = await withRef({
            columnOrder: [],
            activePosition: { rowIndex: 2, columnIndex: 0 },
            onActivePositionChange,
        });
        await rerender({
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

    it("keeps the cell the order moved when the parent keeps its old position, told once", async () => {
        const onActivePositionChange = vi.fn();
        const { container, model, rerender } = await withRef({
            columnOrder: [],
            activePosition: { rowIndex: 2, columnIndex: 0 },
            onActivePositionChange,
        });
        const set = positionsSet(model());
        await rerender({
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
    it("keeps the position a move carried with its column when the parent keeps its old one, told once", async () => {
        const onActivePositionChange = vi.fn();
        const props: GridProps = {
            defaultColumnOrder: [],
            activePosition: { rowIndex: -1, columnIndex: 0 },
            onActivePositionChange,
        };
        const { container, model, rerender } = await withRef(props);
        const a = headerAt(container, 0);
        await focus(a);
        const set: unknown[] = [];
        model()?.use((ctx, next) => {
            if (ctx.command === "active-position.set") set.push(ctx.payload);
            return next();
        });
        // the order's own commit moves the position in the same commit
        await moveRight(a);
        expect(headerOrder(container)).toEqual(["b", "a", "c", "d"]);
        expect(onActivePositionChange).toHaveBeenCalledTimes(1);
        expect(onActivePositionChange).toHaveBeenCalledWith({
            rowIndex: -1,
            columnIndex: 1,
        });
        // the parent renders again with its old position: it never pulls the cell back
        await rerender({ ...props });
        expect(set).toEqual([]);
        expect(model()?.get("active-position")).toEqual({
            rowIndex: -1,
            columnIndex: 1,
        });
        expect(headerAt(container, 1)).toHaveAttribute("data-active", "");
        expect(headerAt(container, 1).textContent).toBe("a");
        expect(onActivePositionChange).toHaveBeenCalledTimes(1);
        // a position the parent changes wins again
        await rerender({
            ...props,
            activePosition: { rowIndex: 2, columnIndex: 3 },
        });
        expect(model()?.get("active-position")).toEqual({
            rowIndex: 2,
            columnIndex: 3,
        });
    });
});

describe("a header cell's drag", () => {
    const press = async (target: HTMLElement, clientX: number) => {
        pointerDown(target, { button: 0, pointerId: 1, clientX });
        await settled();
    };
    const move = async (target: HTMLElement, clientX: number) => {
        pointer("pointermove", target, { pointerId: 1, buttons: 1, clientX });
        await settled();
    };
    const release = async (target: HTMLElement, clientX: number) => {
        pointer("pointerup", target, { pointerId: 1, clientX });
        await settled();
    };

    it("marks the dragged cell and the drop target, and moves the column on release", async () => {
        const onColumnOrderChange = vi.fn();
        const { container } = await mountGrid({ onColumnOrderChange });
        const a = headerAt(container, 0);
        await press(a, 50);
        // under the slop: no drag yet
        await move(a, 52);
        expect(a).not.toHaveAttribute("data-dragging");
        // past c's middle (250): after it
        await move(a, 260);
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
        await release(a, 260);
        expect(onColumnOrderChange).toHaveBeenCalledTimes(1);
        expect(onColumnOrderChange).toHaveBeenCalledWith(["b", "c", "a", "d"]);
        expect(headerOrder(container)).toEqual(["b", "c", "a", "d"]);
        expect(
            container.querySelectorAll("[data-dragging], [data-drop-target]"),
        ).toHaveLength(0);
    });

    it("cancels on Escape: nothing moves", async () => {
        const onColumnOrderChange = vi.fn();
        const { container } = await mountGrid({ onColumnOrderChange });
        const a = headerAt(container, 0);
        await press(a, 50);
        await move(a, 160);
        expect(headerAt(container, 1)).toHaveAttribute(
            "data-drop-target",
            "after",
        );
        keyDown(a, { key: "Escape" });
        await settled();
        expect(a).not.toHaveAttribute("data-dragging");
        await release(a, 160);
        expect(onColumnOrderChange).not.toHaveBeenCalled();
        expect(headerOrder(container)).toEqual(["a", "b", "c", "d"]);
    });
});

describe("the keys", () => {
    it("move the active header cell's column, Ctrl+Shift with the arrows", async () => {
        const onColumnOrderChange = vi.fn();
        const { container, model } = await withRef({ onColumnOrderChange });
        const a = headerAt(container, 0);
        await focus(a);
        await moveRight(a);
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
    ])(
        "marks reorderable header cells, and a drag's, as %s",
        async (_, table) => {
            const { container } = await mountGrid({ columns: grouped, table });
            const marked = () =>
                [
                    ...container.querySelectorAll(
                        '[data-grid-part="header-cell"]',
                    ),
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
            pointerDown(first, { button: 0, pointerId: 1, clientX: 50 });
            pointer("pointermove", first, {
                pointerId: 1,
                buttons: 1,
                clientX: 380,
            });
            await settled();
            expect(marked().slice(0, 2)).toEqual([
                ["first", tag, true, true, null],
                ["rest", tag, false, false, "after"],
            ]);
            pointer("pointerup", first, { pointerId: 1, clientX: 380 });
            await settled();
            expect(headerOrder(container)).toEqual(["c", "d", "a", "b"]);
        },
    );

    it("adds no attribute to a grid without reorderable columns", async () => {
        const { container } = await mountGrid({
            columns: columns.map(
                ({ reorderable: _reorderable, ...column }) => column,
            ),
        });
        const a = headerAt(container, 0);
        pointerDown(a, { button: 0, pointerId: 1, clientX: 50 });
        pointer("pointermove", a, { pointerId: 1, buttons: 1, clientX: 260 });
        pointer("pointerup", a, { pointerId: 1, clientX: 260 });
        await settled();
        expect(
            container.querySelectorAll(
                "[data-reorderable], [data-dragging], [data-drop-target]",
            ),
        ).toHaveLength(0);
        expect(headerOrder(container)).toEqual(["a", "b", "c", "d"]);
    });
});
