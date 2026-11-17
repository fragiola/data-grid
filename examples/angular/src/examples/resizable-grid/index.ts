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
import { Readout } from "./readout";
import type { Row } from "./row";
import * as styles from "./styles";

const ROWS = 1_000;
const COLUMNS = 100;

const getRow = (index: number): Row => ({ index });

const columns: Column<Row, DataGridNode>[] = Array.from(
    { length: COLUMNS },
    (_, i): Column<Row, DataGridNode> => ({
        key: `c${i}`,
        name: String(i),
        width: 90,
        renderCell: ({ rowIndex }) => `${rowIndex} × ${i}`,
    }),
);

// The grid's size is its CSS: here a starting size and `resize: both` (styles.ts), so the reader
// drags its corner. The engine watches its scroll container (a ResizeObserver from the
// container's own window) and renders what the new size shows: nothing to tell it.

@Component({
    selector: "example-resizable-grid",
    imports: [DATA_GRID, Readout],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <example-readout [rowWindow]="rowWindow" [columnWindow]="columnWindow" />
            <div [class]="styles.stage">
                <div
                    dataGridRoot
                    [features]="features"
                    [gridRef]="gridRef"
                    [columns]="columns"
                    [rowCount]="ROWS"
                    [getRow]="getRow"
                    [rowHeight]="32"
                    [class]="styles.root"
                >
                    <div dataGridGrid aria-label="Coordinates" [class]="styles.grid">
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
        </div>
    `,
})
export default class ResizableGrid {
    // cell navigation is a feature the grid installs: the keys, the active cell and the tab stop
    readonly features = [navigation()];
    protected readonly styles = styles;
    protected readonly ROWS = ROWS;

    readonly columns = columns;
    readonly getRow = getRow;

    // the readout follows the windows through the ref: it re-renders, the grid does not
    readonly gridRef = createDataGridRef<Row>();
    protected readonly rowWindow = injectRowWindow(this.gridRef);
    protected readonly columnWindow = injectColumnWindow(this.gridRef);
}
