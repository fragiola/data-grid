import { ChangeDetectionStrategy, Component } from "@angular/core";
import {
    type Column,
    DATA_GRID,
    type DataGridNode,
} from "@fragiola/data-grid-angular";
import {
    DataGridLocalRows,
    injectLocalRows,
} from "@fragiola/data-grid-angular/local";
import { sorting } from "@fragiola/data-grid-angular/sorting";
import { formatMoney, type Person, people } from "../_kit/data";
import { SortHeader } from "./header-cell";
import * as styles from "./styles";

// The rows in memory, sorted by one injection function: given to the root (`[dataGridLocalRows]`),
// it hands the grid the sorted rows and its sort (a click, Enter or Space on a header cell; Ctrl
// or ⌘ adds a column). Each header cell draws its own indicator (`header-cell.ts`).

const all = people(200);

function lastName(person: Person): string {
    return person.name.split(" ").at(-1) ?? person.name;
}

@Component({
    selector: "example-sorting",
    imports: [DATA_GRID, DataGridLocalRows, SortHeader],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div
                dataGridRoot
                [features]="features"
                [dataGridLocalRows]="local"
                [columns]="columns"
                [rowKey]="rowKey"
                [rowHeight]="36"
                [class]="styles.root"
            >
                <div dataGridGrid aria-label="People" [class]="styles.grid">
                    <div *dataGridHeader [class]="styles.header">
                        <div dataGridHeaderRow [class]="styles.headerRow">
                            <ng-template [dataGridHeaderCells]="columns" let-cell>
                                <div
                                    [dataGridHeaderCell]="cell"
                                    exampleSortHeader
                                    [class]="styles.headerCell"
                                ></div>
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
export default class Sorting {
    protected readonly styles = styles;

    readonly columns: Column<Person, DataGridNode>[] = [
        {
            key: "name",
            name: "Name",
            width: 180,
            sortable: true,
            // its own order: by last name (the others compare their values by type)
            compare: (a, b) => lastName(a).localeCompare(lastName(b)),
        },
        { key: "email", name: "Email", width: 260 },
        { key: "city", name: "City", width: 140, sortable: true },
        { key: "team", name: "Team", width: 130, sortable: true },
        {
            key: "salary",
            name: "Salary",
            width: 130,
            sortable: true,
            renderCell: ({ row }) => formatMoney(row.salary),
        },
    ];

    // sorting is a feature the grid installs: the local rows' sort needs it, or no column sorts
    readonly features = [sorting()];
    readonly local = injectLocalRows(all, this.columns, {
        defaultSortColumns: [{ columnKey: "team", direction: "ascending" }],
    });

    readonly rowKey = (row: Person) => row.id;
}
