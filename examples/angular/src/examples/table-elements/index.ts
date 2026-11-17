import { ChangeDetectionStrategy, Component } from "@angular/core";
import {
    type Column,
    DATA_GRID,
    type DataGridNode,
} from "@fragiola/data-grid-angular";
import { formatMoney, type Person, people } from "../_kit/data";
import * as styles from "./styles";

// Every part is a directive on your own element: here each one is the table element it stands
// for. The grid keeps role="grid" (an interactive table), and the primitives set the structural
// style that lets table parts be positioned like any other element.

@Component({
    selector: "example-table-elements",
    imports: [DATA_GRID],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div
                dataGridRoot
                [columns]="columns"
                [rows]="rows"
                [rowKey]="rowKey"
                [rowHeight]="36"
                [class]="styles.root"
            >
                <table dataGridGrid aria-label="People" [class]="styles.grid">
                    <thead *dataGridHeader [class]="styles.header">
                        <tr dataGridHeaderRow [class]="styles.headerRow">
                            <ng-template [dataGridHeaderCells]="columns" let-cell>
                                <th [dataGridHeaderCell]="cell" [class]="styles.headerCell">
                                    <ng-container *dataGridCellContent />
                                </th>
                            </ng-template>
                        </tr>
                    </thead>
                    <tbody dataGridBody>
                        <ng-template [dataGridRows]="columns" let-row>
                            <tr [dataGridRow]="row" [class]="styles.row(row)">
                                <ng-template [dataGridCells]="columns" let-cell>
                                    <td [dataGridCell]="cell" [class]="styles.cell">
                                        <ng-container *dataGridCellContent />
                                    </td>
                                </ng-template>
                            </tr>
                        </ng-template>
                    </tbody>
                </table>
            </div>
        </div>
    `,
})
export default class TableElements {
    protected readonly styles = styles;

    readonly rows = people(10_000);

    readonly columns: Column<Person, DataGridNode>[] = [
        { key: "id", name: "#", width: 72 },
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
