import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import {
    type Column,
    DATA_GRID,
    type DataGridNode,
} from "@fragiola/data-grid-angular";
import {
    DataGridSummaryCell,
    DataGridSummaryCells,
    DataGridSummaryRow,
    DataGridSummaryRows,
} from "@fragiola/data-grid-angular/summary-rows";
import * as styles from "./styles";
import { SUMMARIES, type Totals } from "./summaries";

// A position's summary row: sticky, opaque, the app's figure in each cell. It goes on the summary
// itself: `<div *dataGridSummary="'top'" exampleSummary>` (its rows are the summary's position's).

@Component({
    selector: "[exampleSummary]",
    imports: [
        DATA_GRID,
        DataGridSummaryRows,
        DataGridSummaryRow,
        DataGridSummaryCells,
        DataGridSummaryCell,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <ng-template dataGridSummaryRows let-row>
            <div [dataGridSummaryRow]="row" [class]="styles.summaryRow(row)">
                <ng-template [dataGridSummaryCells]="columns()" let-cell>
                    <div
                        [dataGridSummaryCell]="cell"
                        #part="dataGridSummaryCell"
                        [class]="styles.summaryCell(part.state())"
                    >
                        {{ SUMMARIES[cell.column.key]?.(totals(), cell.position) }}
                    </div>
                </ng-template>
            </div>
        </ng-template>
    `,
})
export class Summary<TRow> {
    protected readonly styles = styles;
    protected readonly SUMMARIES = SUMMARIES;
    /** the grid's columns: they type the cells */
    readonly columns = input.required<Column<TRow, DataGridNode>[]>();
    readonly totals = input.required<Totals>();
}
