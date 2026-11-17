import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    signal,
} from "@angular/core";
import type { ComponentFixture } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { describe, expect, it } from "vitest";
import {
    type Column,
    DATA_GRID,
    type DataGridNode,
    DataGridRoot,
} from "../src/public-api";
import { renderTestGrid } from "./grid";
import {
    cellAt,
    keyDown,
    render,
    root,
    settled,
    stubViewportSize,
} from "./helpers";

// Summary rows (Epic #86, E2.1): `*dataGridSummary` renders a position's rows sticky (the top
// ones under the header, the bottom ones at the visible body's bottom edge), each a
// `[dataGridSummaryRow]` of `[dataGridSummaryCell]`s drawn by the columns' `renderSummaryCell`
// from the app's own values. Nothing renders without them, and a grid without them renders as
// before.

interface Row {
    id: number;
    amount: number;
}

const rows: Row[] = Array.from({ length: 20 }, (_, id) => ({
    id,
    amount: id * 10,
}));
const total = rows.reduce((sum, row) => sum + row.amount, 0);

const columns: Column<Row, DataGridNode>[] = [
    {
        key: "id",
        name: "Id",
        width: 100,
        pinned: "start",
        renderSummaryCell: ({ position }) =>
            position === "top" ? "Top" : "Total",
    },
    {
        key: "amount",
        name: "Amount",
        width: 100,
        renderSummaryCell: ({ summaryIndex }) =>
            summaryIndex === 0 ? String(total) : "average",
        colSpan: (args) =>
            args.type === "summary" && args.summaryIndex === 1 ? 2 : undefined,
    },
    { key: "c", name: "C", width: 100 },
];

// a 35px header, two 30px summary rows: 300 − 35 − 30 − 60 = 175 for the body
stubViewportSize(800, 300);

/** The grid of a rendered fixture (Vue's `useDataGrid()` in a probe): its root's model and engine. */
const gridOf = (fixture: ComponentFixture<unknown>) =>
    fixture.debugElement
        .query(By.directive(DataGridRoot))
        .injector.get(DataGridRoot);

const summaryCell = (
    container: ParentNode,
    rowIndex: number,
    columnIndex: number,
) =>
    container.querySelector<HTMLElement>(
        `[data-grid-part="summary-cell"][data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`,
    );

const part = (container: ParentNode, position: string) =>
    container.querySelector<HTMLElement>(
        `[data-grid-part="summary"][data-summary="${position}"]`,
    );

/** The test grid with summary parts, the test's sizes and `summaryRows`. */
const summaryGrid = (
    summaryRows: { top?: number; bottom?: number } | undefined,
    table = false,
) =>
    renderTestGrid(
        {
            columns,
            rows,
            rowHeight: 20,
            summaryRows,
            summaryRowHeight: 30,
        },
        { table, summary: true },
    );

describe("summary rows", () => {
    for (const table of [false, true]) {
        it(`render sticky, with the app's values, ARIA and data-summary${table ? ", as table parts" : ""}`, async () => {
            const { container } = await summaryGrid(
                { top: 1, bottom: 2 },
                table,
            );
            const top = part(container, "top");
            const bottom = part(container, "bottom");
            expect(top?.tagName).toBe(table ? "TBODY" : "DIV");
            expect(bottom?.tagName).toBe(table ? "TFOOT" : "DIV");
            expect(top).toHaveAttribute("role", "rowgroup");
            expect(top?.style.position).toBe("sticky");
            expect(top?.style.top).toBe("35px");
            expect(top?.style.height).toBe("30px");
            // stuck at the view's bottom edge: a percentage of its height, no measure
            expect(bottom?.style.top).toBe("calc(100% - 60px)");
            expect(bottom?.style.height).toBe("60px");
            // the top one's row before the header's: -2; the bottom ones after the body's
            expect(summaryCell(container, -2, 0)).toHaveTextContent("Top");
            expect(summaryCell(container, -2, 1)).toHaveTextContent(
                String(total),
            );
            expect(summaryCell(container, 20, 0)).toHaveTextContent("Total");
            expect(summaryCell(container, 21, 1)).toHaveTextContent("average");
            const row = container.querySelector(
                '[data-grid-part="summary-row"][data-row-index="21"]',
            );
            expect(row).toHaveAttribute("role", "row");
            expect(row).toHaveAttribute("aria-rowindex", "24");
            expect(row).toHaveAttribute("data-summary", "bottom");
            expect((row as HTMLElement).style.top).toBe("30px");
            expect(
                container.querySelector(
                    '[data-grid-part="summary-row"][data-row-index="-2"]',
                ),
            ).toHaveAttribute("aria-rowindex", "2");
            expect(
                cellAt(container, 0, 0).closest('[role="row"]'),
            ).toHaveAttribute("aria-rowindex", "3");
            expect(
                root(container).querySelector('[role="grid"]'),
            ).toHaveAttribute("aria-rowcount", String(1 + 1 + 20 + 2));
            const own = summaryCell(container, 20, 1);
            expect(own).toHaveAttribute("role", "gridcell");
            expect(own).toHaveAttribute("aria-colindex", "2");
            expect(own).toHaveAttribute("data-summary", "bottom");
            expect(own?.style.height).toBe("30px");
            // pinned with the body's
            expect(summaryCell(container, 20, 0)).toHaveAttribute(
                "data-pinned",
                "start",
            );
            expect(summaryCell(container, 20, 0)?.style.position).toBe(
                "sticky",
            );
            // spanning with its column's colSpan
            const span = summaryCell(container, 21, 1);
            expect(span).toHaveAttribute("aria-colspan", "2");
            expect(span?.style.width).toBe("200px");
            if (table) expect(span).toHaveAttribute("colspan", "2");
            expect(summaryCell(container, 21, 2)).toBeNull();
            // the body sits below the header and the top summary row
            const body = container.querySelector<HTMLElement>(
                '[data-grid-part="body"]',
            );
            expect(body?.style.top).toBe("65px");
            const sizer = container.querySelector<HTMLElement>(
                '[data-grid-part="grid"]',
            );
            expect(sizer?.style.height).toBe(`${35 + 90 + 20 * 20}px`);
        });
    }

    it("render nothing without summary rows, the grid as before", async () => {
        const { container } = await summaryGrid(undefined);
        expect(part(container, "top")).toBeNull();
        expect(part(container, "bottom")).toBeNull();
        expect(container.querySelector('[data-grid-part="body"]')).toHaveStyle({
            top: "35px",
        });
        expect(
            container.querySelector('[data-grid-part="grid"]'),
        ).toHaveAttribute("aria-rowcount", "21");
    });

    it("follow the prop: new counts, and none once it is removed", async () => {
        const { container, fixture, setProps } = await summaryGrid({
            bottom: 1,
        });
        const grid = gridOf(fixture);
        const update = (
            summaryRows: { top?: number; bottom?: number } | undefined,
        ) =>
            setProps({
                columns,
                rows,
                rowHeight: 20,
                summaryRows,
                summaryRowHeight: 30,
            });
        expect(part(container, "top")).toBeNull();
        expect(grid.model.get("summary-rows")).toEqual({ top: 0, bottom: 1 });
        await update({ top: 2, bottom: 1 });
        expect(grid.model.get("summary-rows")).toEqual({ top: 2, bottom: 1 });
        expect(summaryCell(container, -3, 0)).toHaveTextContent("Top");
        await update(undefined);
        expect(grid.model.get("summary-rows")).toEqual({ top: 0, bottom: 0 });
        expect(part(container, "bottom")).toBeNull();
    });

    it("make a summary cell the roving tab stop, and take the keys", async () => {
        const { container, fixture } = await summaryGrid({
            top: 1,
            bottom: 2,
        });
        const grid = gridOf(fixture);
        grid.model.run("active-position.set", {
            rowIndex: 20,
            columnIndex: 2,
        });
        await settled(fixture);
        const active = summaryCell(container, 20, 2);
        expect(active).toHaveAttribute("tabindex", "0");
        expect(active).toHaveAttribute("data-active", "");
        expect(
            container.querySelector(
                '[data-grid-part="summary-row"][data-row-index="20"]',
            ),
        ).toHaveAttribute("data-active", "");
        if (!active) throw new Error("no active cell");
        keyDown(active, { key: "ArrowUp" });
        await settled(fixture);
        expect(grid.model.get("active-position")).toEqual({
            rowIndex: 19,
            columnIndex: 2,
        });
        keyDown(cellAt(container, 19, 2), { key: "ArrowDown" });
        await settled(fixture);
        keyDown(summaryCell(container, 20, 2) as HTMLElement, {
            key: "ArrowDown",
        });
        await settled(fixture);
        // into the span: it is active on any of its columns
        expect(grid.model.get("active-position")).toEqual({
            rowIndex: 21,
            columnIndex: 1,
        });
    });

    // Angular: no `render` function, `ref` prop merging nor `className`/`style` functions; the
    // directives are on the app's own elements (a span for the cell), state-based classes and
    // attributes are bindings from the template's `let state` or the part's exported state
    it("follow the primitive contract: render, ref, className and style functions, forwarded props", async () => {
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [rows]="rows" [columns]="columns" [summaryRows]="{ top: 1 }">
                    <div dataGridGrid>
                        <!-- structural keys win -->
                        <div *dataGridSummary="'top'; let state" data-testid="summary"
                            style="top: 3px; color: red" [class]="'summary-' + state.position">
                            <ng-template dataGridSummaryRows let-row>
                                <div [dataGridSummaryRow]="row" #own="dataGridSummaryRow"
                                    style="transform: none" [attr.class]="'row-' + own.state()?.summaryIndex">
                                    <ng-template dataGridSummaryCells let-cell>
                                        <span [dataGridSummaryCell]="cell" #c="dataGridSummaryCell"
                                            [attr.data-position]="c.state()?.position">{{ cell.columnIndex }}</span>
                                    </ng-template>
                                </div>
                            </ng-template>
                        </div>
                    </div>
                </div>
            `,
        })
        class Contract {
            readonly rows = rows;
            readonly columns = columns;
        }
        const { container } = await render(Contract);
        const summary = container.querySelector<HTMLElement>(
            '[data-testid="summary"]',
        );
        expect(summary).toHaveAttribute("data-grid-part", "summary");
        expect(summary).toHaveClass("summary-top");
        expect(summary?.style.top).toBe("35px");
        expect(summary?.style.color).toBe("red");
        const row = container.querySelector<HTMLElement>(
            '[data-grid-part="summary-row"]',
        );
        expect(row).toHaveClass("row-0");
        // the layer's transform is the engine's
        expect(row?.style.transform).not.toBe("none");
        const own = summaryCell(container, -2, 1);
        expect(own?.tagName).toBe("SPAN");
        expect(own).toHaveAttribute("data-position", "top");
        expect(own).toHaveTextContent("1");
        // no name of its own
        expect(summary).not.toHaveAttribute("aria-label");
        expect(own).not.toHaveAttribute("aria-label");
    });

    it("render a summary cell empty without renderSummaryCell, and keep a nested grid's rows its own", async () => {
        const plain: Column<Row, DataGridNode>[] = [{ key: "id", width: 100 }];
        const { container } = await renderTestGrid(
            { columns: plain, rows, summaryRows: { bottom: 1 } },
            { summary: true },
        );
        const own = summaryCell(container, 20, 0);
        expect(own).toBeEmptyDOMElement();
        @Component({
            imports: [DATA_GRID],
            template: `
                <div dataGridRoot [rows]="rows" [columns]="columns">
                    <ng-template dataGridSummaryCells let-cell></ng-template>
                </div>
            `,
        })
        class Outside {
            readonly rows = rows;
            readonly columns = plain;
        }
        await expect(render(Outside)).rejects.toThrow(/SummaryRow/);
    });

    it("tell a controlled parent where its active summary row went when the rows change", async () => {
        const changes: unknown[] = [];
        const propsOf = (count: number) => ({
            columns,
            rows: rows.slice(0, count),
            summaryRows: { bottom: 1 },
            activePosition: { rowIndex: 20, columnIndex: 2 },
            onActivePositionChange: (position: unknown) =>
                changes.push(position),
        });
        const { fixture, setProps } = await renderTestGrid(propsOf(20), {
            summary: true,
        });
        const grid = gridOf(fixture);
        expect(changes).toEqual([]);
        await setProps(propsOf(5));
        // the bottom summary row is at 5 now: the parent is told
        expect(grid.model.get("active-position")).toEqual({
            rowIndex: 5,
            columnIndex: 2,
        });
        expect(changes.length).toBeGreaterThan(0);
        for (const change of changes) {
            expect(change).toEqual({ rowIndex: 5, columnIndex: 2 });
        }
    });

    it("draw their cells again for summary-rows.changed, and with the app's own children", async () => {
        const figures = { total: 1 };
        const live: Column<Row, DataGridNode>[] = [
            {
                key: "id",
                width: 100,
                renderSummaryCell: () => `total ${figures.total}`,
            },
        ];
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [rows]="rows" [columns]="columns" [summaryRows]="{ top: 1 }">
                    <div dataGridGrid>
                        <div *dataGridSummary="'top'">
                            <ng-template dataGridSummaryRows let-row>
                                <div [dataGridSummaryRow]="row">
                                    <ng-template dataGridSummaryCells let-cell>
                                        <div [dataGridSummaryCell]="cell">{{ note() }} <ng-container *dataGridCellContent /></div>
                                    </ng-template>
                                </div>
                            </ng-template>
                        </div>
                    </div>
                </div>
            `,
        })
        class Live {
            readonly rows = rows;
            readonly columns = live;
            readonly note = signal("a");
        }
        const { container, fixture, component } = await render(Live);
        const grid = gridOf(fixture);
        const own = () => summaryCell(container, -2, 0);
        expect(own()).toHaveTextContent("a total 1");
        // the app's state, read where it renders the cell
        component.note.set("b");
        await settled(fixture);
        expect(own()).toHaveTextContent("b total 1");
        // data behind the same columns: told to the grid
        figures.total = 2;
        grid.model.run("summary-rows.changed");
        await settled(fixture);
        expect(own()).toHaveTextContent("b total 2");
    });
});

describe("a summary cell's controls", () => {
    @Component({
        imports: [DATA_GRID],
        changeDetection: ChangeDetectionStrategy.OnPush,
        template: `
            <div dataGridRoot [rows]="visible()" [columns]="columns" [rowHeight]="20"
                [summaryRows]="{ bottom: 1 }" [summaryRowHeight]="30">
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
                            </div>
                        </ng-template>
                    </div>
                    <div *dataGridSummary="'bottom'">
                        <ng-template dataGridSummaryRows let-row>
                            <div [dataGridSummaryRow]="row">
                                <ng-template dataGridSummaryCells let-cell>
                                    <div [dataGridSummaryCell]="cell">
                                        @if (cell.columnIndex === 2) {
                                            <input aria-label="Note" />
                                        }
                                    </div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                </div>
            </div>
        `,
    })
    class Editable {
        readonly columns = columns;
        readonly count = input.required<number>();
        readonly visible = computed(() => rows.slice(0, this.count()));
    }

    it("keep the keys and focus while rows are added above them", async () => {
        const { container, fixture } = await render(Editable, (created) =>
            created.componentRef.setInput("count", 10),
        );
        const grid = gridOf(fixture);
        const input = container.querySelector("input");
        if (!input) throw new Error("no input");
        input.focus();
        await settled(fixture);
        expect(grid.engine.get("interaction")).toEqual({
            rowIndex: 10,
            columnIndex: 2,
        });
        fixture.componentRef.setInput("count", 15);
        await settled(fixture);
        expect(grid.model.get("active-position")).toEqual({
            rowIndex: 15,
            columnIndex: 2,
        });
        expect(grid.engine.get("interaction")).toEqual({
            rowIndex: 15,
            columnIndex: 2,
        });
        expect(document.activeElement).toBe(input);
        expect(input.closest("[data-interacting]")).not.toBeNull();
    });
});
