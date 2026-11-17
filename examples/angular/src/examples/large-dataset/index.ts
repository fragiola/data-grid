import { ChangeDetectionStrategy, Component } from "@angular/core";
import {
    type Column,
    createDataGridRef,
    DATA_GRID,
    type DataGridNode,
    injectColumnWindow,
    injectRowWindow,
} from "@fragiola/data-grid-angular";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import { formatNumber, measurement } from "../_kit/data";
import { Readout } from "./readout";
import type { Row } from "./row";
import * as styles from "./styles";

const ROWS = 1_000_000;
const COLUMNS = 1_000;

const getRow = (index: number): Row => ({ index });

const columns: Column<Row, DataGridNode>[] = [
    {
        key: "row",
        name: "Row",
        // in view while the measurements scroll sideways
        pinned: "start",
        width: 96,
        renderCell: ({ row }) => formatNumber(row.index + 1),
    },
    ...Array.from(
        { length: COLUMNS - 1 },
        (_, i): Column<Row, DataGridNode> => ({
            key: `m${i + 1}`,
            name: `M${i + 1}`,
            width: 96,
            getValue: (row) => measurement(row.index, i + 1),
            renderCell: ({ value }) =>
                typeof value === "number" ? value.toFixed(2) : null,
        }),
    ),
];

@Component({
    selector: "example-large-dataset",
    imports: [DATA_GRID, Readout],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <example-readout
                [rowWindow]="rowWindow"
                [columnWindow]="columnWindow"
                [rows]="ROWS"
                [columns]="COLUMNS"
            />
            <div
                dataGridRoot
                [features]="features"
                [columns]="columns"
                [rowCount]="ROWS"
                [getRow]="getRow"
                [rowHeight]="32"
                [class]="styles.root"
                [gridRef]="gridRef"
            >
                <div dataGridGrid aria-label="Measurements" [class]="styles.grid">
                    <div *dataGridHeader [class]="styles.header">
                        <div dataGridHeaderRow [class]="styles.headerRow">
                            <ng-template [dataGridHeaderCells]="columns" let-cell>
                                <div [dataGridHeaderCell]="cell" [class]="styles.headerCell">
                                    <ng-container *dataGridCellContent />
                                </div>
                            </ng-template>
                        </div>
                    </div>
                    <div dataGridBody>
                        <ng-template [dataGridRows]="columns" let-row>
                            <div [dataGridRow]="row" [class]="styles.row(row)">
                                <ng-template [dataGridCells]="columns" let-cell>
                                    <div [dataGridCell]="cell" [class]="styles.cell(cell)">
                                        <ng-container *dataGridCellContent />
                                    </div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                </div>
            </div>
        </div>
    `,
})
export default class LargeDataset {
    // cell navigation is a feature the grid installs: the keys, the active cell and the tab stop
    readonly features = [navigation()];
    protected readonly styles = styles;
    protected readonly ROWS = ROWS;
    protected readonly COLUMNS = COLUMNS;

    readonly columns = columns;
    readonly getRow = getRow;

    // the readout follows the grid's windows through the ref: it re-renders, the grid does not
    readonly gridRef = createDataGridRef<Row>();
    protected readonly rowWindow = injectRowWindow(this.gridRef);
    protected readonly columnWindow = injectColumnWindow(this.gridRef);
}
