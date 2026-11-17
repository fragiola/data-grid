import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { DATA_GRID, type RowKey } from "@fragiola/data-grid-angular";
import { columns } from "./columns";
import { NameCell } from "./name-cell";
import { SelectEntry } from "./select-entry";
import * as styles from "./styles";

// The grid's parts, the same for both modes: a header row and the rows' cells. It goes on the
// grid's own element, inside either root: `<div dataGridGrid exampleFileGrid aria-label="Files">`.

@Component({
    selector: "[exampleFileGrid]",
    imports: [DATA_GRID, NameCell, SelectEntry],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
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
                            @switch (cell.column.key) {
                                @case ("select") {
                                    <example-select-entry [cell]="cell" [subRowKeysOf]="subRowKeysOf()" />
                                }
                                @case ("name") {
                                    <span exampleNameCell [cell]="cell" [depth]="row.depth"></span>
                                }
                                @default {
                                    <ng-container *dataGridCellContent />
                                }
                            }
                        </div>
                    </ng-template>
                </div>
            </ng-template>
        </div>
    `,
})
export class FileGrid {
    protected readonly styles = styles;
    protected readonly columns = columns;
    /** the keys under a row (in memory: a folder's entries at every depth; none loaded lazily) */
    readonly subRowKeysOf =
        input.required<(rowIndex: number) => readonly RowKey[]>();
}
