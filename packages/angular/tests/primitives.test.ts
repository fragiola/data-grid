import {
    ChangeDetectionStrategy,
    Component,
    signal,
    type TemplateRef,
    viewChild,
} from "@angular/core";
import { describe, expect, it, vi } from "vitest";
import {
    type CellPosition,
    type CellTemplateProps,
    type Column,
    contextOf,
    DATA_GRID,
    type DataGridContextValue,
    type DataGridNode,
    injectDataGrid,
    type TemplateContext,
    templateContent,
} from "../src/public-api";
import { renderTestGrid } from "./grid";
import {
    click,
    keyDown,
    render,
    scrollRoot,
    settled,
    stubViewportSize,
} from "./helpers";

// The primitive contract (AGENTS.md), in Angular: attribute directives on the app's own elements
// (the Angular `render`), the recursion through templates; attributes forwarded and listeners
// composed (the app's first, the grid's after); structural inline style only (it wins over the
// app's); state through data-* and ARIA; no text and no names of their own. jsdom lays nothing
// out: the viewport's size is faked on the root element.

interface Person {
    id: number;
    name: string;
    age: number;
}

const people: Person[] = Array.from({ length: 1_000 }, (_, i) => ({
    id: i,
    name: `Person ${i}`,
    age: 20 + (i % 50),
}));

const columns: Column<Person, DataGridNode>[] = [
    { key: "name", name: "Name", width: 200 },
    { key: "age", name: "Age", width: 100 },
    {
        key: "label",
        width: 150,
        renderCell: ({ row }) => row.name.toUpperCase(),
        renderHeaderCell: () => "Label",
    },
];

const VIEWPORT = { width: 400, height: 235 };

stubViewportSize(VIEWPORT.width, VIEWPORT.height);

/** The allowed structural inline style keys (AGENTS.md, the primitive contract). */
const STRUCTURAL = new Set([
    "position",
    "top",
    "left",
    "width",
    "height",
    "inset",
    "transform",
    "display",
    "overflow",
    "contain",
    "box-sizing",
    "z-index",
]);

const parts = (container: HTMLElement, name: string) => [
    ...container.querySelectorAll<HTMLElement>(`[data-grid-part="${name}"]`),
];

const at = (container: HTMLElement, row: number, column: number) =>
    container.querySelector<HTMLElement>(
        `[data-grid-part="cell"][data-row-index="${row}"][data-column-index="${column}"]`,
    );

const expectStructuralOnly = (container: HTMLElement) => {
    for (const element of container.querySelectorAll<HTMLElement>(
        "[data-grid-part]",
    )) {
        for (const property of [...element.style]) {
            expect(
                STRUCTURAL.has(property),
                `${element.dataset.gridPart}: ${property}`,
            ).toBe(true);
        }
    }
};

describe("the structure", () => {
    it("renders the app's divs, with the grid's roles and ARIA", async () => {
        const { container } = await renderTestGrid({
            columns,
            rows: people,
            rowHeight: 20,
        });
        const [grid] = parts(container, "grid");
        expect(grid?.tagName).toBe("DIV");
        expect(grid).toHaveAttribute("role", "grid");
        expect(grid).toHaveAttribute("aria-rowcount", "1001");
        expect(grid).toHaveAttribute("aria-colcount", "3");
        expect(parts(container, "header")[0]).toHaveAttribute(
            "role",
            "rowgroup",
        );
        expect(parts(container, "header-row")[0]).toHaveAttribute(
            "aria-rowindex",
            "1",
        );
        const headers = parts(container, "header-cell");
        expect(headers.map((h) => h.getAttribute("role"))).toEqual([
            "columnheader",
            "columnheader",
            "columnheader",
        ]);
        expect(headers.map((h) => h.textContent)).toEqual([
            "Name",
            "Age",
            "Label",
        ]);
        const rows = parts(container, "row");
        // 235px − 35px of header = 200px: 10 rows in view, 4 of overscan below
        expect(rows).toHaveLength(14);
        expect(rows[0]).toHaveAttribute("aria-rowindex", "2");
        const cells = parts(rows[0] as HTMLElement, "cell");
        expect(cells.map((c) => c.getAttribute("aria-colindex"))).toEqual([
            "1",
            "2",
            "3",
        ]);
        expect(cells.map((c) => c.textContent)).toEqual([
            "Person 0",
            "20",
            "PERSON 0",
        ]);
    });

    it("renders a real table on the app's table elements, with the same ARIA", async () => {
        const { container } = await renderTestGrid(
            { columns, rows: people, rowHeight: 20 },
            { table: true },
        );
        expect(container.querySelector("table")).toHaveAttribute(
            "role",
            "grid",
        );
        expect(container.querySelectorAll("thead > tr > th")).toHaveLength(3);
        expect(container.querySelectorAll("tbody > tr")).toHaveLength(14);
        expect(container.querySelectorAll("tbody > tr > td")).toHaveLength(42);
        const td = container.querySelector("td");
        expect(td).toHaveAttribute("role", "gridcell");
        expect(td).toHaveAttribute("data-row-index", "0");
        expect(td).toHaveAttribute("data-column-index", "0");
    });

    it("sizes the grid for the whole dataset", async () => {
        const { container } = await renderTestGrid({
            columns,
            rows: people,
            rowHeight: 20,
        });
        const grid = parts(container, "grid")[0];
        expect(grid?.style.width).toBe("450px");
        expect(grid?.style.height).toBe(`${35 + 1_000 * 20}px`);
    });

    it("renders no header without a header row", async () => {
        const { container } = await renderTestGrid({
            columns,
            rows: people,
            rowHeight: 20,
            headerRowHeight: 0,
        });
        expect(parts(container, "header")).toHaveLength(0);
        expect(parts(container, "grid")[0]).toHaveAttribute(
            "aria-rowcount",
            "1000",
        );
    });

    it("renders new rows when the props change", async () => {
        const grid = await renderTestGrid({ columns, rows: people });
        await grid.setProps({
            columns,
            rows: [{ id: 7, name: "Grace", age: 85 }],
        });
        expect(at(grid.container, 0, 0)).toHaveTextContent("Grace");
        expect(parts(grid.container, "row")).toHaveLength(1);
    });
});

describe("the primitive contract", () => {
    it("applies only structural inline style", async () => {
        const { container } = await renderTestGrid({
            columns,
            rows: people,
            rowHeight: 20,
        });
        expectStructuralOnly(container);
    });

    it("applies only structural inline style with pinned columns: sticky cells, flex rows", async () => {
        const { container } = await renderTestGrid({
            columns: columns.map((column, index) =>
                index === 0 ? { ...column, pinned: "start" as const } : column,
            ),
            rows: people,
            rowHeight: 20,
        });
        const pinned = container.querySelectorAll<HTMLElement>("[data-pinned]");
        expect(pinned.length).toBeGreaterThan(1);
        for (const element of pinned) {
            expect(element.style.position).toBe("sticky");
        }
        expectStructuralOnly(container);
    });

    it("sets no accessible name of its own", async () => {
        const { container } = await renderTestGrid({ columns, rows: people });
        expect(container.querySelectorAll("[aria-label]")).toHaveLength(0);
    });

    it('marks state with present-or-absent data attributes, never "false"', async () => {
        const loaded = new Map([[0, people[0]]]);
        const { container } = await renderTestGrid({
            columns,
            rowCount: 100,
            getRow: (index: number) => loaded.get(index),
            defaultActivePosition: { rowIndex: 0, columnIndex: 0 },
        });
        const rows = parts(container, "row");
        expect(rows[0]).not.toHaveAttribute("data-loading");
        expect(rows[0]).toHaveAttribute("data-active", "");
        expect(rows[1]).toHaveAttribute("data-loading", "");
        expect(rows[1]).not.toHaveAttribute("data-active");
        expect(container.innerHTML).not.toContain('="false"');
        // a row not loaded renders its cells, empty
        expect(
            parts(rows[1] as HTMLElement, "cell").map((c) => c.textContent),
        ).toEqual(["", "", ""]);
    });

    it("carries data-grid-part on every part, and indexes on rows and cells", async () => {
        const { container } = await renderTestGrid(
            { columns, rows: people, summaryRows: { top: 1 } },
            { summary: true },
        );
        const names = new Set(
            [
                ...container.querySelectorAll<HTMLElement>("[data-grid-part]"),
            ].map((element) => element.dataset.gridPart),
        );
        expect([...names].sort()).toEqual(
            [
                "root",
                "grid",
                "header",
                "header-row",
                "header-cell",
                "summary",
                "summary-row",
                "summary-cell",
                "body",
                "row",
                "cell",
            ].sort(),
        );
        for (const element of container.querySelectorAll<HTMLElement>(
            '[data-grid-part="row"], [data-grid-part="cell"]',
        )) {
            expect(element).toHaveAttribute("data-row-index");
        }
    });

    it("keeps the app's own class, attributes and style under the structural keys", async () => {
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [rows]="rows" [columns]="columns" class="root" title="Grid">
                    <div dataGridGrid class="grid">
                        <div dataGridBody style="color: red; transform: scale(2)">
                            <ng-template dataGridRows let-row>
                                <div [dataGridRow]="row" class="row" style="position: fixed; color: blue" data-own="yes">
                                    <ng-template dataGridCells let-cell>
                                        <div [dataGridCell]="cell" class="cell"><ng-container *dataGridCellContent /></div>
                                    </ng-template>
                                </div>
                            </ng-template>
                        </div>
                    </div>
                </div>
            `,
        })
        class Styled {
            readonly rows = people;
            readonly columns = columns;
        }
        const { container } = await render(Styled);
        const root = parts(container, "root")[0];
        expect(root).toHaveClass("root");
        expect(root).toHaveAttribute("title", "Grid");
        const row = parts(container, "row")[0];
        expect(row).toHaveClass("row");
        expect(row).toHaveAttribute("data-own", "yes");
        // the structural key wins, the cosmetic one stays
        expect(row?.style.position).toBe("absolute");
        expect(row?.style.color).toBe("blue");
        const body = parts(container, "body")[0];
        expect(body?.style.color).toBe("red");
        // the layer's transform is the engine's
        expect(body?.style.transform).not.toBe("scale(2)");
    });
});

describe("the active cell", () => {
    it("works uncontrolled: the keyboard moves it, and the change is reported", async () => {
        const onChange = vi.fn();
        const { container } = await renderTestGrid({
            columns,
            rows: people,
            rowHeight: 20,
            defaultActivePosition: { rowIndex: 0, columnIndex: 0 },
            onActivePositionChange: onChange,
        });
        const cell = at(container, 0, 0);
        expect(cell).toHaveAttribute("tabindex", "0");
        keyDown(cell as HTMLElement, { key: "ArrowRight" });
        await settled();
        expect(onChange).toHaveBeenLastCalledWith({
            rowIndex: 0,
            columnIndex: 1,
        });
        expect(at(container, 0, 1)).toHaveAttribute("data-active", "");
        expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    });

    it("works controlled through an input and its output: a move asks, and only the input moves it", async () => {
        const asked: (CellPosition | null)[] = [];
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [rows]="rows" [columns]="columns"
                    [activePosition]="position()" (activePositionChange)="asked.push($event)">
                    <div dataGridGrid>
                        <div dataGridBody>
                            <ng-template dataGridRows let-row>
                                <div [dataGridRow]="row">
                                    <ng-template dataGridCells let-cell>
                                        <div [dataGridCell]="cell"></div>
                                    </ng-template>
                                </div>
                            </ng-template>
                        </div>
                    </div>
                </div>
            `,
        })
        class Controlled {
            readonly rows = people;
            readonly columns = columns;
            readonly asked = asked;
            readonly position = signal<CellPosition>({
                rowIndex: 2,
                columnIndex: 0,
            });
        }
        const { container, component, fixture } = await render(Controlled);
        keyDown(at(container, 2, 0) as HTMLElement, { key: "ArrowDown" });
        await settled(fixture);
        expect(asked).toContainEqual({ rowIndex: 3, columnIndex: 0 });
        // the parent did not follow: still on row 2
        expect(at(container, 2, 0)).toHaveAttribute("data-active", "");
        component.position.set({ rowIndex: 3, columnIndex: 0 });
        await settled(fixture);
        expect(at(container, 3, 0)).toHaveAttribute("data-active", "");
    });

    it("binds both ways: [(activePosition)] follows the keys", async () => {
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [rows]="rows" [columns]="columns" [(activePosition)]="position">
                    <div dataGridGrid>
                        <div dataGridBody>
                            <ng-template dataGridRows let-row>
                                <div [dataGridRow]="row">
                                    <ng-template dataGridCells let-cell>
                                        <div [dataGridCell]="cell"></div>
                                    </ng-template>
                                </div>
                            </ng-template>
                        </div>
                    </div>
                </div>
            `,
        })
        class TwoWay {
            readonly rows = people;
            readonly columns = columns;
            readonly position = signal<CellPosition | null>({
                rowIndex: 1,
                columnIndex: 1,
            });
        }
        const { container, component, fixture } = await render(TwoWay);
        keyDown(at(container, 1, 1) as HTMLElement, { key: "ArrowRight" });
        await settled(fixture);
        expect(component.position()).toEqual({ rowIndex: 1, columnIndex: 2 });
        expect(at(container, 1, 2)).toHaveAttribute("data-active", "");
    });

    it("follows the model: injectDataGrid().model.run changes the same state", async () => {
        let grid: DataGridContextValue<Person> | undefined;
        @Component({
            selector: "test-probe",
            template: "",
        })
        class Probe {
            constructor() {
                grid = injectDataGrid<Person>();
            }
        }
        @Component({
            imports: [DATA_GRID, Probe],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [rows]="rows" [columns]="columns">
                    <test-probe />
                    <div dataGridGrid>
                        <div dataGridBody>
                            <ng-template dataGridRows let-row>
                                <div [dataGridRow]="row">
                                    <ng-template dataGridCells let-cell>
                                        <div [dataGridCell]="cell"></div>
                                    </ng-template>
                                </div>
                            </ng-template>
                        </div>
                    </div>
                </div>
            `,
        })
        class WithProbe {
            readonly rows = people;
            readonly columns = columns;
        }
        const { container, fixture } = await render(WithProbe);
        grid?.model.run("active-position.set", { rowIndex: 4, columnIndex: 2 });
        await settled(fixture);
        expect(at(container, 4, 2)).toHaveAttribute("data-active", "");
    });

    it("lets a cell's own keydown and the root's cancel a key: the grid's runs after", async () => {
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [rows]="rows" [columns]="columns"
                    [defaultActivePosition]="start" (keydown)="onRootKey($event)">
                    <div dataGridGrid>
                        <div dataGridBody>
                            <ng-template dataGridRows let-row>
                                <div [dataGridRow]="row">
                                    <ng-template dataGridCells let-cell>
                                        <div [dataGridCell]="cell" (keydown)="onCellKey($event)"></div>
                                    </ng-template>
                                </div>
                            </ng-template>
                        </div>
                    </div>
                </div>
            `,
        })
        class Cancelling {
            readonly rows = people;
            readonly columns = columns;
            readonly start = { rowIndex: 0, columnIndex: 0 };
            onCellKey(event: KeyboardEvent) {
                if (event.key === "ArrowDown") event.preventDefault();
            }
            onRootKey(event: KeyboardEvent) {
                if (event.key === "ArrowRight") event.preventDefault();
            }
        }
        const { container, fixture } = await render(Cancelling);
        keyDown(at(container, 0, 0) as HTMLElement, { key: "ArrowDown" });
        keyDown(at(container, 0, 0) as HTMLElement, { key: "ArrowRight" });
        await settled(fixture);
        expect(at(container, 0, 0)).toHaveAttribute("data-active", "");
        keyDown(at(container, 0, 0) as HTMLElement, { key: "End" });
        await settled(fixture);
        expect(at(container, 0, 2)).toHaveAttribute("data-active", "");
    });

    it("makes the grid the tab stop while no cell is active", async () => {
        const { container } = await renderTestGrid({ columns, rows: people });
        expect(parts(container, "grid")[0]).toHaveAttribute("tabindex", "0");
        expect(parts(container, "root")[0]).toHaveAttribute("tabindex", "-1");
        click(at(container, 1, 1) as HTMLElement);
        (at(container, 1, 1) as HTMLElement).focus();
        await settled();
        expect(parts(container, "grid")[0]).toHaveAttribute("tabindex", "-1");
    });
});

describe("the empty state", () => {
    it("renders its element only while there are no rows, and marks the root and the grid", async () => {
        const grid = await renderTestGrid(
            { columns, rows: [] },
            { empty: "Nothing" },
        );
        const cell = parts(grid.container, "empty")[0];
        expect(cell).toHaveTextContent("Nothing");
        expect(cell).toHaveAttribute("role", "gridcell");
        expect(cell).toHaveAttribute("aria-colspan", "3");
        expect(cell?.parentElement).toHaveAttribute(
            "data-grid-part",
            "empty-row",
        );
        expect(cell?.parentElement?.parentElement).toHaveAttribute(
            "data-grid-part",
            "empty-area",
        );
        expect(parts(grid.container, "root")[0]).toHaveAttribute(
            "data-empty",
            "",
        );
        expect(parts(grid.container, "grid")[0]).toHaveAttribute(
            "data-empty",
            "",
        );
        await grid.setProps({ columns, rows: people });
        expect(parts(grid.container, "empty")).toHaveLength(0);
        expect(parts(grid.container, "empty-area")).toHaveLength(0);
        expect(parts(grid.container, "root")[0]).not.toHaveAttribute(
            "data-empty",
        );
    });

    it("takes a table's structure in a table grid", async () => {
        const { container } = await renderTestGrid(
            { columns, rows: [] },
            { table: true, empty: "Nothing" },
        );
        const cell = parts(container, "empty")[0];
        expect(cell?.tagName).toBe("TD");
        expect(cell).not.toHaveAttribute("role");
        expect(cell).toHaveAttribute("colspan", "3");
        expect(cell?.parentElement?.tagName).toBe("TR");
        expect(cell?.parentElement?.parentElement?.tagName).toBe("TBODY");
    });

    it("counts its row in ARIA only while it is rendered", async () => {
        const counted = await renderTestGrid(
            { columns, rows: [] },
            { empty: "Nothing" },
        );
        expect(parts(counted.container, "grid")[0]).toHaveAttribute(
            "aria-rowcount",
            "2",
        );
        counted.fixture.destroy();
        const none = await renderTestGrid({ columns, rows: [] });
        expect(parts(none.container, "grid")[0]).toHaveAttribute(
            "aria-rowcount",
            "1",
        );
    });
});

describe("column renderers", () => {
    it("render a typed template with the context they return", async () => {
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <ng-template #nameCell [dataGridTemplate]="nameContext" let-row="row" let-props>
                    <b class="name">{{ row.name }} ({{ props.rowIndex }})</b>
                </ng-template>
                <div dataGridRoot [rows]="rows" [columns]="columns()">
                    <div dataGridGrid>
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
                </div>
            `,
        })
        class Templates {
            readonly rows = people;
            readonly nameContext = contextOf<CellTemplateProps<Person>>();
            readonly nameCell =
                viewChild.required<
                    TemplateRef<TemplateContext<CellTemplateProps<Person>>>
                >("nameCell");
            readonly columns = (): Column<Person, DataGridNode>[] => [
                {
                    key: "name",
                    width: 200,
                    renderCell: (props) =>
                        templateContent(this.nameCell(), props),
                },
            ];
        }
        const { container } = await render(Templates);
        expect(at(container, 3, 0)?.querySelector(".name")).toHaveTextContent(
            "Person 3 (3)",
        );
    });
});

describe("rendering (D9)", () => {
    it("renders nothing for a scroll within the rendered window, and the new rows past it", async () => {
        const { container } = await renderTestGrid({
            columns,
            rows: people,
            rowHeight: 20,
        });
        const root = parts(container, "root")[0] as HTMLElement;
        const first = parts(container, "row")[0];
        scrollRoot(root, { top: 10 });
        await settled();
        expect(parts(container, "row")[0]).toBe(first);
        scrollRoot(root, { top: 2_000 });
        await settled();
        expect(at(container, 100, 0)).toHaveTextContent("Person 100");
    });
});
