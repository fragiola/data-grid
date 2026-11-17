import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { describe, expect, it } from "vitest";
import {
    type CellPosition,
    type CellRange,
    type Column,
    DATA_GRID,
    type DataGridNode,
    type RangeFill,
} from "../src/public-api";
import { cellAt, render, settled, stubViewportSize } from "./helpers";

// The fill handle (Epic #88, E4.4): the root's `fillable` turns filling on; `*dataGridFillHandle`
// renders the app's element, with its mark, in the cell at the range's corner (else the active
// cell), none elsewhere; a press on it dragged and released past the source tells `(fill)` once,
// as divs or as a table, and the range grows to the filled cells.

interface Item {
    id: number;
}

const items: Item[] = Array.from({ length: 20 }, (_, id) => ({ id }));

const columns: Column<Item, DataGridNode>[] = ["a", "b", "c"].map((key) => ({
    key,
    width: 100,
}));

stubViewportSize(400, 300);

@Component({
    selector: "test-fill-grid",
    imports: [DATA_GRID],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div dataGridRoot [rows]="rows" [columns]="columns" [rowHeight]="20" [headerRowHeight]="0"
            cellSelection="range" [defaultActivePosition]="active" [defaultSelectedRange]="selected"
            [fillable]="fills() !== undefined" (fill)="fills()?.push($event)">
            @if (table()) {
                <table dataGridGrid>
                    <tbody dataGridBody>
                        <ng-template dataGridRows let-row>
                            <tr [dataGridRow]="row">
                                <ng-template dataGridCells let-cell>
                                    <td [dataGridCell]="cell"><ng-container *dataGridCellContent /><span *dataGridFillHandle="cell" data-testid="handle"></span></td>
                                </ng-template>
                            </tr>
                        </ng-template>
                    </tbody>
                </table>
            } @else {
                <div dataGridGrid>
                    <div dataGridBody>
                        <ng-template dataGridRows let-row>
                            <div [dataGridRow]="row">
                                <ng-template dataGridCells let-cell>
                                    <div [dataGridCell]="cell"><ng-container *dataGridCellContent /><span *dataGridFillHandle="cell" data-testid="handle"></span></div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                </div>
            }
        </div>
    `,
})
class FillGrid {
    readonly rows = items;
    readonly columns = columns;
    readonly active: CellPosition = { rowIndex: 1, columnIndex: 1 };
    readonly selected: CellRange = {
        anchor: { rowIndex: 1, columnIndex: 1 },
        focus: { rowIndex: 2, columnIndex: 1 },
    };
    readonly table = input(false);
    /** the fills told; none: not fillable */
    readonly fills = input<RangeFill[]>();
}

const renderGrid = ({
    table = false,
    fills,
}: {
    table?: boolean;
    fills?: RangeFill[];
} = {}) =>
    render(FillGrid, (fixture) => {
        fixture.componentRef.setInput("table", table);
        fixture.componentRef.setInput("fills", fills);
    });

/** A pointer event of the primary button at `x`, `y` (jsdom lays the grid out at 0, 0). */
async function pointer(
    target: EventTarget,
    type: string,
    x: number,
    y: number,
) {
    target.dispatchEvent(
        new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            button: 0,
            buttons: type === "pointerup" ? 0 : 1,
            pointerId: 1,
            clientX: x,
            clientY: y,
        }),
    );
    await settled();
}

const handlesOf = (container: ParentNode) => [
    ...container.querySelectorAll<HTMLElement>('[data-testid="handle"]'),
];

for (const table of [false, true]) {
    describe(`the fill handle, as ${table ? "a table" : "divs"}`, () => {
        it("marks one element, in the range's last cell, and tells a drop once", async () => {
            const fills: RangeFill[] = [];
            const { container } = await renderGrid({ table, fills });
            const handles = handlesOf(container);
            expect(handles).toHaveLength(1);
            const handle = handles[0];
            if (!handle) throw new Error("no handle");
            expect(cellAt(container, 2, 1)).toContainElement(handle);
            expect(handle).toHaveAttribute("data-grid-part", "fill-handle");
            expect(handle).toHaveAttribute("data-grid-fill-handle", "2");
            // rows of 20px: row 5 at y 100–120
            await pointer(handle, "pointerdown", 150, 50);
            expect(handle).toHaveAttribute("data-filling", "");
            await pointer(document, "pointerup", 150, 110);
            expect(fills).toEqual([
                {
                    source: {
                        anchor: { rowIndex: 1, columnIndex: 1 },
                        focus: { rowIndex: 2, columnIndex: 1 },
                    },
                    target: {
                        anchor: { rowIndex: 3, columnIndex: 1 },
                        focus: { rowIndex: 5, columnIndex: 1 },
                    },
                },
            ]);
            // the range grows to the filled cells: the handle at its new corner
            expect(cellAt(container, 5, 1)).toContainElement(
                handlesOf(container)[0] ?? null,
            );
        });
    });
}

describe("without fillable", () => {
    it("renders no handle and marks nothing", async () => {
        const { container } = await renderGrid();
        expect(handlesOf(container)).toEqual([]);
        expect(
            container.querySelector(
                "[data-fill-target], [data-grid-fill-handle]",
            ),
        ).toBeNull();
    });
});
