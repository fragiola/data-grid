import {
    ChangeDetectionStrategy,
    Component,
    input,
    signal,
} from "@angular/core";
import type { ComponentFixture } from "@angular/core/testing";
import { describe, expect, it, vi } from "vitest";
import {
    DataGridLocalRows,
    groupKeyOf,
    injectLocalRows,
    type LocalRowsResult,
} from "../src/local";
import {
    type Column,
    DATA_GRID,
    type DataGridNode,
    type RowKey,
} from "../src/public-api";
import { DataGridGroupToggle } from "../src/row-grouping";
import { DataGridRowSelection } from "../src/row-selection";
import { TEST_FEATURES } from "./grid";
import {
    cellAt,
    click,
    keyDown,
    render,
    root,
    rowAt,
    settled,
    stubViewportSize,
} from "./helpers";

// Row groups in Angular (Epic #87, E3.1–E3.2): `injectLocalRows` groups by columns and hands the
// root the rows shown with their kinds; the grid is a treegrid, group rows render their value and
// the app's aggregates, the app's toggle (`*dataGridGroupToggle`) and the keys expand them, and a
// group row selects its rows.

interface Sale {
    id: number;
    country: string;
    city: string;
    amount: number;
}

const sales: Sale[] = [
    { id: 1, country: "France", city: "Paris", amount: 10 },
    { id: 2, country: "Brazil", city: "Recife", amount: 5 },
    { id: 3, country: "France", city: "Lyon", amount: 7 },
    { id: 4, country: "Brazil", city: "Natal", amount: 3 },
];

const columns: Column<Sale, DataGridNode>[] = [
    { key: "country", name: "Country", width: 120 },
    { key: "city", name: "City", width: 120 },
    {
        key: "amount",
        name: "Amount",
        width: 100,
        renderGroupCell: ({ value }) => `Σ ${String(value)}`,
    },
];

const aggregates = {
    amount: (rows: readonly Sale[]) =>
        rows.reduce((total, row) => total + row.amount, 0),
};
const rowKey = (row: Sale) => row.id;

const BRAZIL = groupKeyOf([["country", "Brazil"]]);
const FRANCE = groupKeyOf([["country", "France"]]);

stubViewportSize(600, 400);

let latest: LocalRowsResult<Sale> | undefined;

/**
 * A body cell: in a group row's cell of its column, the app's toggle and the group's value and
 * count; else its default content.
 */
const CELL = `
    @if (cell.group && cell.column.key === cell.group.columnKey) {
        <button *dataGridGroupToggle="cell; let state" type="button" [attr.aria-label]="state.expanded ? 'Collapse' : 'Expand'"></button>{{ cell.value }} ({{ cell.group.childCount }})} @else {<ng-container *dataGridCellContent />}
`;

@Component({
    imports: [
        DATA_GRID,
        DataGridRowSelection,
        DataGridLocalRows,
        DataGridGroupToggle,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div dataGridRoot [features]="features" dataGridRowSelection [columns]="columns" [rowHeight]="20" [rowSelection]="rowSelection()" [dataGridLocalRows]="local">
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
                        <ng-template dataGridRows [dataGridRows]="columns" let-row>
                            <tr [dataGridRow]="row">
                                <ng-template dataGridCells [dataGridCells]="columns" let-cell>
                                    <td [dataGridCell]="cell">${CELL}</td>
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
                        <ng-template dataGridRows [dataGridRows]="columns" let-row>
                            <div [dataGridRow]="row">
                                <ng-template dataGridCells [dataGridCells]="columns" let-cell>
                                    <div [dataGridCell]="cell">${CELL}</div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                </div>
            }
        </div>
    `,
})
class Sales {
    readonly features = TEST_FEATURES;
    readonly groupBy = input<readonly string[]>(["country"]);
    readonly table = input(false);
    readonly expandedGroupKeys = input<readonly RowKey[] | undefined>(
        undefined,
    );
    /** the options' `onExpandedGroupKeysChange` */
    readonly expandedGroupKeysChange = input<
        ((keys: readonly RowKey[]) => void) | undefined
    >(undefined);
    readonly rowSelection = input<"multiple" | undefined>(undefined);
    readonly columns = columns;
    readonly local = injectLocalRows(sales, columns, () => ({
        groupBy: this.groupBy(),
        aggregates,
        rowKey,
        expandedGroupKeys: this.expandedGroupKeys(),
        onExpandedGroupKeysChange: this.expandedGroupKeysChange(),
    }));

    constructor() {
        latest = this.local;
    }
}

/** Renders the sales with the inputs given. */
const renderSales = (
    inputs: {
        readonly table?: boolean;
        readonly groupBy?: readonly string[];
        readonly rowSelection?: "multiple";
    } = {},
) =>
    render(Sales, (fixture) => {
        for (const [name, value] of Object.entries(inputs)) {
            fixture.componentRef.setInput(name, value);
        }
    });

const grid = (container: HTMLElement) =>
    root(container).querySelector('[data-grid-part="grid"]');

const rowCount = (container: HTMLElement) =>
    container.querySelectorAll('[data-grid-part="row"]').length;

describe.each([false, true])("row groups (table: %s)", (table) => {
    it("makes a treegrid of group rows, with their value and aggregates", async () => {
        const { container } = await renderSales({ table });
        expect(grid(container)?.getAttribute("role")).toBe("treegrid");
        expect(rowCount(container)).toBe(2);
        const brazil = rowAt(container, 0);
        expect(brazil.hasAttribute("data-group-row")).toBe(true);
        expect(brazil.hasAttribute("data-loading")).toBe(false);
        expect(brazil.hasAttribute("data-group-expanded")).toBe(false);
        expect(brazil.getAttribute("aria-level")).toBe("1");
        expect(brazil.getAttribute("aria-expanded")).toBe("false");
        expect(brazil.getAttribute("aria-setsize")).toBe("2");
        expect(brazil.getAttribute("aria-posinset")).toBe("1");
        expect(brazil.getAttribute("data-depth")).toBe("0");
        expect(cellAt(container, 0, 0).textContent).toBe("Brazil (2)");
        // the column's renderGroupCell, given the aggregate
        expect(cellAt(container, 0, 2).textContent).toBe("Σ 8");
        // a column with no aggregate shows nothing
        expect(cellAt(container, 0, 1).textContent).toBe("");
    });

    it("expands a group by the app's toggle: its rows under it", async () => {
        const { container } = await renderSales({ table });
        const toggle = cellAt(container, 1, 0).querySelector("button");
        if (!toggle) throw new Error("no toggle");
        expect(toggle.getAttribute("aria-expanded")).toBe("false");
        click(toggle);
        await settled();
        expect(latest?.group.expandedKeys).toEqual([FRANCE]);
        expect(rowCount(container)).toBe(4);
        const france = rowAt(container, 1);
        expect(france.getAttribute("aria-expanded")).toBe("true");
        expect(france.hasAttribute("data-group-expanded")).toBe(true);
        const paris = rowAt(container, 2);
        expect(paris.getAttribute("aria-level")).toBe("2");
        expect(paris.hasAttribute("data-group-row")).toBe(false);
        expect(cellAt(container, 2, 1).textContent).toBe("Paris");
        expect(
            cellAt(container, 1, 0).querySelector("button")?.dataset.expanded,
        ).toBe("");
    });

    it("toggles a group row with Enter, and goes up the tree with ←", async () => {
        const { container } = await renderSales({ table });
        cellAt(container, 0, 1).focus();
        click(cellAt(container, 0, 1));
        await settled();
        keyDown(cellAt(container, 0, 1), { key: "Enter" });
        await settled();
        expect(latest?.group.expandedKeys).toEqual([BRAZIL]);
        expect(rowCount(container)).toBe(4);
        cellAt(container, 2, 0).focus();
        await settled();
        keyDown(cellAt(container, 2, 0), { key: "ArrowLeft" });
        await settled();
        expect(document.activeElement).toBe(cellAt(container, 0, 0));
        keyDown(cellAt(container, 0, 0), { key: "ArrowLeft" });
        await settled();
        expect(latest?.group.expandedKeys).toEqual([]);
        expect(rowCount(container)).toBe(2);
    });

    it("selects a group row's rows", async () => {
        const { container } = await renderSales({
            table,
            rowSelection: "multiple",
        });
        const brazil = rowAt(container, 0);
        expect(brazil.getAttribute("aria-selected")).toBe("false");
        cellAt(container, 0, 1).focus();
        await settled();
        keyDown(cellAt(container, 0, 1), { key: " ", shiftKey: true });
        await settled();
        expect(rowAt(container, 0).getAttribute("aria-selected")).toBe("true");
        expect(rowAt(container, 0).hasAttribute("data-selected")).toBe(true);
    });
});

describe("row groups", () => {
    it("leave a grid without groups as it was: a grid, rows without levels", async () => {
        const { container } = await renderSales({ groupBy: [] });
        expect(grid(container)?.getAttribute("role")).toBe("grid");
        expect(rowCount(container)).toBe(4);
        const row = rowAt(container, 0);
        for (const name of [
            "aria-level",
            "aria-expanded",
            "aria-setsize",
            "aria-posinset",
            "data-depth",
            "data-group-row",
        ]) {
            expect(row.hasAttribute(name), name).toBe(false);
        }
        expect(latest?.props).not.toHaveProperty("getRowMeta");
        expect(cellAt(container, 0, 0).querySelector("button")).toBeNull();
    });

    it("follow controlled keys, and ask for the toggle's", async () => {
        const asked = vi.fn();
        let fixture: ComponentFixture<Sales> | undefined;
        const { container } = await render(Sales, (created) => {
            fixture = created;
            created.componentRef.setInput("expandedGroupKeys", [BRAZIL]);
            created.componentRef.setInput(
                "expandedGroupKeysChange",
                (next: readonly RowKey[]) => {
                    asked(next);
                    fixture?.componentRef.setInput("expandedGroupKeys", next);
                },
            );
        });
        expect(rowCount(container)).toBe(4);
        const toggle = cellAt(container, 3, 0).querySelector("button");
        if (toggle) click(toggle);
        await settled(fixture);
        expect(asked).toHaveBeenLastCalledWith([BRAZIL, FRANCE]);
        expect(rowCount(container)).toBe(6);
    });

    it("keep the selection by the app's keys once the grouping is off", async () => {
        const { container, fixture } = await renderSales({
            rowSelection: "multiple",
        });
        cellAt(container, 0, 1).focus();
        await settled();
        keyDown(cellAt(container, 0, 1), { key: " ", shiftKey: true });
        await settled();
        // Brazil: the sales 2 and 4
        fixture.componentRef.setInput("groupBy", []);
        await settled(fixture);
        const second = sales[1];
        if (!second) throw new Error("no sale");
        expect(latest?.props.rowKey?.(second, 1)).toBe(2);
        const selected = [0, 1, 2, 3].map(
            (rowIndex) =>
                rowAt(container, rowIndex).getAttribute("aria-selected") ===
                "true",
        );
        expect(selected).toEqual([false, true, false, true]);
    });

    it("drop the row kinds when getRowMeta is removed from the root", async () => {
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [features]="features" [columns]="columns" [rows]="rows" [rowHeight]="20"
                    [getRowMeta]="meta() ? getRowMeta : undefined">
                    <div dataGridGrid></div>
                </div>
            `,
        })
        class Meta {
            readonly features = TEST_FEATURES;
            readonly columns = columns;
            readonly rows = sales;
            readonly getRowMeta = () => ({ depth: 0 });
            readonly meta = signal(true);
        }
        const { container, component, fixture } = await render(Meta);
        expect(grid(container)?.getAttribute("role")).toBe("treegrid");
        component.meta.set(false);
        await settled(fixture);
        expect(grid(container)?.getAttribute("role")).toBe("grid");
    });

    it("nest by two columns, and expand them all", async () => {
        const { container } = await renderSales({
            groupBy: ["country", "city"],
        });
        latest?.group.expandAll();
        await settled();
        // Brazil, Natal, #4, Recife, #2, France, Lyon, #3, Paris, #1
        expect(rowCount(container)).toBe(10);
        expect(rowAt(container, 2).getAttribute("aria-level")).toBe("3");
        latest?.group.collapseAll();
        await settled();
        expect(rowCount(container)).toBe(2);
    });
});
