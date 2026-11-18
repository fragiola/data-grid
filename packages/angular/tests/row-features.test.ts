import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { describe, expect, it } from "vitest";
import { navigation } from "../src/navigation";
import {
    type Column,
    DATA_GRID,
    type DataGridFeatures,
    type DataGridNode,
    type RowMeta,
} from "../src/public-api";
import {
    DataGridRowDetail,
    DataGridRowExpansion,
    rowExpansion,
} from "../src/row-expansion";
import {
    DataGridGroupToggle,
    DataGridRowGrouping,
    rowGrouping,
} from "../src/row-grouping";
import { SUMMARY_ROWS, summaryRows } from "../src/summary-rows";
import { click, render, settled, stubViewportSize } from "./helpers";

// The row features (Epic #151): without `rowExpansion()`, `rowGrouping()` and `summaryRows()`
// the parts of their entries render nothing a grid would act on (no detail, no summary layer)
// and a group's toggle expands nothing; with them, the same template does.

interface Row {
    id: number;
}

const rows: Row[] = Array.from({ length: 10 }, (_, id) => ({ id }));

const columns: Column<Row, DataGridNode>[] = [
    { key: "id", name: "Id", width: 100 },
    { key: "b", name: "B", width: 100 },
];

/** Row 0 a group's, the others under it. */
const getRowMeta = (index: number): RowMeta =>
    index === 0
        ? {
              group: {
                  key: "g",
                  columnKey: "id",
                  value: 0,
                  depth: 0,
                  childCount: 9,
                  aggregates: {},
              },
          }
        : { depth: 1, parentIndex: 0 };

stubViewportSize(400, 235);

@Component({
    imports: [
        DATA_GRID,
        SUMMARY_ROWS,
        DataGridRowDetail,
        DataGridRowExpansion,
        DataGridGroupToggle,
        DataGridRowGrouping,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div dataGridRoot [features]="features()" [columns]="columns" [rows]="rows" [rowHeight]="20"
            [getRowMeta]="getRowMeta" dataGridRowExpansion [defaultExpandedRowKeys]="[1]"
            dataGridRowGrouping dataGridSummaryRows [summaryRows]="{ top: 1 }">
            <div dataGridGrid>
                <div *dataGridSummary="'top'" data-testid="summary">
                    <ng-template dataGridSummaryRows let-row>
                        <div [dataGridSummaryRow]="row"></div>
                    </ng-template>
                </div>
                <div dataGridBody>
                    <ng-template dataGridRows let-row>
                        <div [dataGridRow]="row">
                            <ng-template dataGridCells let-cell>
                                <div [dataGridCell]="cell">
                                    <button *dataGridGroupToggle="cell" type="button" data-testid="toggle"></button>
                                </div>
                            </ng-template>
                            <div *dataGridRowDetail data-testid="detail"></div>
                        </div>
                    </ng-template>
                </div>
            </div>
        </div>
    `,
})
class Grid {
    readonly features = input.required<DataGridFeatures>();
    readonly columns = columns;
    readonly rows = rows;
    readonly getRowMeta = getRowMeta;
}

const grid = (features: DataGridFeatures) =>
    render(Grid, (fixture) =>
        fixture.componentRef.setInput("features", features),
    );

const byTestId = (container: HTMLElement, id: string) =>
    container.querySelectorAll(`[data-testid="${id}"]`);

describe("a grid without the row features", () => {
    it("renders no detail and no summary layer, and a group's toggle expands nothing", async () => {
        const { container, fixture } = await grid([navigation()]);
        expect(byTestId(container, "detail")).toHaveLength(0);
        expect(byTestId(container, "summary")).toHaveLength(0);
        // a group row still says it heads a group (the data contract), its toggle does nothing
        const toggle = byTestId(container, "toggle")[0] as HTMLElement;
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        click(toggle);
        await settled(fixture);
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        // a group row is a row: no tree's ARIA, not expanded
        const row = container.querySelector('[data-grid-part="row"]');
        expect(row).not.toHaveAttribute("aria-expanded");
        expect(row).not.toHaveAttribute("aria-level");
    });
});

describe("a grid with them", () => {
    it("renders the expanded row's detail and the summary rows, and a group's toggle expands it", async () => {
        const { container, fixture } = await grid([
            navigation(),
            rowExpansion(),
            rowGrouping(),
            summaryRows(),
        ]);
        expect(byTestId(container, "detail")).toHaveLength(1);
        expect(byTestId(container, "summary")).toHaveLength(1);
        const toggle = byTestId(container, "toggle")[0] as HTMLElement;
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        click(toggle);
        await settled(fixture);
        expect(toggle).toHaveAttribute("aria-expanded", "true");
    });
});
