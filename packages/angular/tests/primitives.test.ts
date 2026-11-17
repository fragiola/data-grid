import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    Directive,
    ElementRef,
    inject,
    type OnInit,
    signal,
    type TemplateRef,
    viewChild,
    viewChildren,
} from "@angular/core";
import { describe, expect, it, vi } from "vitest";
import { DataGridNavigation } from "../src/navigation";
import {
    type CellPosition,
    type CellTemplateProps,
    type Column,
    type ColumnOrGroup,
    contextOf,
    DATA_GRID,
    type DataGridContextValue,
    DataGridGrid,
    DataGridHeaderCell,
    type DataGridNode,
    injectDataGrid,
    type TemplateContext,
    templateContent,
} from "../src/public-api";
import { renderTestGrid, TEST_FEATURES, type TestFeatures } from "./grid";
import {
    click,
    keyDown,
    render,
    rendered,
    renders,
    resetRenders,
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
            imports: [DATA_GRID, DataGridNavigation],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [features]="features" dataGridNavigation [rows]="rows" [columns]="columns"
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
            readonly features = TEST_FEATURES;
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
            imports: [DATA_GRID, DataGridNavigation],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [features]="features" dataGridNavigation [rows]="rows" [columns]="columns" [(activePosition)]="position">
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
            readonly features = TEST_FEATURES;
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
        // the app's value is rendered before the next key, as React and Vue do: a key pressed
        // fast starts from where the last one went (no frame or timer in between)
        keyDown(at(container, 1, 2) as HTMLElement, { key: "ArrowDown" });
        for (let i = 0; i < 10; i++) await Promise.resolve();
        expect(at(container, 2, 2)).toHaveAttribute("data-active", "");
        keyDown(at(container, 2, 2) as HTMLElement, { key: "ArrowDown" });
        await settled(fixture);
        expect(component.position()).toEqual({ rowIndex: 3, columnIndex: 2 });
    });

    it("follows the model: injectDataGrid().model.run changes the same state", async () => {
        let grid: DataGridContextValue<Person, TestFeatures> | undefined;
        @Component({
            selector: "test-probe",
            template: "",
        })
        class Probe {
            constructor() {
                grid = injectDataGrid<Person, TestFeatures>();
            }
        }
        @Component({
            imports: [DATA_GRID, Probe],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [features]="features" [rows]="rows" [columns]="columns">
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
            readonly features = TEST_FEATURES;
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
            imports: [DATA_GRID, DataGridNavigation],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [features]="features" dataGridNavigation [rows]="rows" [columns]="columns"
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
            readonly features = TEST_FEATURES;
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

// The Vue suite's tests the first subset above leaves out, in Angular.

describe("the primitive contract, the app's own element", () => {
    // Angular has no `className`/`style` functions: a state-based class is a binding on the part's
    // state (`exportAs`); the app's plain class and style stay, the structural keys win
    it("resolves className and style functions against the state; structural keys win", async () => {
        @Component({
            imports: [DATA_GRID, DataGridNavigation],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [features]="features" dataGridNavigation [rows]="rows" [columns]="columns" [defaultActivePosition]="start">
                    <div dataGridGrid class="grid" style="color: red; width: 1px">
                        <div dataGridBody>
                            <ng-template dataGridRows let-row>
                                <div [dataGridRow]="row" #state="dataGridRow" [attr.class]="state.state()?.active ? 'row is-active' : 'row'">
                                    <ng-template dataGridCells let-cell>
                                        <div [dataGridCell]="cell" style="outline-width: 2px; position: static"></div>
                                    </ng-template>
                                </div>
                            </ng-template>
                        </div>
                    </div>
                </div>
            `,
        })
        class Styled {
            readonly features = TEST_FEATURES;
            readonly rows = people;
            readonly columns = columns;
            readonly start = { rowIndex: 1, columnIndex: 1 };
        }
        const { container } = await render(Styled);
        const grid = parts(container, "grid")[0];
        expect(grid).toHaveClass("grid");
        expect(grid?.style.color).toBe("red");
        expect(grid?.style.width).not.toBe("1px");
        const rows = parts(container, "row");
        expect(rows[1]).toHaveClass("row", "is-active");
        expect(rows[0]).not.toHaveClass("is-active");
        expect(rows[0]).toHaveClass("row");
        // a cell's own style: kept, its `position` the structural one
        const active = container.querySelector<HTMLElement>(
            "[data-active][data-grid-part=cell]",
        );
        expect(active?.style.outlineWidth).toBe("2px");
        expect(active?.style.position).toBe("absolute");
    });

    // a `[class.x]` binding runs before the element's directive inputs are set (the compiler orders
    // styling first): `state()` is `undefined` on that first pass, then the part's
    it("reads the part's state in a class binding on its own element", async () => {
        @Component({
            imports: [DATA_GRID, DataGridNavigation],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [features]="features" dataGridNavigation [rows]="rows" [columns]="columns" [defaultActivePosition]="start">
                    <div dataGridGrid>
                        <div dataGridBody>
                            <ng-template dataGridRows let-row>
                                <div [dataGridRow]="row" #state="dataGridRow" [class.is-active]="state.state()?.active"></div>
                            </ng-template>
                        </div>
                    </div>
                </div>
            `,
        })
        class ClassBound {
            readonly features = TEST_FEATURES;
            readonly rows = people;
            readonly columns = columns;
            readonly start = { rowIndex: 1, columnIndex: 1 };
        }
        const { container } = await render(ClassBound);
        expect(parts(container, "row")[1]).toHaveClass("is-active");
        expect(parts(container, "row")[0]).not.toHaveClass("is-active");
    });

    // Angular's `render`: the app's own element, the state read through the directive (`exportAs`)
    it("renders through a render function with the props and the state", async () => {
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [features]="features" [rows]="rows" [columns]="columns">
                    <section dataGridGrid #grid="dataGridGrid" [attr.data-count]="grid.state().rowCount">
                        <div dataGridBody></div>
                    </section>
                </div>
            `,
        })
        class Section {
            readonly features = TEST_FEATURES;
            readonly rows = people;
            readonly columns = columns;
        }
        const { container } = await render(Section);
        const section = container.querySelector("section");
        expect(section).toHaveAttribute("role", "grid");
        expect(section).toHaveAttribute("data-count", "1000");
    });

    // React's merged `ref` is, in Angular, a template reference: the app's element and the directive
    it("merges refs, forwards props and composes handlers", async () => {
        const onClick = vi.fn();
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [rows]="rows" [columns]="columns">
                    <div dataGridGrid id="people" (click)="onClick()" #element #grid="dataGridGrid">
                        <div dataGridBody></div>
                    </div>
                </div>
            `,
        })
        class Forwarding {
            readonly rows = people;
            readonly columns = columns;
            readonly onClick = onClick;
            readonly element =
                viewChild.required<ElementRef<HTMLElement>>("element");
            readonly grid = viewChild.required(DataGridGrid);
        }
        const { container, component } = await render(Forwarding);
        const grid = parts(container, "grid")[0];
        expect(grid).toHaveAttribute("id", "people");
        expect(component.element().nativeElement).toBe(grid);
        expect(component.grid().state()?.rowCount).toBe(1_000);
        click(grid as HTMLElement);
        expect(onClick).toHaveBeenCalledOnce();
    });
});

describe("the active cell, controlled", () => {
    it("follows the model: injectDataGrid().model.run changes the same state, through the output when controlled", async () => {
        let grid: DataGridContextValue<Person, TestFeatures> | undefined;
        @Component({ selector: "test-probe", template: "" })
        class Probe {
            constructor() {
                grid = injectDataGrid<Person, TestFeatures>();
            }
        }
        const asked: (CellPosition | null)[] = [];
        @Component({
            imports: [DATA_GRID, DataGridNavigation, Probe],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [features]="features" dataGridNavigation [rows]="rows" [columns]="columns"
                    [activePosition]="position()" (activePositionChange)="ask($event)">
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
        class Controlled {
            readonly features = TEST_FEATURES;
            readonly rows = people;
            readonly columns = columns;
            readonly position = signal<CellPosition | null>(null);
            ask(next: CellPosition | null) {
                asked.push(next);
                this.position.set(next);
            }
        }
        const { container, fixture } = await render(Controlled);
        grid?.model.run("active-position.set", { rowIndex: 4, columnIndex: 2 });
        await settled(fixture);
        expect(asked).toEqual([{ rowIndex: 4, columnIndex: 2 }]);
        expect(at(container, 4, 2)).toHaveAttribute("data-active", "");
    });
});

describe("the empty state, its area", () => {
    it("fills the visible body below the header in an area of its own, and stays in view sideways", async () => {
        const { container } = await renderTestGrid(
            { columns, rows: [], rowHeight: 20 },
            { empty: "No people" },
        );
        const [area] = parts(container, "empty-area");
        // the viewport is 400 × 235, the header 35 high
        expect(area?.style.position).toBe("sticky");
        expect(area?.style.left).toBe("0px");
        expect(area?.style.width).toBe("400px");
        expect(area?.style.height).toBe("200px");
        // the empty state is a cell in a row, both as tall as the area (Epic #89, E5.2)
        const [row] = parts(container, "empty-row");
        const [empty] = parts(container, "empty");
        expect(row?.parentElement).toBe(area);
        expect(empty?.parentElement).toBe(row);
        for (const element of [area, row, empty]) {
            for (const property of [...(element?.style ?? [])]) {
                expect(STRUCTURAL.has(property), property).toBe(true);
            }
        }
        expect(empty?.style.height).toBe("100%");
        // the grid is at least as large as the visible area, so the empty state has room
        const [grid] = parts(container, "grid");
        expect(grid?.style.width).toBe("450px");
        expect(grid?.style.height).toBe("235px");
    });

    // React's `ref` merging, `className` function and `render` have no Angular counterpart: the
    // app's `<td>`, its attributes, its listener, its class and its style
    it("follows the primitive contract: render, ref, handlers, className and style", async () => {
        const onClick = vi.fn();
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [rows]="rows" [columns]="columns">
                    <table dataGridGrid>
                        <tbody dataGridBody></tbody>
                        <td *dataGridEmpty id="nothing" (click)="onClick()" class="from-the-app"
                            style="color: red; display: flex; height: 1px"><span>No people</span></td>
                    </table>
                </div>
            `,
        })
        class TableEmpty {
            readonly rows: Person[] = [];
            readonly columns = columns;
            readonly onClick = onClick;
        }
        const { container } = await render(TableEmpty);
        // a table's cell: in a row and a row group of the table's own
        const [empty] = parts(container, "empty");
        expect(empty?.tagName).toBe("TD");
        expect(empty?.parentElement?.tagName).toBe("TR");
        expect(empty?.parentElement?.parentElement?.tagName).toBe("TBODY");
        expect(empty).toHaveAttribute("colspan", String(columns.length));
        expect(empty).not.toHaveAttribute("role");
        expect(empty).toHaveAttribute("id", "nothing");
        expect(empty).toHaveClass("from-the-app");
        // the app's style is kept under the structural one
        expect(empty?.style.color).toBe("red");
        expect(empty?.style.display).toBe("block");
        expect(empty?.style.height).toBe("100%");
        click(empty?.querySelector("span") as HTMLElement);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("spans the columns when they are narrower than the view, the view without columns", async () => {
        const narrow: Column<Person, DataGridNode>[] = [
            { key: "name", width: 100 },
            { key: "age", width: 50 },
        ];
        const { container } = await renderTestGrid(
            { columns: narrow, rows: [] },
            { empty: "" },
        );
        // 150px of columns in a 400px viewport: the grid is 400px wide, the empty state sits
        // under the columns (Epic #113)
        expect(parts(container, "grid")[0]?.style.width).toBe("400px");
        expect(parts(container, "empty-area")[0]?.style.width).toBe("150px");
        const none = await renderTestGrid(
            { columns: [], rows: [] },
            { empty: "" },
        );
        expect(parts(none.container, "empty-area")[0]?.style.width).toBe(
            "400px",
        );
    });

    // React's render function returning a `<td>` is, in Angular, the app's `<td>` in a div grid
    it("finds a table's structure from a render function's `<td>` too", async () => {
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [rows]="rows" [columns]="columns">
                    <div dataGridGrid>
                        <div dataGridBody></div>
                        <td *dataGridEmpty style="color: red">No people</td>
                    </div>
                </div>
            `,
        })
        class TdEmpty {
            readonly rows: Person[] = [];
            readonly columns = columns;
        }
        const { container } = await render(TdEmpty);
        const [empty] = parts(container, "empty");
        expect(empty?.tagName).toBe("TD");
        expect(empty?.parentElement?.tagName).toBe("TR");
        expect(empty?.parentElement?.parentElement?.tagName).toBe("TBODY");
        expect(empty).toHaveAttribute("colspan", String(columns.length));
        expect(empty).not.toHaveAttribute("role");
        expect(empty).not.toHaveAttribute("aria-colspan");
        expect(empty?.style.color).toBe("red");
        expect(empty?.style.display).toBe("block");
    });

    // "takes a table's structure in a table grid, whatever renders its cell (a component)": Angular
    // has no `as` (a component rendering the part's element); the table grid's `<td>` is the test
    // "takes a table's structure in a table grid" above. "counts no empty line in ARIA without an
    // empty state" is the second half of "counts its row in ARIA only while it is rendered".

    it("counts its row in ARIA, after the header rows and before the bottom summary rows", async () => {
        const { container } = await renderTestGrid(
            { columns, rows: [], summaryRows: { top: 1, bottom: 1 } },
            { summary: true, empty: "" },
        );
        // the header row, the top summary row, the empty state's row, the bottom summary row
        expect(parts(container, "grid")[0]).toHaveAttribute(
            "aria-rowcount",
            "4",
        );
        expect(parts(container, "empty-row")[0]).toHaveAttribute(
            "aria-rowindex",
            "3",
        );
        expect(
            parts(container, "summary-row").map((row) =>
                row.getAttribute("aria-rowindex"),
            ),
        ).toEqual(["2", "4"]);
    });

    it("is a row and a cell spanning the columns, with no text or name of its own", async () => {
        const { container } = await renderTestGrid(
            { columns, rows: [] },
            { empty: "" },
        );
        const [empty] = parts(container, "empty");
        expect(parts(container, "empty-row")[0]).toHaveAttribute("role", "row");
        expect(parts(container, "empty-area")[0]).not.toHaveAttribute("role");
        expect(empty).toHaveAttribute("role", "gridcell");
        expect(empty).toHaveAttribute("aria-colspan", String(columns.length));
        // not a cell of the grid's: no indexes (the keys and the tab order leave it alone)
        expect(empty).not.toHaveAttribute("data-row-index");
        expect(empty?.textContent).toBe("");
        expect(container.querySelectorAll("[aria-label]")).toHaveLength(0);
    });
});

describe("column groups", () => {
    // "id" spans both header rows; "person" groups name and age
    const groupedColumns: ColumnOrGroup<Person, DataGridNode>[] = [
        { key: "id", name: "#", width: 50 },
        {
            key: "person",
            name: "Person",
            children: [
                { key: "name", name: "Name", width: 200 },
                { key: "age", name: "Age", width: 100 },
            ],
        },
    ];

    // React's `className` functions read the state; here the same classes come from the
    // templates' row and cell
    @Component({
        selector: "test-grouped",
        imports: [DATA_GRID],
        changeDetection: ChangeDetectionStrategy.OnPush,
        template: `
            <div dataGridRoot [features]="features" [rows]="rows" [columns]="columns" [rowHeight]="20">
                @if (table) {
                    <table dataGridGrid aria-label="People">
                        <thead *dataGridHeader>
                            <ng-template dataGridHeaderRows let-row>
                                <tr [dataGridHeaderRow]="row" [class]="'level' + row.rowIndex">
                                    <ng-template dataGridHeaderCells let-cell>
                                        <th [dataGridHeaderCell]="cell" [class]="cell.group ? 'group' : 'column'"><ng-container *dataGridCellContent /></th>
                                    </ng-template>
                                </tr>
                            </ng-template>
                        </thead>
                        <tbody dataGridBody>
                            <ng-template dataGridRows let-row>
                                <tr [dataGridRow]="row">
                                    <ng-template dataGridCells let-cell><td [dataGridCell]="cell"></td></ng-template>
                                </tr>
                            </ng-template>
                        </tbody>
                    </table>
                } @else {
                    <div dataGridGrid aria-label="People">
                        <div *dataGridHeader>
                            <ng-template dataGridHeaderRows let-row>
                                <div [dataGridHeaderRow]="row" [class]="'level' + row.rowIndex">
                                    <ng-template dataGridHeaderCells let-cell>
                                        <div [dataGridHeaderCell]="cell" [class]="cell.group ? 'group' : 'column'"><ng-container *dataGridCellContent /></div>
                                    </ng-template>
                                </div>
                            </ng-template>
                        </div>
                        <div dataGridBody>
                            <ng-template dataGridRows let-row>
                                <div [dataGridRow]="row">
                                    <ng-template dataGridCells let-cell><div [dataGridCell]="cell"></div></ng-template>
                                </div>
                            </ng-template>
                        </div>
                    </div>
                }
            </div>
        `,
    })
    class GroupedGrid {
        readonly features = TEST_FEATURES;
        readonly rows = people;
        readonly columns = groupedColumns;
        table = false;
    }

    const groupedGrid = ({ table = false }: { table?: boolean } = {}) =>
        render(GroupedGrid, (fixture) => {
            fixture.componentInstance.table = table;
        });

    const headerCell = (container: HTMLElement, row: number, column: number) =>
        container.querySelector<HTMLElement>(
            `[data-grid-part="header-cell"][data-row-index="${row}"][data-column-index="${column}"]`,
        );

    it("renders a header row per level, the group spanning its columns", async () => {
        const { container } = await groupedGrid();
        const rows = parts(container, "header-row");
        expect(rows.map((row) => row.getAttribute("aria-rowindex"))).toEqual([
            "1",
            "2",
        ]);
        expect(rows.map((row) => row.className)).toEqual([
            "level-2",
            "level-1",
        ]);
        expect(rows.map((row) => [row.style.top, row.style.height])).toEqual([
            ["0px", "35px"],
            ["35px", "35px"],
        ]);
        // an upper row stays above the next: "id" reaches down into it
        expect(rows.map((row) => row.style.zIndex)).toEqual(["2", "1"]);
        expect(parts(container, "header")[0]?.style.height).toBe("70px");
        expect(parts(container, "grid")[0]).toHaveAttribute(
            "aria-rowcount",
            "1002",
        );
        expect(
            parts(rows[0] as HTMLElement, "header-cell").map(
                (c) => c.textContent,
            ),
        ).toEqual(["#", "Person"]);
        expect(
            parts(rows[1] as HTMLElement, "header-cell").map(
                (c) => c.textContent,
            ),
        ).toEqual(["Name", "Age"]);
        const group = headerCell(container, -2, 1);
        expect(group).toHaveAttribute("data-group", "");
        expect(group).toHaveClass("group");
        expect(group).toHaveAttribute("aria-colindex", "2");
        expect(group).toHaveAttribute("aria-colspan", "2");
        expect(group?.style.left).toBe("50px");
        expect(group?.style.width).toBe("300px");
        expect(group?.style.height).toBe("35px");
        const id = headerCell(container, -2, 0);
        expect(id).not.toHaveAttribute("data-group");
        expect(id).toHaveClass("column");
        expect(id).toHaveAttribute("aria-rowspan", "2");
        expect(id?.style.height).toBe("70px");
        // the body starts below both header rows: 165px of it in view
        expect(parts(container, "row")[0]).toHaveAttribute(
            "aria-rowindex",
            "3",
        );
        expect(parts(container, "row")).toHaveLength(13);
    });

    it("keeps a single header row without a z-index", async () => {
        const { container } = await renderTestGrid({
            columns,
            rows: people,
            rowHeight: 20,
        });
        expect(parts(container, "header-row")[0]?.style.zIndex).toBe("");
    });

    it("keeps a nested grid's header rows its own", async () => {
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [rows]="rows" [columns]="columns">
                    <div dataGridGrid>
                        <div *dataGridHeader>
                            <ng-template dataGridHeaderRows let-row>
                                <div [dataGridHeaderRow]="row">
                                    <ng-template dataGridHeaderCells let-cell>
                                        <div [dataGridHeaderCell]="cell">
                                            @if (cell.key === "id") {
                                                <div dataGridRoot [rows]="innerRows" [columns]="innerColumns">
                                                    <div dataGridGrid aria-label="inner">
                                                        <div *dataGridHeader>
                                                            <ng-template dataGridHeaderRows let-inner>
                                                                <div [dataGridHeaderRow]="inner">
                                                                    <ng-template dataGridHeaderCells let-innerCell>
                                                                        <div [dataGridHeaderCell]="innerCell"><ng-container *dataGridCellContent /></div>
                                                                    </ng-template>
                                                                </div>
                                                            </ng-template>
                                                        </div>
                                                    </div>
                                                </div>
                                            } @else {
                                                {{ cell.key }}
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
        class Nested {
            readonly rows = people;
            readonly columns = groupedColumns;
            readonly innerRows = people.slice(0, 2);
            readonly innerColumns: Column<Person, DataGridNode>[] = [
                { key: "x", name: "X", width: 40 },
            ];
        }
        const { container } = await render(Nested);
        const inner = container.querySelector(
            '[aria-label="inner"]',
        ) as HTMLElement;
        expect(
            parts(inner, "header-cell").map((cell) => cell.textContent),
        ).toEqual(["X"]);
    });

    it("renders by default a header row per level, and only structural inline style", async () => {
        const { container } = await renderTestGrid({
            columns: groupedColumns,
            rows: people,
        });
        expect(parts(container, "header-row")).toHaveLength(2);
        expect(parts(container, "header-cell")).toHaveLength(4);
        expectStructuralOnly(container);
    });

    it("spans table cells: th gets colSpan and rowSpan, divs do not", async () => {
        const table = await groupedGrid({ table: true });
        expect(headerCell(table.container, -2, 1)?.tagName).toBe("TH");
        expect(headerCell(table.container, -2, 1)).toHaveAttribute(
            "colspan",
            "2",
        );
        expect(headerCell(table.container, -2, 0)).toHaveAttribute(
            "rowspan",
            "2",
        );
        expect(headerCell(table.container, -1, 1)).not.toHaveAttribute(
            "colspan",
        );
        expect(table.container.querySelectorAll("thead > tr")).toHaveLength(2);
        table.fixture.destroy();
        const divs = await groupedGrid();
        expect(headerCell(divs.container, -2, 1)).not.toHaveAttribute(
            "colspan",
        );
    });

    // a render function's state is, in Angular, the header cell directive's (`exportAs`)
    it("renders a group's renderHeaderCell, and hands a render function the spans", async () => {
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [rows]="rows" [columns]="columns">
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
                    </div>
                </div>
            `,
        })
        class GroupHeader {
            readonly rows = people;
            readonly columns: ColumnOrGroup<Person, DataGridNode>[] = [
                {
                    key: "person",
                    renderHeaderCell: ({ group, columnIndex, columnSpan }) =>
                        `${group.key} ${columnIndex}+${columnSpan}`,
                    children: [
                        { key: "name", width: 100 },
                        { key: "age", width: 100 },
                    ],
                },
            ];
            readonly cells = viewChildren(DataGridHeaderCell);
        }
        const { container, component } = await render(GroupHeader);
        expect(headerCell(container, -2, 0)?.textContent).toBe("person 0+2");
        const name = component
            .cells()
            .map((cell) => cell.state())
            .find((state) => state && !state.group && state.columnIndex === 0);
        expect(name).toMatchObject({
            rowIndex: -1,
            columnSpan: 1,
            rowSpan: 1,
            group: false,
        });
    });

    it("marks the active cell: a group, and a column spanning header rows on any of them", async () => {
        const { container, fixture } = await groupedGrid();
        const group = headerCell(container, -2, 1);
        group?.focus();
        await settled(fixture);
        expect(group).toHaveAttribute("data-active", "");
        expect(group).toHaveAttribute("tabindex", "0");
        // down to the group's first column, left to "id" on the columns' row: its one element
        keyDown(group as HTMLElement, { key: "ArrowDown" });
        await settled(fixture);
        const name = headerCell(container, -1, 1);
        expect(name).toHaveAttribute("data-active", "");
        keyDown(name as HTMLElement, { key: "ArrowLeft" });
        await settled(fixture);
        const id = headerCell(container, -2, 0);
        expect(id).toHaveAttribute("data-active", "");
        expect(document.activeElement).toBe(id);
        keyDown(id as HTMLElement, { key: "ArrowRight" });
        await settled(fixture);
        expect(document.activeElement).toBe(name);
    });

    it("keeps the columns as given: no columns.set on mount, nor for the same array", async () => {
        let model: DataGridContextValue<Person>["model"] | undefined;
        let firstHeader: unknown;
        // read on its init (Vue's setup): the root's inputs are set (its model is made from them,
        // NG0950 before), its first sync after the render has not run yet
        @Component({ selector: "test-grab", template: "" })
        class Grab implements OnInit {
            private readonly grid = injectDataGrid<Person>();
            ngOnInit() {
                model = this.grid.model;
                firstHeader ??= model.state.header;
            }
        }
        @Component({
            imports: [DATA_GRID, Grab],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [rows]="rows" [columns]="columns" [attr.data-version]="version()">
                    <test-grab />
                </div>
            `,
        })
        class Versioned {
            readonly rows = people;
            readonly columns = groupedColumns;
            readonly version = signal(0);
        }
        const { component, fixture } = await render(Versioned);
        // a columns.set on mount would have laid the header out again
        expect(model?.state.header).toBe(firstHeader);
        const commands: string[] = [];
        model?.subscribe(({ command }) => commands.push(command));
        component.version.update((version) => version + 1);
        await settled(fixture);
        expect(model?.get("column-entries")).toBe(groupedColumns);
        expect(commands).not.toContain("columns.set");
    });
});

describe("regressions", () => {
    it("goes back to the default row height when the prop is removed", async () => {
        const grid = await renderTestGrid({
            columns,
            rows: people,
            rowHeight: 50,
        });
        expect(parts(grid.container, "row")[0]?.style.height).toBe("50px");
        await grid.setProps({ columns, rows: people });
        expect(parts(grid.container, "row")[0]?.style.height).toBe("35px");
    });

    it("tells a controlled parent when the grid's shape moved the active cell", async () => {
        const onChange = vi.fn();
        const grid = await renderTestGrid({
            columns,
            rows: people,
            rowHeight: 20,
            activePosition: { rowIndex: 50, columnIndex: 0 },
            onActivePositionChange: onChange,
        });
        await grid.setProps({
            columns,
            rows: people.slice(0, 10),
            rowHeight: 20,
            activePosition: { rowIndex: 50, columnIndex: 0 },
            onActivePositionChange: onChange,
        });
        expect(onChange).toHaveBeenCalledWith({ rowIndex: 9, columnIndex: 0 });
    });

    it("keeps a row's elements when it loads in place", async () => {
        const loaded = new Map<number, Person>();
        const grid = await renderTestGrid({
            columns,
            rowCount: 100,
            getRow: (index: number) => loaded.get(index),
        });
        const before = at(grid.container, 3, 0);
        loaded.set(3, people[3] as Person);
        await grid.setProps({
            columns,
            rowCount: 100,
            getRow: (index: number) => loaded.get(index),
        });
        const after = at(grid.container, 3, 0);
        expect(after).toBe(before);
        expect(after?.textContent).toBe("Person 3");
    });
});

/** Moves its element to the document's body once rendered, as an overlay's portal does. */
@Directive({ selector: "[testPortal]" })
class TestPortal {
    constructor() {
        const element =
            inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
        afterNextRender(() => document.body.append(element));
    }
}

describe("epic review regressions", () => {
    it("keeps a controlled position the parent changes with the rows in the same update", async () => {
        const onChange = vi.fn();
        const grid = await renderTestGrid({
            columns,
            rows: people,
            rowHeight: 20,
            activePosition: { rowIndex: 500, columnIndex: 0 },
            onActivePositionChange: onChange,
        });
        await grid.setProps({
            columns,
            rows: people.slice(0, 10),
            rowHeight: 20,
            activePosition: { rowIndex: 0, columnIndex: 1 },
            onActivePositionChange: onChange,
        });
        expect(onChange).not.toHaveBeenCalled();
        expect(at(grid.container, 0, 1)).toHaveAttribute("data-active", "");
    });

    // React's render element's own onKeyDown: in Angular, a listener on the app's root element (a
    // `<section>`), which runs before the engine's
    it("lets the root's render element cancel a key", async () => {
        const onChange = vi.fn();
        @Component({
            imports: [DATA_GRID, DataGridNavigation],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <section dataGridRoot [features]="features" dataGridNavigation [rows]="rows" [columns]="columns" [defaultActivePosition]="start"
                    (activePositionChange)="onChange($event)" (keydown)="onKey($event)">
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
                </section>
            `,
        })
        class SectionRoot {
            readonly features = TEST_FEATURES;
            readonly rows = people;
            readonly columns = columns;
            readonly start = { rowIndex: 0, columnIndex: 0 };
            readonly onChange = onChange;
            onKey(event: KeyboardEvent) {
                if (event.key === "ArrowDown") event.preventDefault();
            }
        }
        const { container, fixture } = await render(SectionRoot);
        expect(container.querySelector("section")).toHaveAttribute(
            "data-grid-part",
            "root",
        );
        const cell = at(container, 0, 0) as HTMLElement;
        keyDown(cell, { key: "ArrowDown" });
        await settled(fixture);
        expect(onChange).not.toHaveBeenCalled();
        keyDown(cell, { key: "ArrowRight" });
        await settled(fixture);
        expect(onChange).toHaveBeenCalledOnce();
    });

    it("ignores keys from a portal rendered by a cell", async () => {
        const onChange = vi.fn();
        @Component({
            imports: [DATA_GRID, DataGridNavigation, TestPortal],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [features]="features" dataGridNavigation [rows]="rows" [columns]="columns" [defaultActivePosition]="start"
                    (activePositionChange)="onChange($event)">
                    <div dataGridGrid>
                        <div dataGridBody>
                            <ng-template dataGridRows let-row>
                                <div [dataGridRow]="row">
                                    <ng-template dataGridCells let-cell>
                                        <div [dataGridCell]="cell">
                                            @if (cell.rowIndex === 0 && cell.columnIndex === 0) {
                                                <button testPortal type="button">menu</button>
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
        class WithPortal {
            readonly features = TEST_FEATURES;
            readonly rows = people;
            readonly columns = columns;
            readonly start = { rowIndex: 0, columnIndex: 0 };
            readonly onChange = onChange;
        }
        const { container, fixture } = await render(WithPortal);
        const menu = [...document.body.querySelectorAll("button")].find(
            (button) => button.textContent === "menu",
        );
        expect(menu).toBeDefined();
        // in the body, out of the grid
        expect(container.contains(menu as HTMLElement)).toBe(false);
        keyDown(menu as HTMLElement, { key: "ArrowDown" });
        await settled(fixture);
        expect(onChange).not.toHaveBeenCalled();
    });

    it("keeps the engine's transform on a layer whose style has one", async () => {
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [rows]="rows" [columns]="columns">
                    <div dataGridGrid>
                        <div dataGridBody style="transform: translateZ(0); color: red"></div>
                    </div>
                </div>
            `,
        })
        class Transformed {
            readonly rows = people;
            readonly columns = columns;
        }
        const { container } = await render(Transformed);
        const body = parts(container, "body")[0];
        expect(body?.style.color).toBe("red");
        expect(body?.style.transform).toMatch(/^translate3d/);
    });
});

describe("the engine's life", () => {
    // Angular has no StrictMode (no double mount): the engine attaches once all the same
    it("attaches once under StrictMode: one window event per scroll", async () => {
        const onRowWindowChange = vi.fn();
        const { container, fixture } = await renderTestGrid({
            columns,
            rows: people,
            rowHeight: 20,
            onRowWindowChange,
        });
        const root = parts(container, "root")[0] as HTMLElement;
        onRowWindowChange.mockClear();
        scrollRoot(root, { top: 100 });
        await settled(fixture);
        expect(onRowWindowChange).toHaveBeenCalledTimes(1);
        expect(onRowWindowChange.mock.calls[0]?.[0].visible).toEqual({
            start: 5,
            end: 15,
        });
    });

    // React counts commits; Angular counts the templates' renders (`rendered`, in a binding)
    it("does not render React for a scroll that keeps the rendered window (D9)", async () => {
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                {{ rendered("component") }}
                <div dataGridRoot [rows]="rows" [columns]="columns" [rowHeight]="20">
                    <div dataGridGrid>
                        <div *dataGridHeader>
                            <ng-template dataGridHeaderRows let-row>
                                <div [dataGridHeaderRow]="row">{{ rendered("header-row") }}
                                    <ng-template dataGridHeaderCells let-cell>
                                        <div [dataGridHeaderCell]="cell">{{ rendered("header-cell") }}<ng-container *dataGridCellContent /></div>
                                    </ng-template>
                                </div>
                            </ng-template>
                        </div>
                        <div dataGridBody>
                            <ng-template dataGridRows let-row>
                                <div [dataGridRow]="row">{{ rendered("row") }}
                                    <ng-template dataGridCells let-cell>
                                        <div [dataGridCell]="cell">{{ rendered("cell") }}<ng-container *dataGridCellContent /></div>
                                    </ng-template>
                                </div>
                            </ng-template>
                        </div>
                    </div>
                </div>
            `,
        })
        class Counted {
            readonly rows = people;
            readonly columns = columns;
            protected readonly rendered = rendered;
        }
        const { container, fixture } = await render(Counted);
        expect(renders()).toBeGreaterThan(0);
        const root = parts(container, "root")[0] as HTMLElement;
        resetRenders();
        // every column is rendered (450px in a 400px view): sideways, the windows stay
        scrollRoot(root, { left: 30 });
        await settled(fixture);
        expect(renders()).toBe(0);
        // down past the overscan: a new rendered window, the parts render again
        scrollRoot(root, { top: 200 });
        await settled(fixture);
        expect(renders()).toBeGreaterThan(0);
    });

    it("reports the first windows", async () => {
        const onRowWindowChange = vi.fn();
        const onColumnWindowChange = vi.fn();
        await renderTestGrid({
            columns,
            rows: people,
            rowHeight: 20,
            onRowWindowChange,
            onColumnWindowChange,
        });
        expect(onRowWindowChange).toHaveBeenCalledWith({
            visible: { start: 0, end: 10 },
            rendered: { start: 0, end: 14 },
        });
        expect(onColumnWindowChange).toHaveBeenCalledWith({
            // 400px wide: Name (200) and Age (100) fully, Label (from 300) partly
            visible: { start: 0, end: 3 },
            rendered: { start: 0, end: 3 },
        });
    });

    // "renders new rows when the props change": the test of that name in "the structure" above
});

describe("layering (Epic #89, E5.2)", () => {
    it("stacks the header above the summary rows above the body, inside the grid's own context", async () => {
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [rows]="rows" [columns]="columns" [summaryRows]="summaryRows" style="z-index: 5">
                    <div dataGridGrid style="z-index: 9">
                        <div *dataGridHeader style="z-index: 50"></div>
                        <div *dataGridSummary="'top'"></div>
                        <div dataGridBody></div>
                        <div *dataGridSummary="'bottom'"></div>
                    </div>
                </div>
            `,
        })
        class Layered {
            readonly rows = people;
            readonly columns = columns;
            readonly summaryRows = { top: 1, bottom: 1 };
        }
        const { container } = await render(Layered);
        // structural: the app's own z-index never wins; the grid is the app's to stack
        expect(parts(container, "grid")[0]?.style.zIndex).toBe("9");
        expect(parts(container, "header")[0]?.style.zIndex).toBe("2");
        const summaries = parts(container, "summary");
        expect(summaries).toHaveLength(2);
        for (const summary of summaries) {
            expect(summary.style.zIndex).toBe("1");
        }
        expect(parts(container, "body")[0]?.style.zIndex).toBe("");
        // the root is the app's to stack in its page
        expect(parts(container, "root")[0]?.style.zIndex).toBe("5");
    });
});
