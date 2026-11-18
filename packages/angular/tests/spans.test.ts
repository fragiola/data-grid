import {
    ChangeDetectionStrategy,
    Component,
    effect,
    input,
} from "@angular/core";
import { describe, expect, it } from "vitest";
import {
    type CellInfo,
    type Column,
    DATA_GRID,
    type DataGridNode,
    injectCell,
} from "../src/public-api";
import { renderTestGrid, SPAN_FEATURES } from "./grid";
import { cellAt, headerAt, render, stubViewportSize } from "./helpers";

// Column spans (Epic #85, E1.2): `dataGridCells` hands one cell per rendered column, a spanning
// cell standing for the ones it covers; the spanning cell is as wide as its columns, with
// `aria-colspan`, and `colSpan` as a table cell; a header cell spanning columns the same.

interface Row {
    id: number;
}

const rows: Row[] = Array.from({ length: 20 }, (_, id) => ({ id }));

/** "a" spans "b" and "c" on even rows; "d"'s header cell spans "e" */
const columns: Column<Row, DataGridNode>[] = [
    {
        key: "a",
        name: "A",
        width: 100,
        colSpan: (args) =>
            args.type === "row" && args.row.id % 2 === 0 ? 3 : undefined,
    },
    { key: "b", name: "B", width: 100 },
    { key: "c", name: "C", width: 100 },
    {
        key: "d",
        name: "D",
        width: 100,
        colSpan: ({ type }) => (type === "header" ? 2 : undefined),
    },
    { key: "e", name: "E", width: 100 },
];

stubViewportSize(800, 235);

const cellsOf = (container: ParentNode, rowIndex: number) =>
    [
        ...container.querySelectorAll(
            `[data-grid-part="cell"][data-row-index="${rowIndex}"]`,
        ),
    ].map((cell) => cell.getAttribute("data-column-index"));

describe("column spans", () => {
    for (const table of [false, true]) {
        it(`render a spanning cell as wide as its columns, the covered ones left out${table ? ", as table cells" : ""}`, async () => {
            const { container } = await renderTestGrid(
                { columns, rows, rowHeight: 20 },
                { table },
            );
            expect(cellsOf(container, 0)).toEqual(["0", "3", "4"]);
            expect(cellsOf(container, 1)).toEqual(["0", "1", "2", "3", "4"]);
            const span = cellAt(container, 0, 0);
            expect(span).toHaveAttribute("aria-colspan", "3");
            expect(span.style.width).toBe("300px");
            expect(cellAt(container, 0, 3).style.left).toBe("300px");
            expect(cellAt(container, 1, 0)).not.toHaveAttribute("aria-colspan");
            const header = headerAt(container, 3);
            expect(header).toHaveAttribute("aria-colspan", "2");
            expect(header.style.width).toBe("200px");
            expect(
                container.querySelector(
                    '[data-grid-part="header-cell"][data-column-index="4"]',
                ),
            ).toBeNull();
            if (table) {
                expect(span.tagName).toBe("TD");
                expect(span).toHaveAttribute("colspan", "3");
                expect(header).toHaveAttribute("colspan", "2");
                expect(cellAt(container, 1, 0)).not.toHaveAttribute("colspan");
            }
        });
    }

    it("hand the children one cell per rendered column, a span for the ones it covers", async () => {
        const seen: string[] = [];
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [features]="spanFeatures" [rows]="rows" [columns]="columns" [rowHeight]="20">
                    <div dataGridGrid>
                        <div dataGridBody>
                            <ng-template dataGridRows let-row>
                                <div [dataGridRow]="row">
                                    <ng-template [dataGridCells]="columns" let-cell>
                                        <div [dataGridCell]="cell">{{ see(cell) }}</div>
                                    </ng-template>
                                </div>
                            </ng-template>
                        </div>
                    </div>
                </div>
            `,
        })
        class Seeing {
            readonly spanFeatures = SPAN_FEATURES;
            readonly rows = rows;
            readonly columns = columns;
            see(cell: CellInfo<Row>) {
                if (cell.rowIndex === 2) seen.push(cell.column.key);
                return "";
            }
        }
        await render(Seeing);
        expect([...new Set(seen)]).toEqual(["a", "d", "e"]);
    });
});

// Vue's and React's `render` function is an injection function in Angular: `injectCell(cell)`,
// its props on the app's element through `[dataGridBind]`
describe("a render function (the epic review)", () => {
    it("finds a body cell's span in its props' aria-colspan", async () => {
        const seen = new Map<string, unknown>();
        @Component({
            selector: "test-cell",
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `<div [dataGridBind]="part.props()"></div>`,
        })
        class TestCell {
            readonly cell = input.required<CellInfo<Row>>();
            readonly part = injectCell(this.cell);
            constructor() {
                effect(() => {
                    const cell = this.cell();
                    seen.set(
                        `${cell.rowIndex}:${cell.columnIndex}`,
                        this.part.props()["aria-colspan"],
                    );
                });
            }
        }
        @Component({
            imports: [DATA_GRID, TestCell],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [features]="spanFeatures" [rows]="rows" [columns]="columns" [rowHeight]="20">
                    <div dataGridGrid>
                        <div dataGridBody>
                            <ng-template dataGridRows let-row>
                                <div [dataGridRow]="row">
                                    <ng-template [dataGridCells]="columns" let-cell>
                                        <test-cell [cell]="cell" />
                                    </ng-template>
                                </div>
                            </ng-template>
                        </div>
                    </div>
                </div>
            `,
        })
        class Rendering {
            readonly spanFeatures = SPAN_FEATURES;
            readonly rows = rows;
            readonly columns = columns;
        }
        await render(Rendering);
        // row 0 is even: "a" spans 3
        expect(seen.get("0:0")).toBe(3);
        expect(seen.get("1:0")).toBeUndefined();
    });
});
