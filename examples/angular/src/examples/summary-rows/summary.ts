import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import {
    type Column,
    DATA_GRID,
    type DataGridNode,
} from "@fragiola/data-grid-angular";
import type { Person } from "../_kit/data";
import * as styles from "./styles";
import { SUMMARIES, type Totals } from "./totals";

// A position's summary rows: sticky, opaque, above the rows that scroll under them. Each cell
// shows the app's figure for its column, read here as it renders. It goes on the summary itself:
// `<div *dataGridSummary="'top'" exampleSummary>` (the summary's directive is on that element's
// template: its rows are the summary's position's).

@Component({
    selector: "[exampleSummary]",
    imports: [DATA_GRID],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <ng-template dataGridSummaryRows let-row>
            <div [dataGridSummaryRow]="row" [class]="styles.summaryRow(row)">
                <ng-template [dataGridSummaryCells]="columns()" let-cell>
                    <div [dataGridSummaryCell]="cell" [class]="styles.summaryCell">
                        {{ SUMMARIES[cell.column.key]?.(totals(), cell.position) }}
                    </div>
                </ng-template>
            </div>
        </ng-template>
    `,
})
export class Summary {
    protected readonly styles = styles;
    protected readonly SUMMARIES = SUMMARIES;
    /** the grid's columns: they type the cells */
    readonly columns = input.required<Column<Person, DataGridNode>[]>();
    readonly totals = input.required<Totals>();
}
