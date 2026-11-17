import { ChangeDetectionStrategy, Component } from "@angular/core";
import {
    type Column,
    createDataGridRef,
    DATA_GRID,
    type DataGridNode,
    injectColumnWindow,
} from "@fragiola/data-grid-angular";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import { formatNumber, measurement } from "../_kit/data";
import { ColumnReadout } from "./column-readout";
import * as styles from "./styles";

const ROWS = 10_000;
const COLUMNS = 5_000;

interface Row {
    index: number;
}

const getRow = (index: number): Row => ({ index });

const columns: Column<Row, DataGridNode>[] = Array.from(
    { length: COLUMNS },
    (_, i): Column<Row, DataGridNode> => ({
        key: `c${i}`,
        name: `Column ${formatNumber(i + 1)}`,
        width: 120,
        getValue: (row) => measurement(row.index, i),
        renderCell: ({ value }) =>
            typeof value === "number" ? value.toFixed(2) : null,
    }),
);

@Component({
    selector: "example-many-columns",
    imports: [DATA_GRID, ColumnReadout],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <example-column-readout [columnWindow]="columnWindow" [columns]="COLUMNS" />
            <div
                dataGridRoot
                [features]="features"
                [columns]="columns"
                [rowCount]="ROWS"
                [getRow]="getRow"
                [rowHeight]="32"
                [overscan]="{ columns: 3 }"
                [class]="styles.root"
                [gridRef]="gridRef"
            >
                <div dataGridGrid aria-label="Columns" [class]="styles.grid">
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
                                    <div [dataGridCell]="cell" [class]="styles.cell">
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
export default class ManyColumns {
    // cell navigation is a feature the grid installs: the keys, the active cell and the tab stop
    readonly features = [navigation()];
    protected readonly styles = styles;
    protected readonly ROWS = ROWS;
    protected readonly COLUMNS = COLUMNS;

    readonly columns = columns;
    readonly getRow = getRow;

    // the readout follows the column window through the ref: it re-renders, the grid does not
    readonly gridRef = createDataGridRef<Row>();
    protected readonly columnWindow = injectColumnWindow(this.gridRef);
}
