import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { describe, expect, it } from "vitest";
import {
    type Column,
    DATA_GRID,
    type DataGridNode,
    type GridDirection,
    injectDataGrid,
} from "../src/public-api";
import {
    cellAt,
    click,
    render,
    root,
    rowAt,
    settled,
    stubViewportSize,
} from "./helpers";

// Pinned end columns and right to left (Epic #85, E1.1): a column pinned at the end is sticky in
// its row's flow like one pinned at the start (`data-pinned="end"`, its part's edge on the first);
// right to left, the root carries `dir` and every structural inset the primitives and the engine
// write is on the right, the same numbers as on the left left to right.

interface Row {
    id: number;
}

const rows: Row[] = Array.from({ length: 100 }, (_, id) => ({ id }));

const column = (
    key: string,
    pinned?: "start" | "end",
): Column<Row, DataGridNode> => ({
    key,
    name: key,
    width: 100,
    ...(pinned ? { pinned } : {}),
});

/** "a" pinned at the start, 30 that scroll, "y" and "z" pinned at the end */
const columns: Column<Row, DataGridNode>[] = [
    column("a", "start"),
    ...Array.from({ length: 30 }, (_, i) => column(`c${i}`)),
    column("y", "end"),
    column("z", "end"),
];

stubViewportSize(500, 235);

/** The grid: every part, each row's detail, an empty state; in a page of `page`'s direction. */
@Component({
    selector: "test-direction-grid",
    imports: [DATA_GRID],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [style.direction]="page() ?? null">
            <div dataGridRoot [columns]="cells()" [rows]="rows" [rowHeight]="20"
                [direction]="direction()" [defaultExpandedRowKeys]="expanded() ? [0] : undefined">
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
                                <tr [dataGridRow]="row">
                                    <ng-template dataGridCells let-cell>
                                        <td [dataGridCell]="cell"><ng-container *dataGridCellContent /></td>
                                    </ng-template>
                                    <td *dataGridRowDetail>detail</td>
                                </tr>
                            </ng-template>
                        </tbody>
                        <td *dataGridEmpty></td>
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
                                        <div [dataGridCell]="cell"><ng-container *dataGridCellContent /></div>
                                    </ng-template>
                                    <div *dataGridRowDetail>detail</div>
                                </div>
                            </ng-template>
                        </div>
                        <div *dataGridEmpty></div>
                    </div>
                }
            </div>
        </div>
    `,
})
class DirectionGrid {
    readonly rows = rows;
    readonly cells = input<readonly Column<Row, DataGridNode>[]>(columns);
    readonly table = input(false);
    readonly direction = input<GridDirection | undefined>(undefined);
    readonly expanded = input(false);
    /** the page's direction around the grid (its CSS `direction`) */
    readonly page = input<GridDirection | undefined>(undefined);
}

interface GridOptions {
    cells?: Column<Row, DataGridNode>[];
    table?: boolean;
    direction?: GridDirection | undefined;
    expanded?: boolean;
    page?: GridDirection;
}

function grid(options: GridOptions = {}) {
    return render(DirectionGrid, (fixture) => {
        for (const [name, value] of Object.entries(options)) {
            fixture.componentRef.setInput(name, value);
        }
    });
}

const body = (container: ParentNode) =>
    container.querySelector<HTMLElement>('[data-grid-part="body"]');

describe("columns pinned at the end", () => {
    for (const table of [false, true]) {
        it(`are last in each row, sticky in its flow at the engine's inset, the first one their edge${table ? ", as table cells" : ""}`, async () => {
            const { container } = await grid({ table });
            for (const rowIndex of [-1, 0]) {
                const y = cellAt(container, rowIndex, 31);
                const z = cellAt(container, rowIndex, 32);
                expect(y).toHaveAttribute("data-pinned", "end");
                expect(y).toHaveAttribute("data-pinned-edge", "");
                expect(z).toHaveAttribute("data-pinned", "end");
                expect(z).not.toHaveAttribute("data-pinned-edge");
                expect(cellAt(container, rowIndex, 0)).toHaveAttribute(
                    "data-pinned",
                    "start",
                );
                expect(y.style.position).toBe("sticky");
                // the view's end less their 200px: 300 and 400 from its start, the layers
                // moved by the rendered columns' base (100px)
                expect(y.style.left).toBe(`${3_100 - 100 + 500 - 3_300}px`);
                expect(z.style.left).toBe(`${3_200 - 100 + 500 - 3_300}px`);
                expect(z.parentElement?.lastElementChild).toBe(z);
            }
            expect(rowAt(container, 0).style.display).toBe("flex");
        });
    }

    it("make every row a flex container, with no column pinned at the start", async () => {
        const { container } = await grid({
            cells: columns.filter((entry) => entry.pinned !== "start"),
        });
        expect(rowAt(container, 0).style.display).toBe("flex");
        expect(cellAt(container, 0, 30)).toHaveAttribute("data-pinned", "end");
    });

    it("put a detail at the row's start, before both pinned parts", async () => {
        const { container } = await grid({ expanded: true });
        const detail = container.querySelector<HTMLElement>(
            '[data-grid-part="row-detail"][data-row-index="0"]',
        );
        expect(detail?.style.marginLeft).toBe("-300px");
        expect(detail?.style.marginRight).toBe("");
    });
});

describe("right to left", () => {
    it("carries `dir` on the root only when a direction is given", async () => {
        const none = (await grid()).container;
        const ltr = (await grid({ direction: "ltr" })).container;
        const rtl = (await grid({ direction: "rtl" })).container;
        expect(root(none)).not.toHaveAttribute("dir");
        expect(root(ltr)).toHaveAttribute("dir", "ltr");
        expect(root(rtl)).toHaveAttribute("dir", "rtl");
    });

    for (const table of [false, true]) {
        it(`places every part from the right, as left to right from the left${table ? ", as table elements" : ""}`, async () => {
            const ltr = (await grid({ table, expanded: true })).container;
            const rtl = (
                await grid({ table, expanded: true, direction: "rtl" })
            ).container;
            const pairs: [HTMLElement | null, HTMLElement | null][] = [
                [body(ltr), body(rtl)],
                [rowAt(ltr, 1), rowAt(rtl, 1)],
                [cellAt(ltr, 1, 3), cellAt(rtl, 1, 3)],
                [cellAt(ltr, -1, 3), cellAt(rtl, -1, 3)],
                // the engine's insets
                [cellAt(ltr, 1, 0), cellAt(rtl, 1, 0)],
                [cellAt(ltr, -1, 32), cellAt(rtl, -1, 32)],
                [
                    ltr.querySelector('[data-grid-part="row-detail"]'),
                    rtl.querySelector('[data-grid-part="row-detail"]'),
                ],
            ];
            for (const [left, right] of pairs) {
                if (!left || !right) throw new Error("a part is missing");
                expect(left.style.left).toMatch(/px$/);
                expect(right.style.right).toBe(left.style.left);
                expect(right.style.left).toBe("");
            }
            const detail = rtl.querySelector<HTMLElement>(
                '[data-grid-part="row-detail"]',
            );
            expect(detail?.style.marginRight).toBe("-300px");
            expect(detail?.style.marginLeft).toBe("");
            // the layers move toward the start: the left
            expect(body(rtl)?.style.transform).toBe(
                body(ltr)?.style.transform.replace("(", "(-"),
            );
            // ARIA does not change
            expect(cellAt(rtl, 1, 3)).toHaveAttribute("aria-colindex", "4");
        });
    }

    it("takes the page's direction without a prop of its own, adding no `dir`", async () => {
        const { container } = await grid({ page: "rtl" });
        expect(root(container)).not.toHaveAttribute("dir");
        expect(cellAt(container, 1, 3).style.right).toMatch(/px$/);
        expect(cellAt(container, 1, 3).style.left).toBe("");
        expect(cellAt(container, 1, 0).style.right).toMatch(/px$/);
    });

    it("lets its prop win over the page's", async () => {
        const { container } = await grid({ page: "rtl", direction: "ltr" });
        expect(root(container)).toHaveAttribute("dir", "ltr");
        expect(cellAt(container, 1, 3).style.left).toMatch(/px$/);
        expect(cellAt(container, 1, 3).style.right).toBe("");
    });

    it("keeps the empty state at the view's start", async () => {
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [columns]="columns" [rows]="[]" direction="rtl">
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
                        <div dataGridBody></div>
                        <div *dataGridEmpty></div>
                    </div>
                </div>
            `,
        })
        class Empty {
            readonly columns = columns;
        }
        const { container } = await render(Empty);
        const empty = container.querySelector<HTMLElement>(
            '[data-grid-part="empty-area"]',
        );
        expect(empty?.style.right).toBe("0px");
        expect(empty?.style.left).toBe("");
    });

    it("follows its prop: the parts and the engine's insets change sides", async () => {
        const { container, fixture } = await grid();
        const inset = cellAt(container, 1, 0).style.left;
        fixture.componentRef.setInput("direction", "rtl");
        await settled(fixture);
        expect(root(container)).toHaveAttribute("dir", "rtl");
        expect(cellAt(container, 1, 0).style.left).toBe("");
        expect(cellAt(container, 1, 0).style.right).toBe(inset);
        expect(cellAt(container, 1, 3).style.left).toBe("");
        expect(cellAt(container, 1, 3).style.right).toMatch(/px$/);
        fixture.componentRef.setInput("direction", undefined);
        await settled(fixture);
        expect(root(container)).not.toHaveAttribute("dir");
        expect(cellAt(container, 1, 0).style.right).toBe("");
        expect(cellAt(container, 1, 0).style.left).toBe(inset);
    });
});

describe("the root's dir (the epic review)", () => {
    // "is rendered from the direction given, on the server too": server rendering is React's
    // (Angular SSR is out of scope)

    it("follows a direction set by command, and drops it taken back", async () => {
        @Component({
            selector: "test-commands",
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <button type="button" data-testid="rtl" (click)="set('rtl')"></button>
                <button type="button" data-testid="page" (click)="set(null)"></button>
            `,
        })
        class Commands {
            private readonly grid = injectDataGrid();
            set(direction: GridDirection | null) {
                this.grid.model.run("direction.set", { direction });
            }
        }
        @Component({
            imports: [DATA_GRID, Commands],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [columns]="columns" [rows]="[]">
                    <test-commands />
                </div>
            `,
        })
        class WithCommands {
            readonly columns = columns;
        }
        const { container } = await render(WithCommands);
        const button = (id: string) => {
            const element = container.querySelector(`[data-testid="${id}"]`);
            if (!(element instanceof HTMLElement)) throw new Error(id);
            return element;
        };
        expect(root(container)).not.toHaveAttribute("dir");
        click(button("rtl"));
        await settled();
        expect(root(container)).toHaveAttribute("dir", "rtl");
        click(button("page"));
        await settled();
        expect(root(container)).not.toHaveAttribute("dir");
    });
});
