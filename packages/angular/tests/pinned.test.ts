import { NgClass } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { describe, expect, it } from "vitest";
import {
    type Column,
    type ColumnOrGroup,
    DATA_GRID,
    type DataGridNode,
} from "../src/public-api";
import { TEST_FEATURES } from "./grid";
import {
    cellAt,
    render,
    scrollRoot,
    settled,
    stubViewportSize,
} from "./helpers";

// Pinned columns (Epic #31, P3 and P5; Epic #38): pinned cells and header cells carry
// `data-pinned` and `data-pinned-edge`, sit sticky in their row's flow (rows are flex containers
// then) at the inset the engine writes (a consumer's transform and insets are dropped), and a grid
// without pinned columns renders as before.

interface Row {
    id: number;
}

const rows: Row[] = Array.from({ length: 100 }, (_, id) => ({ id }));

const plain = (key: string): Column<Row, DataGridNode> => ({
    key,
    name: key,
    width: 100,
});
const pinned = (key: string): Column<Row, DataGridNode> => ({
    ...plain(key),
    pinned: "start",
});

const columns: Column<Row, DataGridNode>[] = [
    pinned("a"),
    pinned("b"),
    ...Array.from({ length: 30 }, (_, i) => plain(`c${i}`)),
];

stubViewportSize(500, 235);

// What a consumer might give a cell (the `style` attribute below): a transform and insets
// (dropped on pinned cells), a colour. React's `className` functions and Vue's `render` slot read
// the cell's state: here `#body="dataGridCell"` and its `state()` do, through `[ngClass]` (a
// directive input, set after the part's own input; a `[class.x]` binding is evaluated before the
// element's inputs, while the part's required input is not set yet: NG0950).

/** The pinned classes of a cell's state. */
const pinnedClass = (
    state: { pinned: boolean; pinnedEdge: boolean } | undefined,
): string | null =>
    !state
        ? null
        : state.pinned
          ? state.pinnedEdge
              ? "pinned edge"
              : "pinned"
          : null;

@Component({
    selector: "test-pinned-grid",
    imports: [DATA_GRID, NgClass],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div dataGridRoot [features]="testFeatures" [columns]="cells()" [rows]="rows" [rowHeight]="20">
            @if (table()) {
                <table dataGridGrid>
                    <thead *dataGridHeader>
                        <ng-template dataGridHeaderRows let-row>
                            <tr [dataGridHeaderRow]="row">
                                <ng-template dataGridHeaderCells let-cell>
                                    <th [dataGridHeaderCell]="cell" #header="dataGridHeaderCell"
                                        [ngClass]="pinnedClass(header.state())"
                                        style="transform: scale(2); top: 3px; left: 7px; right: 9px; color: red"><ng-container *dataGridCellContent /></th>
                                </ng-template>
                            </tr>
                        </ng-template>
                    </thead>
                    <tbody dataGridBody>
                        <ng-template dataGridRows let-row>
                            <tr [dataGridRow]="row">
                                <ng-template dataGridCells let-cell>
                                    <td [dataGridCell]="cell" #body="dataGridCell"
                                        [ngClass]="pinnedClass(body.state())"
                                        style="transform: scale(2); top: 3px; left: 7px; right: 9px; color: red"><ng-container *dataGridCellContent /></td>
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
                                    <div [dataGridHeaderCell]="cell" #header="dataGridHeaderCell"
                                        [ngClass]="pinnedClass(header.state())"
                                        style="transform: scale(2); top: 3px; left: 7px; right: 9px; color: red"><ng-container *dataGridCellContent /></div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                    <div dataGridBody>
                        <ng-template dataGridRows let-row>
                            <div [dataGridRow]="row">
                                <ng-template dataGridCells let-cell>
                                    <div [dataGridCell]="cell" #body="dataGridCell"
                                        [ngClass]="pinnedClass(body.state())"
                                        style="transform: scale(2); top: 3px; left: 7px; right: 9px; color: red"><ng-container *dataGridCellContent /></div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                </div>
            }
        </div>
    `,
})
class PinnedGrid {
    readonly testFeatures = TEST_FEATURES;
    readonly rows = rows;
    readonly pinnedClass = pinnedClass;
    readonly cells =
        input<readonly ColumnOrGroup<Row, DataGridNode>[]>(columns);
    readonly table = input(false);
}

/** Renders the pinned grid with `cells` (the columns by default), as a table or as divs. */
function grid({
    cells,
    table = false,
}: {
    cells?: readonly ColumnOrGroup<Row, DataGridNode>[];
    table?: boolean;
} = {}) {
    return render(PinnedGrid, (fixture) => {
        if (cells) fixture.componentRef.setInput("cells", cells);
        fixture.componentRef.setInput("table", table);
    });
}

const part = (container: ParentNode, name: string) => {
    const element = container.querySelector(`[data-grid-part="${name}"]`);
    if (!(element instanceof HTMLElement)) throw new Error(`no ${name}`);
    return element;
};

describe("pinned cells", () => {
    it("mark pinned cells and header cells, and the last pinned column's edge", async () => {
        const { container } = await grid();
        for (const rowIndex of [-1, 0, 5]) {
            const a = cellAt(container, rowIndex, 0);
            const b = cellAt(container, rowIndex, 1);
            const c = cellAt(container, rowIndex, 2);
            expect(a).toHaveAttribute("data-pinned", "start");
            expect(a).not.toHaveAttribute("data-pinned-edge");
            expect(a).toHaveClass("pinned");
            expect(b).toHaveAttribute("data-pinned-edge", "");
            expect(b).toHaveClass("pinned", "edge");
            expect(c).not.toHaveAttribute("data-pinned");
            expect(c).not.toHaveAttribute("data-pinned-edge");
        }
    });

    for (const table of [false, true]) {
        it(`are sticky in their row's flow at the engine's inset, a consumer's transform and insets dropped${table ? ", as table cells" : ""}`, async () => {
            const { container } = await grid({ table });
            for (const rowIndex of [-1, 0]) {
                const a = cellAt(container, rowIndex, 0);
                const b = cellAt(container, rowIndex, 1);
                expect(a.tagName).toBe(
                    table ? (rowIndex < 0 ? "TH" : "TD") : "DIV",
                );
                expect(a.style.position).toBe("sticky");
                expect(a.style.width).toBe("100px");
                // the rendered columns start at column 2: the layers are moved right by 200px, and
                // the insets are each column's offset less that
                expect(a.style.left).toBe("-200px");
                expect(b.style.left).toBe("-100px");
                for (const property of ["transform", "top", "right"] as const) {
                    expect(a.style[property]).toBe("");
                }
                expect(a.style.color).toBe("red");
                // a cell that scrolls keeps what the consumer gave it, under the structure
                const c = cellAt(container, rowIndex, 2);
                expect(c.style.position).toBe("absolute");
                expect(c.style.transform).toBe("scale(2)");
                // the row starts the pinned and the rendered columns' width (200 + 500) before
                // its layer
                expect(c.style.left).toBe("700px");
            }
            const row = part(container, "row");
            const headerRow = part(container, "header-row");
            expect(row.tagName).toBe(table ? "TR" : "DIV");
            for (const element of [row, headerRow]) {
                expect(element.style.display).toBe("flex");
                expect(element.style.position).toBe("absolute");
            }
        });
    }

    it("are not written while scrolling inside the rendered window, and follow a new one", async () => {
        const { container } = await grid();
        const root = part(container, "root");
        const pinnedCells = [...container.querySelectorAll("[data-pinned]")];
        const writes = new MutationObserver(() => {});
        for (const cell of pinnedCells) {
            writes.observe(cell, { attributeFilter: ["style"] });
        }
        scrollRoot(root, { left: 40 });
        await settled();
        expect(writes.takeRecords()).toEqual([]);
        expect(cellAt(container, 0, 0).style.left).toBe("-200px");
        writes.disconnect();
        // far right: a new column window, the layers' x is its base
        scrollRoot(root, { left: 2_000 });
        await settled();
        const body = part(container, "body");
        const x = Number(
            /translate3d\(([-\d.]+)px/.exec(body.style.transform)?.[1],
        );
        expect(x).toBeGreaterThan(1_000);
        expect(cellAt(container, 0, 1).style.left).toBe(`${100 - x}px`);
        expect(cellAt(container, -1, 1).style.left).toBe(`${100 - x}px`);
    });

    // React merges a `render` element's own props, Vue's `render` slot binds the merged ones: in
    // Angular the cell is the app's own element, its style bound through `[style.x]` here
    it("drop a transform and insets bound on their element too", async () => {
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [features]="testFeatures" [columns]="columns" [rows]="rows" [rowHeight]="20">
                    <div dataGridGrid>
                        <div dataGridBody>
                            <ng-template dataGridRows let-row>
                                <div [dataGridRow]="row">
                                    <ng-template dataGridCells let-cell>
                                        <div [dataGridCell]="cell" [style.transform]="'scale(3)'"
                                            [style.top]="'4px'" [style.color]="'red'"><ng-container *dataGridCellContent /></div>
                                    </ng-template>
                                </div>
                            </ng-template>
                        </div>
                    </div>
                </div>
            `,
        })
        class Bound {
            readonly testFeatures = TEST_FEATURES;
            readonly columns = columns;
            readonly rows = rows;
        }
        const { container } = await render(Bound);
        const a = cellAt(container, 0, 0);
        expect(a.style.transform).toBe("");
        expect(a.style.top).toBe("");
        expect(a.style.left).toBe("-200px");
        expect(a.style.color).toBe("red");
        expect(cellAt(container, 0, 2).style.transform).toBe("scale(3)");
    });

    it("render far from the column window, as table cells too", async () => {
        const { container } = await grid({ table: true });
        scrollRoot(part(container, "root"), { left: 2_000 });
        await settled();
        const a = cellAt(container, 0, 0);
        expect(a.tagName).toBe("TD");
        expect(a).toHaveAttribute("data-pinned", "start");
        expect(a).toHaveAttribute("aria-colindex", "1");
        expect(cellAt(container, -1, 1).tagName).toBe("TH");
    });

    it("mark a pinned group's header cell", async () => {
        const { container } = await grid({
            cells: [
                {
                    key: "who",
                    name: "Who",
                    children: [pinned("a"), pinned("b")],
                },
                ...Array.from({ length: 10 }, (_, i) => plain(`c${i}`)),
            ],
        });
        const group = cellAt(container, -2, 0);
        expect(group).toHaveAttribute("data-group", "");
        expect(group).toHaveAttribute("data-pinned", "start");
        expect(group).toHaveAttribute("data-pinned-edge", "");
    });

    it("sit inside their row's box: a row starts the pinned and rendered columns' width before its layer", async () => {
        const { container } = await grid();
        const row = container.querySelector<HTMLElement>(
            '[data-grid-part="row"][data-row-index="0"]',
        );
        // 200px pinned, columns 2 to 7 rendered (the view's 300px and 2 of overscan)
        expect(row?.style.left).toBe("-700px");
        const headerRow = part(container, "header-row");
        expect(headerRow.style.left).toBe("-700px");
        expect(headerRow.style.width).toBe(row?.style.width);
    });

    // "get their insets back when the grid is shown again (Activity)": React's <Activity> has no
    // Angular counterpart (a hidden subtree keeping its elements while its effects are cleaned up)

    it("become cells that scroll once their column is unpinned", async () => {
        const { container, fixture } = await grid();
        expect(cellAt(container, 0, 0).style.position).toBe("sticky");
        fixture.componentRef.setInput("cells", [
            plain("a"),
            plain("b"),
            ...Array.from({ length: 30 }, (_, i) => plain(`c${i}`)),
        ]);
        await settled(fixture);
        const a = cellAt(container, 0, 0);
        expect(a).not.toHaveAttribute("data-pinned");
        expect(a.style.position).toBe("absolute");
        expect(a.style.left).toBe("0px");
        expect(cellAt(container, 0, 1).style.left).toBe("100px");
        const row = part(container, "row");
        expect(row.style.display).toBe("");
        expect(row.style.left).toBe("0px");
    });

    it("leave a grid without pinned columns as it was", async () => {
        const { container } = await grid({
            cells: columns.map(({ pinned: _, ...column }) => column),
        });
        expect(
            container.querySelectorAll("[data-pinned], [data-pinned-edge]"),
        ).toHaveLength(0);
        const a = cellAt(container, 0, 0);
        expect(a.style.transform).toBe("scale(2)");
        expect(a.style.position).toBe("absolute");
        // no new structural key: no `display` on rows
        for (const name of ["row", "header-row"]) {
            const element = part(container, name);
            expect(element.style.display).toBe("");
            expect(element.style.left).toBe("0px");
        }
    });
});
