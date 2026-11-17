import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import type { ComponentFixture } from "@angular/core/testing";
import { describe, expect, it, vi } from "vitest";
import {
    type CellInfo,
    type CellRange,
    type CellState,
    type Column,
    createDataGridRef,
    DATA_GRID,
    type DataGridNode,
    type DataGridRef,
    type RangePaste,
} from "../src/public-api";
import { type TestProps, TestRootProps } from "./grid";
import {
    cellAt,
    keyDown,
    render,
    root,
    settled,
    stubViewportSize,
} from "./helpers";

// Cell ranges and the clipboard (Epic #88, E4.1–E4.2): the root maps `cellSelection` and the range
// (controlled or not) onto the model; cells carry `data-selected-cell`, `data-range-edge` and
// `aria-selected`, the grid `aria-multiselectable`, as divs or as a table; a copy on a cell puts
// the range on the clipboard as TSV, after the consumer's `(copy)`; a paste asks
// `beforeRangePaste`, then tells `rangePaste`. A grid without it renders as before.

interface Item {
    id: number;
}

const items: Item[] = Array.from({ length: 20 }, (_, id) => ({ id }));

const columns: Column<Item, DataGridNode>[] = ["a", "b", "c", "d"].map(
    (key) => ({
        key,
        name: key.toUpperCase(),
        width: 80,
        getValue: (row: Item) => `${key}${row.id}`,
    }),
);

stubViewportSize(400, 300);

type GridProps = Partial<
    Pick<
        TestProps<Item>,
        | "cellSelection"
        | "selectedRange"
        | "defaultSelectedRange"
        | "onSelectedRangeChange"
        | "onRangePaste"
        | "onBeforeRangePaste"
        | "defaultActivePosition"
    >
>;

/** The root's props of a range grid. */
const propsOf = (props: GridProps): TestProps<Item> => ({
    columns,
    rows: items,
    rowHeight: 20,
    cellSelection: "range",
    ...props,
});

/** What the range grid renders besides the root's props. */
interface RangeGridOptions {
    readonly table?: boolean;
    /** the root's clipboard listeners: the app's own, on the root's element */
    readonly onCopy?: (event: ClipboardEvent) => void;
    readonly onPaste?: (event: ClipboardEvent) => void;
    /** each state the cell at 1, 1 renders with, as React's className function reads it */
    readonly cellStates?: CellState[];
}

@Component({
    selector: "test-range-grid",
    imports: [DATA_GRID, TestRootProps],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div dataGridRoot [columns]="props().columns" [testProps]="props()"
            [gridRef]="gridRef()" (copy)="options().onCopy?.($event)"
            (paste)="options().onPaste?.($event)">
            @if (options().table) {
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
                            <tr [dataGridRow]="row">
                                <ng-template dataGridCells let-cell>
                                    <td [dataGridCell]="cell" #own="dataGridCell">{{ record(cell, own.state()) }}<ng-container *dataGridCellContent /></td>
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
                            <div [dataGridRow]="row">
                                <ng-template dataGridCells let-cell>
                                    <div [dataGridCell]="cell" #own="dataGridCell">{{ record(cell, own.state()) }}<ng-container *dataGridCellContent /></div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                </div>
            }
        </div>
    `,
})
class RangeGrid {
    readonly props = input.required<TestProps<unknown>>();
    readonly options = input<RangeGridOptions>({});
    /** the root's gridRef (an input of the root, not one of its props; typed as `props`) */
    readonly gridRef = input<DataGridRef<unknown>>();

    record(cell: CellInfo, state: CellState | undefined) {
        if (!state) return "";
        if (cell.rowIndex === 1 && cell.columnIndex === 1) {
            this.options().cellStates?.push(state);
        }
        return "";
    }
}

/** Renders the range grid; `setProps` gives it new root props, settled. */
async function renderGrid(
    props: GridProps,
    options: RangeGridOptions = {},
    gridRef?: DataGridRef<Item>,
) {
    let fixture: ComponentFixture<RangeGrid> | undefined;
    const rendered = await render(RangeGrid, (created) => {
        fixture = created;
        created.componentRef.setInput("props", propsOf(props));
        created.componentRef.setInput("options", options);
        created.componentRef.setInput("gridRef", gridRef);
    });
    return {
        ...rendered,
        async setProps(next: GridProps) {
            fixture?.componentRef.setInput("props", propsOf(next));
            await settled(fixture);
        },
    };
}

const range = (
    anchor: [number, number],
    focus: [number, number],
): CellRange => ({
    anchor: { rowIndex: anchor[0], columnIndex: anchor[1] },
    focus: { rowIndex: focus[0], columnIndex: focus[1] },
});

/** A copy or a paste on `target`, its clipboard a store of its own: what the grid wrote. */
async function clipboard(type: "copy" | "paste", target: Element, text = "") {
    const data = new Map([["text/plain", text]]);
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
        value: {
            setData: (format: string, value: string) => data.set(format, value),
            getData: (format: string) => data.get(format) ?? "",
        },
    });
    target.dispatchEvent(event);
    await settled();
    return { event, data };
}

for (const table of [false, true]) {
    describe(`cell ranges, as ${table ? "a table" : "divs"}`, () => {
        it("mark the range's cells and its edges, the grid aria-multiselectable", async () => {
            const cellStates: CellState[] = [];
            const { container } = await renderGrid(
                { defaultSelectedRange: range([1, 1], [2, 2]) },
                { table, cellStates },
            );
            expect(
                container.querySelector('[data-grid-part="grid"]'),
            ).toHaveAttribute("aria-multiselectable", "true");
            const first = cellAt(container, 1, 1);
            expect(first).toHaveAttribute("data-selected-cell", "");
            expect(first).toHaveAttribute("data-range-edge", "top start");
            expect(first).toHaveAttribute("aria-selected", "true");
            expect(cellAt(container, 2, 2)).toHaveAttribute(
                "data-range-edge",
                "bottom end",
            );
            const outside = cellAt(container, 3, 1);
            expect(outside).not.toHaveAttribute("data-selected-cell");
            expect(outside).not.toHaveAttribute("data-range-edge");
            expect(outside).toHaveAttribute("aria-selected", "false");
            // the header cells are never selected
            expect(
                container.querySelector('[data-grid-part="header-cell"]'),
            ).not.toHaveAttribute("aria-selected");
            expect(cellStates.at(-1)).toMatchObject({
                selected: true,
                rangeEdges: "top start",
            });
        });

        it("render a grid without cell selection as before", async () => {
            const cellStates: CellState[] = [];
            const { container } = await renderGrid(
                {
                    cellSelection: undefined,
                    defaultSelectedRange: range([1, 1], [2, 2]),
                },
                { table, cellStates },
            );
            expect(
                container.querySelector('[data-grid-part="grid"]'),
            ).not.toHaveAttribute("aria-multiselectable");
            const cell = cellAt(container, 1, 1);
            expect(cell).not.toHaveAttribute("aria-selected");
            expect(cell).not.toHaveAttribute("data-selected-cell");
            expect(cell).not.toHaveAttribute("data-range-edge");
            expect(cellStates.at(-1)?.selected).toBeUndefined();
            const copy = await clipboard("copy", cell);
            expect(copy.event.defaultPrevented).toBe(false);
        });
    });
}

describe("the selected range", () => {
    it("follows the keys uncontrolled, and tells each change", async () => {
        const changes: (CellRange | null)[] = [];
        const { container } = await renderGrid({
            defaultActivePosition: { rowIndex: 1, columnIndex: 1 },
            onSelectedRangeChange: (next) => changes.push(next),
        });
        const cell = cellAt(container, 1, 1);
        keyDown(cell, { key: "ArrowDown", shiftKey: true });
        await settled();
        keyDown(cell, { key: "ArrowRight", shiftKey: true });
        await settled();
        expect(changes).toEqual([range([1, 1], [2, 1]), range([1, 1], [2, 2])]);
        expect(cellAt(container, 2, 2)).toHaveAttribute(
            "data-range-edge",
            "bottom end",
        );
        keyDown(cell, { key: "Escape" });
        await settled();
        expect(changes.at(-1)).toBeNull();
        expect(cellAt(container, 2, 2)).not.toHaveAttribute(
            "data-selected-cell",
        );
    });

    it("asks a controlled parent, and follows its prop", async () => {
        const controlled = (selected: CellRange | null): GridProps => ({
            defaultActivePosition: { rowIndex: 0, columnIndex: 0 },
            selectedRange: selected,
            onSelectedRangeChange: (next) => {
                void grid.setProps(controlled(next));
            },
        });
        const grid = await renderGrid(controlled(range([0, 0], [0, 0])));
        const { container } = grid;
        keyDown(cellAt(container, 0, 0), { key: "ArrowDown", shiftKey: true });
        await settled();
        expect(cellAt(container, 1, 0)).toHaveAttribute(
            "data-range-edge",
            "bottom start end",
        );
        // a parent that ignores it: the prop stands
        const ignored = vi.fn();
        const { container: other } = await renderGrid({
            defaultActivePosition: { rowIndex: 0, columnIndex: 0 },
            selectedRange: range([0, 0], [0, 0]),
            onSelectedRangeChange: ignored,
        });
        keyDown(cellAt(other, 0, 0), { key: "ArrowDown", shiftKey: true });
        await settled();
        expect(ignored).toHaveBeenCalledWith(range([0, 0], [1, 0]));
        expect(cellAt(other, 1, 0)).not.toHaveAttribute("data-selected-cell");
    });

    it("goes when the active cell moves off its anchor, a controlled parent told", async () => {
        const onChange = vi.fn();
        const controlled = (selected: CellRange | null): GridProps => ({
            defaultActivePosition: { rowIndex: 1, columnIndex: 1 },
            selectedRange: selected,
            onSelectedRangeChange: (next) => {
                onChange(next);
                void grid.setProps(controlled(next));
            },
        });
        const grid = await renderGrid(controlled(range([1, 1], [2, 2])));
        const { container } = grid;
        expect(cellAt(container, 2, 2)).toHaveAttribute("data-selected-cell");
        // a cell taking focus (a click, a Tab, a control in it): another active cell
        cellAt(container, 4, 0).focus();
        await settled();
        expect(onChange).toHaveBeenLastCalledWith(null);
        expect(cellAt(container, 2, 2)).not.toHaveAttribute(
            "data-selected-cell",
        );
    });

    it("tells an uncontrolled range to start with that the body could not hold", async () => {
        const onChange = vi.fn();
        await renderGrid({
            defaultSelectedRange: range([18, 2], [40, 9]),
            onSelectedRangeChange: onChange,
        });
        expect(onChange).toHaveBeenCalledWith(range([18, 2], [19, 3]));
    });

    it("goes when cellSelection is removed, and is read through a gridRef", async () => {
        const gridRef = createDataGridRef<Item>();
        const grid = await renderGrid(
            { defaultSelectedRange: range([0, 0], [1, 1]) },
            {},
            gridRef,
        );
        expect(gridRef.current?.model.get("selected-range")).toEqual(
            range([0, 0], [1, 1]),
        );
        await grid.setProps({
            cellSelection: undefined,
            defaultSelectedRange: range([0, 0], [1, 1]),
        });
        expect(gridRef.current?.model.get("selected-range")).toBeNull();
        expect(cellAt(grid.container, 0, 0)).not.toHaveAttribute(
            "aria-selected",
        );
    });
});

describe("the clipboard", () => {
    it("copies the range as TSV from a cell, after the consumer's (copy)", async () => {
        const onCopy = vi.fn();
        const { container } = await renderGrid(
            {
                defaultActivePosition: { rowIndex: 1, columnIndex: 1 },
                defaultSelectedRange: range([2, 2], [1, 1]),
            },
            { onCopy },
        );
        const { event, data } = await clipboard(
            "copy",
            cellAt(container, 1, 1),
        );
        expect(onCopy).toHaveBeenCalledTimes(1);
        expect(event.defaultPrevented).toBe(true);
        expect(data.get("text/plain")).toBe("b1\tc1\nb2\tc2");
    });

    it("leaves a copy the consumer prevented alone", async () => {
        const { container } = await renderGrid(
            { defaultActivePosition: { rowIndex: 1, columnIndex: 1 } },
            {
                onCopy: (event) => {
                    event.preventDefault();
                },
            },
        );
        const { data } = await clipboard("copy", cellAt(container, 1, 1));
        expect(data.get("text/plain")).toBe("");
    });

    it("asks beforeRangePaste, then tells rangePaste once with the parsed values", async () => {
        const pastes: RangePaste[] = [];
        const refuse = { current: false };
        const { container } = await renderGrid({
            defaultActivePosition: { rowIndex: 3, columnIndex: 2 },
            onBeforeRangePaste: () => !refuse.current,
            onRangePaste: (paste) => pastes.push(paste),
        });
        const cell = cellAt(container, 3, 2);
        const { event } = await clipboard(
            "paste",
            cell,
            "x\ty\tz\r\n1\t2\t3\r\n",
        );
        expect(event.defaultPrevented).toBe(true);
        expect(pastes).toEqual([
            {
                range: range([3, 2], [4, 3]),
                values: [
                    ["x", "y"],
                    ["1", "2"],
                ],
            },
        ]);
        refuse.current = true;
        await clipboard("paste", cell, "q");
        expect(pastes).toHaveLength(1);
        // the root itself, a field: not the grid's
        await clipboard("paste", root(container), "q");
        expect(pastes).toHaveLength(1);
    });
});
