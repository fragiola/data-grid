import {
    ChangeDetectionStrategy,
    Component,
    Directive,
    ElementRef,
    inject,
    input,
    signal,
} from "@angular/core";
import type { ComponentFixture } from "@angular/core/testing";
import { describe, expect, it, vi } from "vitest";
import {
    type Column,
    DATA_GRID,
    type DataGridNode,
    injectDataGrid,
    type RowKey,
} from "../src/public-api";
import { DataGridRowDetail } from "../src/row-expansion";
import { type TestFeatures, type TestProps, TestRootProps } from "./grid";
import { click, render, settled, stubViewportSize } from "./helpers";

// Row details (Epic #41, M1–M4): the root maps the expansion (controlled or not) and
// `detailHeight` onto the model; `*dataGridRowDetail` renders inside its row, after its cells,
// only while the row is expanded: one cell spanning every column, sticky at the view's start (the
// engine writes its `left`), below the row's own height. A grid without expanded rows renders as
// before.

interface Row {
    id: string;
    total: number;
}

const rows: Row[] = Array.from({ length: 50 }, (_, i) => ({
    id: `r${i}`,
    total: i,
}));

const columns: Column<Row, DataGridNode>[] = Array.from(
    { length: 6 },
    (_, i) => ({
        key: `c${i}`,
        name: `C${i}`,
        width: 100,
    }),
);

/** The structural style keys a detail may carry (AGENTS.md, the primitive contract). */
const DETAIL_STRUCTURAL = new Set([
    "position",
    "left",
    "display",
    "margin-top",
    "margin-left",
    "flex-shrink",
    "width",
    "height",
    "box-sizing",
]);

stubViewportSize(400, 235);

/** A button that toggles its row, as an app's expander cell would. */
@Component({
    selector: "test-toggle",
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<button type="button" [attr.data-testid]="'toggle-' + rowIndex()" (click)="toggle()"></button>`,
})
class Toggle {
    readonly rowIndex = input.required<number>();
    private readonly grid = injectDataGrid<Row, TestFeatures>();
    toggle() {
        this.grid.model.run("expanded-rows.toggle", {
            rowIndex: this.rowIndex(),
        });
    }
}

/** The element it is on, handed to `testRef` (the app's own template ref on a part). */
@Directive({ selector: "[testRef]" })
class TestRef {
    readonly testRef = input.required<(element: HTMLElement) => void>();
    private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
    ngOnInit() {
        this.testRef()(this.element.nativeElement);
    }
}

/** The grid of divs: a toggle in each row's first cell, the row's detail after its cells. */
@Component({
    imports: [DATA_GRID, TestRootProps, Toggle, DataGridRowDetail],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div dataGridRoot [columns]="props().columns" [testProps]="props()">
            <div dataGridGrid>
                <div dataGridBody>
                    <ng-template [dataGridRows]="props().columns" let-row>
                        <!-- React's className function: the state's class (an attribute binding: a class binding runs before the directive's input is set) -->
                        <div [dataGridRow]="row" #own="dataGridRow" [attr.class]="own.state()?.expanded ? 'open' : null">
                            <ng-template dataGridCells let-cell>
                                <div [dataGridCell]="cell">
                                    @if (cell.columnIndex === 0) {
                                        <test-toggle [rowIndex]="cell.rowIndex" />
                                    }
                                </div>
                            </ng-template>
                            @if (withDetail()) {
                                <div *dataGridRowDetail>
                                    <p [attr.data-testid]="'detail-' + row.rowIndex">{{ row.row?.id }}</p>
                                </div>
                            }
                        </div>
                    </ng-template>
                </div>
            </div>
        </div>
    `,
})
class DivGrid {
    readonly props = input.required<TestProps<Row>>();
    readonly withDetail = input(true);
}

/** The table grid, its detail with the app's attributes, style, class and ref. */
@Component({
    imports: [DATA_GRID, TestRootProps, TestRef, DataGridRowDetail],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div dataGridRoot [columns]="props().columns" [testProps]="props()">
            <table dataGridGrid>
                <tbody dataGridBody>
                    <ng-template [dataGridRows]="props().columns" let-row>
                        <tr [dataGridRow]="row">
                            <ng-template dataGridCells let-cell>
                                <td [dataGridCell]="cell"></td>
                            </ng-template>
                            <td *dataGridRowDetail="let state"
                                [testRef]="see"
                                [class]="'d' + state.height"
                                aria-label="details"
                                style="left: 99px; top: 5px; margin-top: 1px; color: red">
                                <p>{{ row.row?.id }}</p>
                            </td>
                        </tr>
                    </ng-template>
                </tbody>
            </table>
        </div>
    `,
})
class TableGrid {
    readonly props = input.required<TestProps<Row>>();
    readonly seen = signal<HTMLElement | null>(null);
    readonly see = (element: HTMLElement) => this.seen.set(element);
}

/** The props a test gives over the test's rows (never the rows themselves). */
type GridProps = Omit<
    TestProps<Row>,
    "columns" | "rows" | "rowCount" | "getRow"
> & { columns?: TestProps<Row>["columns"] };

/** Renders the div grid with `props` over the test's rows, keys and row height. */
function grid(props: GridProps = {}, withDetail = true) {
    return render(DivGrid, (fixture) =>
        setGridProps(fixture, props, withDetail),
    );
}

function setGridProps(
    fixture: ComponentFixture<DivGrid>,
    props: GridProps,
    withDetail = true,
) {
    fixture.componentRef.setInput("props", propsOf(props));
    fixture.componentRef.setInput("withDetail", withDetail);
}

const propsOf = (props: GridProps): TestProps<Row> => ({
    columns,
    rows,
    rowKey: (row: Row) => row.id,
    rowHeight: 20,
    ...props,
});

const rowElement = (container: HTMLElement, rowIndex: number) =>
    container.querySelector<HTMLElement>(
        `[data-grid-part="row"][data-row-index="${rowIndex}"]`,
    );
const detailOf = (container: HTMLElement, rowIndex: number) =>
    container.querySelector<HTMLElement>(
        `[data-grid-part="row-detail"][data-row-index="${rowIndex}"]`,
    );
const byTestId = (container: HTMLElement, id: string) => {
    const element = container.querySelector(`[data-testid="${id}"]`);
    if (!(element instanceof HTMLElement)) throw new Error(`no ${id}`);
    return element;
};

describe("DataGrid.RowDetail", () => {
    it("renders nothing, and changes nothing, while no row is expanded", async () => {
        const { container } = await grid();
        expect(
            container.querySelector('[data-grid-part="row-detail"]'),
        ).toBeNull();
        expect(container.querySelector("[data-expanded]")).toBeNull();
        const row = rowElement(container, 1);
        expect(row?.style.height).toBe("20px");
        const without = (await grid({}, false)).container;
        expect(rowElement(without, 1)?.getAttribute("style")).toBe(
            row?.getAttribute("style"),
        );
    });

    it("renders below its cells while the row is expanded, uncontrolled", async () => {
        const onChange = vi.fn();
        const { container, fixture } = await grid({
            detailHeight: 100,
            onExpandedRowKeysChange: onChange,
        });
        click(byTestId(container, "toggle-2"));
        await settled(fixture);
        expect(onChange).toHaveBeenLastCalledWith(["r2"]);
        const row = rowElement(container, 2);
        const detail = detailOf(container, 2);
        expect(row?.hasAttribute("data-expanded")).toBe(true);
        expect(row?.className).toBe("open");
        // the row's box holds its detail; its cells keep their own height
        expect(row?.style.height).toBe("120px");
        expect(
            row?.querySelector<HTMLElement>('[data-grid-part="cell"]')?.style
                .height,
        ).toBe("20px");
        expect(rowElement(container, 3)?.style.top).toBe("160px");
        // after its cells, in its row
        expect(row?.lastElementChild).toBe(detail);
        expect(detail?.textContent).toBe("r2");
        expect(detail?.style.position).toBe("sticky");
        expect(detail?.style.marginTop).toBe("20px");
        expect(detail?.style.width).toBe("400px");
        expect(detail?.style.height).toBe("100px");
        // the engine's inset: the view's start
        expect(detail?.style.left).toBe("0px");
        click(byTestId(container, "toggle-2"));
        await settled(fixture);
        expect(detailOf(container, 2)).toBeNull();
        expect(rowElement(container, 2)?.hasAttribute("data-expanded")).toBe(
            false,
        );
        expect(onChange).toHaveBeenLastCalledWith([]);
    });

    it("is one cell of its row spanning every column, with no row count change", async () => {
        const { container } = await grid({ defaultExpandedRowKeys: ["r1"] });
        const gridElement = container.querySelector('[data-grid-part="grid"]');
        const detail = detailOf(container, 1);
        expect(detail?.getAttribute("role")).toBe("gridcell");
        expect(detail?.getAttribute("aria-colindex")).toBe("1");
        expect(detail?.getAttribute("aria-colspan")).toBe("6");
        expect(detail?.hasAttribute("data-column-index")).toBe(false);
        expect(detail?.hasAttribute("aria-label")).toBe(false);
        expect(gridElement?.getAttribute("aria-rowcount")).toBe("51");
        // the header row first: row 2 is the fourth, as without a detail
        expect(rowElement(container, 2)?.getAttribute("aria-rowindex")).toBe(
            "4",
        );
    });

    it("follows the controlled keys, and asks for a toggle", async () => {
        let fixture: ComponentFixture<DivGrid> | undefined;
        const controlled = (keys: readonly RowKey[]): GridProps => ({
            expandedRowKeys: keys,
            onExpandedRowKeysChange: (next) => {
                if (fixture) setGridProps(fixture, controlled(next));
            },
        });
        const rendered = await grid(controlled(["r0"]));
        fixture = rendered.fixture;
        const { container } = rendered;
        expect(detailOf(container, 0)).not.toBeNull();
        click(byTestId(container, "toggle-3"));
        await settled(fixture);
        expect(detailOf(container, 3)).not.toBeNull();
        click(byTestId(container, "toggle-0"));
        await settled(fixture);
        expect(detailOf(container, 0)).toBeNull();
    });

    it("stays as the parent holds it when the parent declines", async () => {
        const onChange = vi.fn();
        const { container, fixture } = await grid({
            expandedRowKeys: [],
            onExpandedRowKeysChange: onChange,
        });
        click(byTestId(container, "toggle-1"));
        await settled(fixture);
        expect(onChange).toHaveBeenCalledWith(["r1"]);
        expect(detailOf(container, 1)).toBeNull();
    });

    it("takes its height from its row", async () => {
        const { container } = await grid({
            defaultExpandedRowKeys: ["r4"],
            detailHeight: (row) => 50 + row.total,
        });
        expect(detailOf(container, 4)?.style.height).toBe("54px");
        expect(rowElement(container, 4)?.style.height).toBe("74px");
    });

    // React's `ref` prop merging and `className`/`style` functions have no Angular form: the
    // directive is on the app's own element (its ref is the app's, here through a directive), the
    // state's class is a binding from the template's `let state`, the style is a value
    it("follows the primitive contract: render, ref, className and style functions", async () => {
        const { container, component } = await render(TableGrid, (fixture) =>
            fixture.componentRef.setInput(
                "props",
                propsOf({ defaultExpandedRowKeys: ["r1"], detailHeight: 80 }),
            ),
        );
        const detail = detailOf(container, 1);
        expect(detail?.tagName).toBe("TD");
        expect(detail?.getAttribute("colspan")).toBe("6");
        expect(component.seen()).toBe(detail);
        expect(detail?.className).toBe("d80");
        expect(detail?.getAttribute("aria-label")).toBe("details");
        // structural keys win, the engine's inset stays, the consumer's colour is merged in
        expect(detail?.style.marginTop).toBe("20px");
        expect(detail?.style.left).toBe("0px");
        expect(detail?.style.top).toBe("");
        expect(detail?.style.color).toBe("red");
        expect(detail?.style.display).toBe("block");
    });

    it("applies only structural inline style, pinned columns too", async () => {
        const pinnedColumns: Column<Row, DataGridNode>[] = columns.map(
            (column, i) => (i === 0 ? { ...column, pinned: "start" } : column),
        );
        for (const cells of [columns, pinnedColumns]) {
            const { container, fixture } = await grid({
                columns: cells,
                defaultExpandedRowKeys: ["r1"],
            });
            const detail = detailOf(container, 1);
            expect(detail).not.toBeNull();
            for (const property of Array.from(detail?.style ?? [])) {
                expect(DETAIL_STRUCTURAL.has(property), property).toBe(true);
            }
            if (cells === pinnedColumns) {
                // from the row's start, before the pinned cells, never shrunk by the flex row
                expect(detail?.style.marginLeft).toBe("-100px");
                expect(detail?.style.flexShrink).toBe("0");
            } else {
                expect(detail?.style.marginLeft).toBe("");
            }
            fixture.destroy();
        }
    });

    it("leaves the grid's keys alone inside a detail", async () => {
        const { container, fixture } = await grid({
            defaultExpandedRowKeys: ["r0"],
        });
        const cell = container.querySelector<HTMLElement>(
            '[data-row-index="1"][data-column-index="1"]',
        );
        cell?.focus();
        await settled(fixture);
        const inside = container.querySelector<HTMLElement>(
            '[data-testid="detail-0"]',
        );
        const event = new KeyboardEvent("keydown", {
            key: "ArrowDown",
            bubbles: true,
            cancelable: true,
        });
        inside?.dispatchEvent(event);
        await settled(fixture);
        expect(event.defaultPrevented).toBe(false);
        expect(
            container
                .querySelector('[data-active][data-grid-part="cell"]')
                ?.getAttribute("data-row-index"),
        ).toBe("1");
    });
});
