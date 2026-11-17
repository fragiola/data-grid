import { NgTemplateOutlet } from "@angular/common";
import {
    ChangeDetectionStrategy,
    Component,
    input,
    signal,
} from "@angular/core";
import type { ComponentFixture } from "@angular/core/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    DataGridColumnResize,
    DataGridColumnResizer,
    injectColumnResizer,
} from "../src/column-resize";
import {
    type Column,
    type ColumnOrGroup,
    type ColumnResizerState,
    type ColumnWidths,
    createDataGridRef,
    DATA_GRID,
    type DataGridNode,
    type DataGridRef,
    type HeaderCellInfo,
} from "../src/public-api";
import { type TestFeatures, type TestProps, TestRootProps } from "./grid";
import {
    cellAt,
    fire,
    headerAt,
    keyDown,
    pointerDown,
    render,
    root,
    scrollRoot,
    settled,
    stubViewportSize,
} from "./helpers";

// Column resizing (Epic #70): the widths controlled or not on the root (W1), a resizer's props and
// state from `injectColumnResizer` (W3; `*dataGridColumnResizer` is its directive), the header
// cells' `data-resizable`/`data-resizing` (W8). The drag, the keys and the double click are the
// engine's (core tests, the shared e2e spec). Automatic widths (Epic #80): the parts and the
// handle read the width on screen, a flex share or an automatic width, which is the engine's and
// never reported (A6).

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

const columns: Column<Person, DataGridNode>[] = [
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

const grouped: ColumnOrGroup<Person, DataGridNode>[] = [
    { key: "person", name: "Person", children: columns.slice(0, 2) },
    { key: "rest", name: "Rest", children: columns.slice(2) },
];

stubViewportSize(600, 300);

/** The states the resizers rendered last, by key. */
const states = new Map<string, ColumnResizerState>();
/** The props the resizers rendered last, by key. */
const resizerProps = new Map<string, Record<string, unknown>>();

/** A resizer as an app writes it: the injection function's props on an element of its own. */
@Component({
    selector: "test-resizer",
    imports: [DATA_GRID],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<div [dataGridBind]="resizer.props()" [attr.aria-label]="'Resize ' + cell().key">{{ record() }}</div>`,
})
class Resizer {
    readonly cell = input.required<HeaderCellInfo>();
    readonly resizer = injectColumnResizer(this.cell);

    record() {
        states.set(this.cell().key, this.resizer.state());
        resizerProps.set(this.cell().key, { ...this.resizer.props() });
        return "";
    }
}

/** How a header cell renders its resizer: the component above, the directive, or none. */
type ResizerForm = "inject" | "directive" | "none";

/**
 * The resizing grid: its root's props whole, a resizer in every header cell, a gridRef, the
 * consumer's press on the root; `follow` makes it a parent that follows (the widths in its state,
 * set by the root's output).
 */
@Component({
    selector: "resize-grid",
    imports: [
        DATA_GRID,
        DataGridColumnResize,
        DataGridColumnResizer,
        NgTemplateOutlet,
        TestRootProps,
        Resizer,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div dataGridRoot [columns]="props().columns" [testProps]="props()" [gridRef]="gridRef()"
            dataGridColumnResize [columnWidths]="follow() ? widths() : undefined" (columnWidthsChange)="followed($event)"
            (pointerdown)="pressed($event)">
            <ng-template #content let-cell>{{ cell.key }}@switch (resizers()) {
                @case ('inject') {<test-resizer [cell]="cell" />}
                @case ('directive') {<div *dataGridColumnResizer="cell; let state" [attr.aria-label]="'Resize ' + cell.key" [attr.data-state-width]="state.width"></div>}
            }</ng-template>
            @if (table()) {
                <table dataGridGrid>
                    <thead *dataGridHeader>
                        <ng-template dataGridHeaderRows let-row>
                            <tr [dataGridHeaderRow]="row">
                                <ng-template dataGridHeaderCells let-cell>
                                    <th [dataGridHeaderCell]="cell"><ng-container *ngTemplateOutlet="content; context: { $implicit: cell }" /></th>
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
                                    <div [dataGridHeaderCell]="cell"><ng-container *ngTemplateOutlet="content; context: { $implicit: cell }" /></div>
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
class ResizeGrid {
    readonly props = input.required<TestProps<unknown>>();
    readonly table = input(false);
    readonly resizers = input<ResizerForm>("inject");
    readonly gridRef = input<DataGridRef | undefined>(undefined);
    readonly follow = input(false);
    /** told each change the parent follows */
    readonly onFollow = input<((widths: ColumnWidths) => void) | undefined>(
        undefined,
    );
    /** the consumer's own press listener on the root */
    readonly onPointerDown = input<((event: PointerEvent) => void) | undefined>(
        undefined,
    );
    readonly widths = signal<ColumnWidths>({});

    followed(next: ColumnWidths) {
        if (!this.follow()) return;
        this.onFollow()?.(next);
        this.widths.set(next);
    }

    pressed(event: PointerEvent) {
        this.onPointerDown()?.(event);
    }
}

type GridProps = Partial<TestProps<Person>> & {
    table?: boolean;
    resizers?: ResizerForm;
    gridRef?: DataGridRef;
    follow?: boolean;
    onFollow?: (widths: ColumnWidths) => void;
    onPointerDown?: (event: PointerEvent) => void;
};

function setInputs(fixture: ComponentFixture<ResizeGrid>, props: GridProps) {
    const {
        table = false,
        resizers = "inject",
        gridRef,
        follow = false,
        onFollow,
        onPointerDown,
        ...rest
    } = props;
    const inputs = {
        props: { columns, rows: people, rowHeight: 20, ...rest },
        table,
        resizers,
        gridRef,
        follow,
        onFollow,
        onPointerDown,
    };
    for (const [name, value] of Object.entries(inputs)) {
        fixture.componentRef.setInput(name, value);
    }
}

/** Mounts a grid with `props` and lets it settle. */
async function mountGrid(props: GridProps = {}) {
    return render(ResizeGrid, (fixture) => setInputs(fixture, props));
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
async function withRef(initial: GridProps) {
    const gridRef = createDataGridRef<unknown, TestFeatures>();
    const view = await mountGrid({ gridRef, ...initial });
    /** The model and the engine of the root on screen. */
    const handle = () => {
        const current = gridRef.current;
        if (!current) throw new Error("no grid");
        return current;
    };
    const resize = async (columnKey: string, width: number) => {
        handle().model.run("column-widths.resize", { columnKey, width });
        await settled();
    };
    return {
        ...view,
        grid: handle,
        resize,
        rerender: async (next: GridProps) => {
            setInputs(view.fixture, { gridRef, ...next });
            await settled(view.fixture);
        },
    };
}

describe("uncontrolled", () => {
    it("starts with defaultColumnWidths, resizes, and tells each change once", async () => {
        const onColumnWidthsChange = vi.fn();
        const { container, resize } = await withRef({
            defaultColumnWidths: { name: 200 },
            onColumnWidthsChange,
        });
        expect(widthsOf(container, 0)).toEqual(["200px", "200px"]);
        expect(onColumnWidthsChange).not.toHaveBeenCalled();
        await resize("age", 100);
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
        await resize("age", 500);
        await resize("age", 500);
        expect(onColumnWidthsChange).toHaveBeenCalledTimes(2);
        expect(widthsOf(container, 1)).toEqual(["120px", "120px"]);
    });
});

describe("controlled", () => {
    it("asks on a resize, and shows the width only when the prop follows", async () => {
        const onColumnWidthsChange = vi.fn();
        const { container, resize, rerender } = await withRef({
            columnWidths: {},
            onColumnWidthsChange,
        });
        await resize("name", 180);
        expect(onColumnWidthsChange).toHaveBeenCalledWith({ name: 180 });
        expect(widthsOf(container, 0)).toEqual(["150px", "150px"]);
        await rerender({ columnWidths: { name: 180 }, onColumnWidthsChange });
        expect(widthsOf(container, 0)).toEqual(["180px", "180px"]);
        // the root's own sync is never told back
        expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
    });

    it("works with a parent that follows", async () => {
        const gridRef = createDataGridRef<unknown, TestFeatures>();
        // a parent: the widths in its state, set by the root's output
        const { container, component } = await mountGrid({
            columns: grouped,
            gridRef,
            follow: true,
        });
        gridRef.current?.model.run("column-widths.resize", {
            columnKey: "person",
            width: 345,
        });
        await settled();
        // the group's 115px more shared by their widths: 75 and 40
        expect(component.widths()).toEqual({ name: 225, age: 120 });
        expect(widthsOf(container, 0)).toEqual(["225px", "225px"]);
        gridRef.current?.model.run("column-widths.reset", {});
        await settled();
        expect(component.widths()).toEqual({});
        expect(widthsOf(container, 1)).toEqual(["80px", "80px"]);
    });
});

describe("injectColumnResizer", () => {
    it("gives a separator's ARIA, the marking attribute and its part, and no style", async () => {
        const { container } = await mountGrid();
        const age = resizerOf(container, "age");
        expect(age).toHaveAttribute("role", "separator");
        expect(age).toHaveAttribute("aria-orientation", "vertical");
        expect(age).toHaveAttribute("aria-valuenow", "80");
        expect(age).toHaveAttribute("aria-valuemin", "60");
        expect(age).toHaveAttribute("aria-valuemax", "120");
        expect(age).toHaveAttribute("data-grid-part", "column-resizer");
        // its own tab stop; once the engine's observer ran, a header cell's control is held out
        // of the tab order outside interaction
        expect(resizerProps.get("age")?.tabIndex).toBe(0);
        expect(age).toHaveAttribute("tabindex", "-1");
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

    it("gives no props under a header cell whose columns do not resize", async () => {
        const { container } = await mountGrid();
        const id = container.querySelector('[aria-label="Resize id"]');
        expect(id?.getAttributeNames()).toEqual(["aria-label"]);
    });

    it("gives a group's resizer its columns' width and limits together", async () => {
        const { container } = await mountGrid({ columns: grouped });
        const person = resizerOf(container, "person");
        expect(person).toHaveAttribute("aria-valuenow", "230");
        // the name at 40 (the default minimum), the age at 60
        expect(person).toHaveAttribute("aria-valuemin", "100");
        expect(person).toHaveAttribute("aria-valuemax", "600");
        expect(states.get("rest")?.resizable).toBe(false);
    });

    it("marks the resizer and its header cell while a drag resizes", async () => {
        const { container } = await mountGrid();
        const age = resizerOf(container, "age");
        pointerDown(age, { button: 0, pointerId: 1, clientX: 300 });
        await settled();
        expect(age).toHaveAttribute("data-resizing", "");
        expect(headerAt(container, 1)).toHaveAttribute("data-resizing", "");
        expect(headerAt(container, 0)).not.toHaveAttribute("data-resizing");
        expect(states.get("age")?.resizing).toBe(true);
        pointer("pointerup", age, { pointerId: 1, clientX: 300 });
        await settled();
        expect(age).not.toHaveAttribute("data-resizing");
        expect(headerAt(container, 1)).not.toHaveAttribute("data-resizing");
    });

    it("starts a drag after the consumer's (pointerdown): preventDefault cancels it", async () => {
        const onPointerDown = vi.fn((event: PointerEvent) =>
            event.preventDefault(),
        );
        const { container } = await mountGrid({ onPointerDown });
        const age = resizerOf(container, "age");
        pointerDown(age, { button: 0, pointerId: 1, clientX: 300 });
        await settled();
        expect(onPointerDown).toHaveBeenCalledTimes(1);
        expect(age).not.toHaveAttribute("data-resizing");
        expect(states.get("age")?.resizing).toBe(false);
    });
});

// Angular only: the directive form of the same part, rendered only under a cell that resizes
describe("*dataGridColumnResizer", () => {
    it("renders the app's element only under a header cell whose columns resize, with its state", async () => {
        const { container } = await mountGrid({
            columns: grouped,
            resizers: "directive",
        });
        expect(container.querySelector('[aria-label="Resize id"]')).toBeNull();
        expect(
            container.querySelector('[aria-label="Resize rest"]'),
        ).toBeNull();
        const age = resizerOf(container, "age");
        expect(age).toHaveAttribute("aria-label", "Resize age");
        expect(age).toHaveAttribute("role", "separator");
        expect(age).toHaveAttribute("aria-valuenow", "80");
        expect(age).toHaveAttribute("data-grid-part", "column-resizer");
        expect(age).toHaveAttribute("data-state-width", "80");
        expect(resizerOf(container, "person")).toHaveAttribute(
            "aria-valuenow",
            "230",
        );
        pointerDown(age, { button: 0, pointerId: 1, clientX: 300 });
        await settled();
        expect(age).toHaveAttribute("data-resizing", "");
        expect(headerAt(container, 1)).toHaveAttribute("data-resizing", "");
        pointer("pointerup", age, { pointerId: 1, clientX: 300 });
        await settled();
        expect(age).not.toHaveAttribute("data-resizing");
    });
});

describe("structure", () => {
    it.each([
        ["divs", false],
        ["a table", true],
    ])("marks resizable header cells, as %s", async (_, table) => {
        const { container } = await mountGrid({ columns: grouped, table });
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

    it("adds no attribute to a grid without resizable columns", async () => {
        const { container } = await mountGrid({
            columns: columns.map(
                ({
                    resizable: _resizable,
                    minWidth: _min,
                    maxWidth: _max,
                    ...column
                }) => column,
            ),
            resizers: "none",
        });
        expect(
            container.querySelectorAll(
                "[data-resizable], [data-resizing], [data-grid-column-resizer]",
            ),
        ).toHaveLength(0);
    });
});

describe("the widths a root is given", () => {
    it("tells the app the widths it starts with when some were not widths", async () => {
        const onColumnWidthsChange = vi.fn();
        const { container } = await mountGrid({
            defaultColumnWidths: { name: 200, age: -1 },
            onColumnWidthsChange,
        });
        expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
        expect(onColumnWidthsChange).toHaveBeenCalledWith({ name: 200 });
        expect(widthsOf(container, 0)).toEqual(["200px", "200px"]);
    });

    it("keeps the widths of a controlled prop, and tells the parent the ones it holds", async () => {
        const onColumnWidthsChange = vi.fn();
        const { container, rerender } = await withRef({
            columnWidths: { name: 180, age: -1 },
            onColumnWidthsChange,
        });
        expect(widthsOf(container, 0)).toEqual(["180px", "180px"]);
        expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ name: 180 });
        await rerender({
            columnWidths: { name: 190, age: Number.NaN },
            onColumnWidthsChange,
        });
        expect(widthsOf(container, 0)).toEqual(["190px", "190px"]);
        expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ name: 190 });
    });

    it("follows controlled widths before a controlled position scrolls into view", async () => {
        const wide: Column<Person, DataGridNode>[] = Array.from(
            { length: 20 },
            (_, i) => ({
                key: `w${i}`,
                width: 100,
                resizable: true,
            }),
        );
        const onActivePositionChange = vi.fn();
        const {
            container,
            grid: handle,
            rerender,
        } = await withRef({
            columns: wide,
            onActivePositionChange,
            activePosition: null,
            columnWidths: {},
        });
        // in one render: the first three columns widen, and the 16th becomes active
        await rerender({
            columns: wide,
            onActivePositionChange,
            activePosition: { rowIndex: 0, columnIndex: 15 },
            columnWidths: { w0: 400, w1: 400, w2: 400 },
        });
        // against the new widths: it starts at 3 × 400 + 12 × 100 and ends at the view's end
        expect(root(container).scrollLeft).toBe(2_500 - 600);
        scrollRoot(root(container), {});
        await settled();
        const visible = handle().engine.get("column-window").visible;
        expect(visible.start).toBeLessThanOrEqual(15);
        expect(visible.end).toBeGreaterThan(15);
    });

    it("takes widths for columns that arrive in the same render", async () => {
        const onColumnWidthsChange = vi.fn();
        const extra: Column<Person, DataGridNode> = {
            key: "extra",
            width: 50,
            resizable: true,
        };
        const { container, rerender } = await withRef({
            columnWidths: {},
            onColumnWidthsChange,
        });
        await rerender({
            columns: [...columns, extra],
            columnWidths: { extra: 90 },
            onColumnWidthsChange,
        });
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
        return async () => {
            for (const frame of frames.splice(0)) frame(0);
            await settled();
        };
    }

    /** A parent that follows: the widths in its state, set by the root's output. */
    async function mountParent(onFollow: (widths: ColumnWidths) => void) {
        return mountGrid({ follow: true, onFollow });
    }

    const move = (target: HTMLElement, clientX: number) =>
        pointer("pointermove", target, { pointerId: 1, buttons: 1, clientX });

    it("asks the parent once a frame, and Escape asks for the width it started from", async () => {
        const flush = fakeFrames();
        const onChange = vi.fn();
        const { container } = await mountParent(onChange);
        const age = resizerOf(container, "age");
        pointerDown(age, { button: 0, pointerId: 1, clientX: 300 });
        move(age, 310);
        move(age, 320);
        move(age, 330);
        expect(onChange).not.toHaveBeenCalled();
        await flush();
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenLastCalledWith({ age: 110 });
        expect(widthsOf(container, 1)).toEqual(["110px", "110px"]);
        move(age, 325);
        move(age, 335);
        await flush();
        expect(onChange).toHaveBeenCalledTimes(2);
        expect(widthsOf(container, 1)).toEqual(["115px", "115px"]);
        keyDown(document, { key: "Escape" });
        expect(onChange).toHaveBeenCalledTimes(3);
        // a resize back to its start, its own width: no width of the record's
        expect(onChange).toHaveBeenLastCalledWith({});
        await settled();
        expect(widthsOf(container, 1)).toEqual(["80px", "80px"]);
        expect(age).not.toHaveAttribute("data-resizing");
    });
});

describe("automatic widths (Epic #80)", () => {
    /** "name" flexes one part, "age" two up to its 120px; "id" is fixed. */
    const flexing: Column<Person, DataGridNode>[] = [
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
        async (_, table) => {
            const onColumnWidthsChange = vi.fn();
            const { container, grid: handle } = await withRef({
                columns: flexing,
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
            expect(handle().engine.get("column-auto-widths")).toEqual({
                name: 400,
                age: 120,
            });
            expect(handle().model.get("column-widths")).toEqual({});
            expect(onColumnWidthsChange).not.toHaveBeenCalled();
        },
    );

    it("gives a group's handle its flex columns' widths on screen", async () => {
        const { container } = await mountGrid({
            columns: [
                {
                    key: "person",
                    name: "Person",
                    children: flexing.slice(0, 2),
                },
                { key: "rest", name: "Rest", children: flexing.slice(2) },
            ],
        });
        expect(resizerOf(container, "person")).toHaveAttribute(
            "aria-valuenow",
            "520",
        );
        expect(states.get("person")?.width).toBe(520);
    });

    it("makes a resized flex column fixed, and a reset makes it flex again", async () => {
        const onColumnWidthsChange = vi.fn();
        const {
            container,
            grid: handle,
            resize,
        } = await withRef({
            columns: flexing,
            onColumnWidthsChange,
        });
        await resize("name", 200);
        expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ name: 200 });
        // "age" keeps its maximum: the view is not filled
        expect(widthsOf(container, 0)).toEqual(["200px", "200px"]);
        expect(resizerOf(container, "name")).toHaveAttribute(
            "aria-valuenow",
            "200",
        );
        handle().model.run("column-widths.reset", { columnKey: "name" });
        await settled();
        expect(onColumnWidthsChange).toHaveBeenLastCalledWith({});
        expect(widthsOf(container, 0)).toEqual(["400px", "400px"]);
        expect(resizerOf(container, "name")).toHaveAttribute(
            "aria-valuenow",
            "400",
        );
    });

    it("fits an autoSize column once its rows render: the grid's width, never reported", async () => {
        const measured = fakeContentWidths();
        const onColumnWidthsChange = vi.fn();
        const {
            container,
            grid: handle,
            resize,
        } = await withRef({
            columns: [
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
        expect(handle().engine.get("column-auto-widths")).toEqual({
            name: 72,
        });
        expect(onColumnWidthsChange).not.toHaveBeenCalled();
        // once: a resize and a reset measure nothing again, the reset gives its width back
        const count = measured();
        await resize("name", 200);
        expect(widthsOf(container, 0)).toEqual(["200px", "200px"]);
        handle().model.run("column-widths.reset", {});
        await settled();
        expect(widthsOf(container, 0)).toEqual(["72px", "72px"]);
        expect(measured()).toBe(count);
    });

    it("fits every rendered resizable column with fit-columns, in one change", async () => {
        fakeContentWidths();
        const onColumnWidthsChange = vi.fn();
        const { container, grid: handle } = await withRef({
            onColumnWidthsChange,
        });
        // the premise: "name" measures within its limits, "age" under its 60px minimum
        expect(fakedWidth(container, 0)).toBe(72);
        expect(fakedWidth(container, 1)).toBeGreaterThan(0);
        expect(fakedWidth(container, 1)).toBeLessThan(60);
        handle().engine.run("fit-columns", {});
        await settled();
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

    it("measures nothing and has no widths of its own without flex or autoSize", async () => {
        const measured = fakeContentWidths();
        const { grid: handle } = await withRef({});
        expect(handle().engine.get("column-auto-widths")).toEqual({});
        expect(measured()).toBe(0);
    });
});
