import { ChangeDetectionStrategy, Component } from "@angular/core";
import {
    type Column,
    type ColumnOrGroup,
    DATA_GRID,
    type DataGridNode,
} from "@fragiola/data-grid-angular";
import { formatMoney, measurement, type Person, people } from "../_kit/data";
import * as styles from "./styles";

const rows = people(1_000);

const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

/** A month's score, one column per month. */
function month(year: number, monthIndex: number): Column<Person, DataGridNode> {
    const columnIndex = (year - 2025) * 12 + monthIndex;
    return {
        key: `${year}-${monthIndex + 1}`,
        name: MONTHS[monthIndex],
        width: 84,
        getValue: (row) => measurement(row.id, columnIndex),
        renderCell: ({ value }) =>
            typeof value === "number" ? value.toFixed(1) : null,
        meta: { numeric: true },
    };
}

/** A quarter: a group of its three months. */
function quarter(
    year: number,
    index: number,
): ColumnOrGroup<Person, DataGridNode> {
    return {
        key: `${year}-q${index + 1}`,
        name: `Q${index + 1} ${year}`,
        children: [0, 1, 2].map((m) => month(year, index * 3 + m)),
    };
}

// a column, two groups of columns, then eight quarters of monthly scores: 2 header rows
const columns: ColumnOrGroup<Person, DataGridNode>[] = [
    { key: "id", name: "#", width: 64, meta: { numeric: true } },
    {
        key: "person",
        name: "Person",
        children: [
            { key: "name", name: "Name", width: 180 },
            { key: "email", name: "Email", width: 260 },
        ],
    },
    {
        key: "work",
        name: "Work",
        children: [
            { key: "team", name: "Team", width: 120 },
            { key: "city", name: "City", width: 140 },
            { key: "joined", name: "Joined", width: 120 },
            {
                key: "salary",
                name: "Salary",
                width: 120,
                renderCell: ({ row }) => formatMoney(row.salary),
                meta: { numeric: true },
            },
        ],
    },
    ...[2025, 2026].flatMap((year) =>
        [0, 1, 2, 3].map((index) => quarter(year, index)),
    ),
];

// With groups there are two header rows: `[dataGridHeaderRows]` renders each, its cells a group's
// or a column's. A group's name sits in a label that stays in view while the group scrolls
// (`[dataGridGroupLabel]`): sticky in the group's cell, at the view's start once the group's start
// has scrolled out, never past its end.

@Component({
    selector: "example-grouped-headers",
    imports: [DATA_GRID],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div
                dataGridRoot
                [columns]="columns"
                [rows]="rows"
                [rowKey]="rowKey"
                [rowHeight]="34"
                [class]="styles.root"
            >
                <div dataGridGrid aria-label="People" [class]="styles.grid">
                    <div *dataGridHeader [class]="styles.header">
                        <ng-template [dataGridHeaderRows]="columns" let-row>
                            <div [dataGridHeaderRow]="row" [class]="styles.headerRow(row)">
                                <ng-template [dataGridHeaderCells]="columns" let-cell>
                                    <div [dataGridHeaderCell]="cell" [class]="styles.headerCell(cell)">
                                        <!-- a group's name sticks in view; a column keeps its own content -->
                                        @if (cell.group) {
                                            <span [dataGridGroupLabel]="cell" [class]="styles.label">
                                                <ng-container *dataGridCellContent />
                                            </span>
                                        } @else {
                                            <ng-container *dataGridCellContent />
                                        }
                                    </div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                    <div dataGridBody>
                        <ng-template [dataGridRows]="columns" let-row>
                            <div [dataGridRow]="row" [class]="styles.row(row)">
                                <ng-template [dataGridCells]="columns" let-cell>
                                    <div
                                        [dataGridCell]="cell"
                                        [class]="cell.column.meta?.numeric ? styles.numeric : styles.cell"
                                    >
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
export default class GroupedHeaders {
    protected readonly styles = styles;

    readonly rows = rows;

    readonly columns = columns;

    readonly rowKey = (row: Person) => row.id;
}
