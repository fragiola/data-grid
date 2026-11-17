import { ChangeDetectionStrategy, Component, computed } from "@angular/core";
import {
    type Column,
    DATA_GRID,
    type DataGridNode,
} from "@fragiola/data-grid-angular";
import {
    DataGridLocalRows,
    injectLocalRows,
} from "@fragiola/data-grid-angular/local";
import { LucideSearch } from "@lucide/angular";
import { FIELDS } from "#/components/atoms/fields";
import { formatMoney, type Person, people } from "../_kit/data";
import * as styles from "./styles";
import { Summary } from "./summary";
import { totalsOf } from "./totals";

// Summary rows under the header and at the bottom edge: the app's own figures (an average row and
// a total row), over the rows a search leaves. Each position's rows are `summary.ts`, on the
// summary's own element.

const all = people(500);

@Component({
    selector: "example-summary-rows",
    imports: [DATA_GRID, DataGridLocalRows, FIELDS, LucideSearch, Summary],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <kit-input-simple
                    ariaLabel="Search every column"
                    placeholder="Search"
                    [value]="local.filter.search"
                    (valueChange)="local.filter.setSearch($event)"
                    [class]="styles.search"
                >
                    <svg kitInset="start" lucideSearch aria-hidden="true" [class]="styles.icon"></svg>
                </kit-input-simple>
            </div>
            <div
                dataGridRoot
                [dataGridLocalRows]="local"
                [columns]="columns"
                [rowKey]="rowKey"
                [rowHeight]="36"
                [summaryRows]="summaryRows"
                [summaryRowHeight]="38"
                [class]="styles.root"
            >
                <div dataGridGrid aria-label="People" [class]="styles.grid">
                    <div *dataGridHeader [class]="styles.header">
                        <div dataGridHeaderRow [class]="styles.headerRow">
                            <ng-template [dataGridHeaderCells]="columns" let-cell>
                                <div [dataGridHeaderCell]="cell" [class]="styles.headerCell">
                                    <ng-container *dataGridCellContent />
                                </div>
                            </ng-template>
                        </div>
                    </div>
                    <div
                        *dataGridSummary="'top'"
                        exampleSummary
                        [columns]="columns"
                        [totals]="totals()"
                        [class]="styles.summary"
                    ></div>
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
                    <!-- after the body: it stays at the view's bottom edge -->
                    <div
                        *dataGridSummary="'bottom'"
                        exampleSummary
                        [columns]="columns"
                        [totals]="totals()"
                        [class]="styles.summary"
                    ></div>
                </div>
            </div>
        </div>
    `,
})
export default class SummaryRows {
    protected readonly styles = styles;

    readonly columns: Column<Person, DataGridNode>[] = [
        {
            key: "name",
            name: "Name",
            width: 190,
            pinned: "start",
            sortable: true,
        },
        {
            key: "team",
            name: "Team",
            width: 130,
            sortable: true,
            // the bottom row's count of teams and cities spans both columns
            colSpan: (args) =>
                args.type === "summary" && args.position === "bottom"
                    ? 2
                    : undefined,
        },
        { key: "city", name: "City", width: 140, sortable: true },
        { key: "email", name: "Email", width: 260 },
        {
            key: "salary",
            name: "Salary",
            width: 130,
            sortable: true,
            renderCell: ({ row }) => formatMoney(row.salary),
        },
        { key: "joined", name: "Joined", width: 130, sortable: true },
    ];

    // the rows in memory, searched and sorted by one injection function; the totals follow what
    // it leaves
    readonly local = injectLocalRows(all, this.columns, {
        defaultSortColumns: [{ columnKey: "name", direction: "ascending" }],
    });

    protected readonly totals = computed(() =>
        totalsOf(this.local.filteredRows),
    );

    readonly summaryRows = { top: 1, bottom: 1 };

    readonly rowKey = (row: Person) => row.id;
}
