import { ChangeDetectionStrategy, Component } from "@angular/core";
import {
    type Column,
    type ColumnOrGroup,
    DATA_GRID,
    type DataGridNode,
} from "@fragiola/data-grid-angular";
import { columnPinning } from "@fragiola/data-grid-angular/column-pinning";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import { measurement, type Person, people } from "../_kit/data";
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

const FIRST_YEAR = 2025;
const YEARS = [FIRST_YEAR, FIRST_YEAR + 1, FIRST_YEAR + 2];

/** A month's score: one column per month, numbers on the right. */
function month(year: number, monthIndex: number): Column<Person, DataGridNode> {
    const columnIndex = (year - FIRST_YEAR) * 12 + monthIndex;
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

/** A person's months, every year: what the summary reads. */
function months(row: Person): number[] {
    return Array.from({ length: YEARS.length * 12 }, (_, columnIndex) =>
        measurement(row.id, columnIndex),
    );
}

/** A summary number: one decimal, on the right like the months. */
function summary(
    key: string,
    name: string,
    value: (scores: number[]) => number,
): Column<Person, DataGridNode> {
    return {
        key,
        name,
        width: 96,
        pinned: "end",
        getValue: (row) => value(months(row)),
        renderCell: ({ value }) =>
            typeof value === "number" ? value.toFixed(1) : null,
        meta: { numeric: true },
    };
}

// the person stays at the start (a pinned group: its columns pinned, first), the summary at the
// end (pinned last), three years of months scroll between them
const columns: ColumnOrGroup<Person, DataGridNode>[] = [
    {
        key: "person",
        name: "Person",
        children: [
            { key: "name", name: "Name", width: 180, pinned: "start" },
            { key: "team", name: "Team", width: 120, pinned: "start" },
        ],
    },
    ...YEARS.map(
        (year): ColumnOrGroup<Person, DataGridNode> => ({
            key: String(year),
            name: String(year),
            children: MONTHS.map((_, monthIndex) => month(year, monthIndex)),
        }),
    ),
    {
        key: "summary",
        name: "Summary",
        children: [
            summary(
                "average",
                "Average",
                (scores) =>
                    scores.reduce((sum, score) => sum + score, 0) /
                    scores.length,
            ),
            summary("best", "Best", (scores) => Math.max(...scores)),
        ],
    },
];

@Component({
    selector: "example-pinned-columns",
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
                [rowHeight]="34"
                [class]="styles.root"
            >
                <div dataGridGrid aria-label="Scores" [class]="styles.grid">
                    <div *dataGridHeader [class]="styles.header">
                        <ng-template [dataGridHeaderRows]="columns" let-row>
                            <div [dataGridHeaderRow]="row" [class]="styles.headerRow(row)">
                                <ng-template [dataGridHeaderCells]="columns" let-cell>
                                    <div [dataGridHeaderCell]="cell" [class]="styles.headerCell(cell)">
                                        <ng-container *dataGridCellContent />
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
                                        [class]="cell.column.meta?.numeric ? styles.numeric(cell) : styles.cell(cell)"
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
export default class PinnedColumns {
    // the features the grid installs: cell navigation (the keys, the active cell, the tab stop),
    // pinned columns (without it, every column scrolls)
    readonly features = [navigation(), columnPinning()];
    protected readonly styles = styles;

    readonly rows = rows;

    readonly columns = columns;

    readonly rowKey = (row: Person) => row.id;
}
