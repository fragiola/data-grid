import { ChangeDetectionStrategy, Component } from "@angular/core";
import {
    type Column,
    DATA_GRID,
    type DataGridNode,
} from "@fragiola/data-grid-angular";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import { formatMoney, type Person, people } from "../_kit/data";
import * as styles from "./styles";

// The parts are directives on your own elements; the rows and cells are your templates. Each
// header cell and cell renders its default content (`*dataGridCellContent`): the column's name,
// its renderer, else the value.

@Component({
    selector: "example-hello-grid",
    imports: [DATA_GRID],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div
                dataGridRoot
                [features]="features"
                [columns]="columns"
                [rows]="rows"
                [rowKey]="rowKey"
                [rowHeight]="36"
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
export default class HelloGrid {
    // cell navigation is a feature the grid installs: the keys, the active cell and the tab stop
    readonly features = [navigation()];
    protected readonly styles = styles;

    readonly rows = people(100);

    readonly columns: Column<Person, DataGridNode>[] = [
        { key: "id", name: "#", width: 64 },
        { key: "name", name: "Name", width: 180 },
        { key: "email", name: "Email", width: 260 },
        { key: "city", name: "City", width: 140 },
        { key: "team", name: "Team", width: 120 },
        {
            key: "salary",
            name: "Salary",
            width: 120,
            renderCell: ({ row }) => formatMoney(row.salary),
        },
    ];

    readonly rowKey = (row: Person) => row.id;
}
