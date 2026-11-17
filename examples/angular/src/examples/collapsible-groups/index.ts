import { ChangeDetectionStrategy, Component } from "@angular/core";
import {
    type Column,
    type ColumnOrGroup,
    createDataGridRef,
    DATA_GRID,
    type DataGridNode,
} from "@fragiola/data-grid-angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { formatNumber, measurement, type Person, people } from "../_kit/data";
import { GroupHeader } from "./group-header";
import * as styles from "./styles";

const rows = people(500);

const YEARS = [2025, 2026];
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

/** A rep's sales in a month (0–1,000 units), from the rep and the month. */
const sales = (row: Person, year: number, month: number) =>
    Math.round(measurement(row.id, (year - 2025) * 12 + month) * 10);

/** The sales of a range of months: a quarter's, a year's. */
const sum = (row: Person, year: number, from: number, to: number) => {
    let total = 0;
    for (let month = from; month < to; month++) {
        total += sales(row, year, month);
    }
    return total;
};

const units = (value: unknown) =>
    typeof value === "number" ? formatNumber(value) : null;

/**
 * A quarter: its three months while it is open, its total always (the column a closed quarter
 * keeps). A month shows only expanded (`groupShow`).
 */
function quarter(
    year: number,
    index: number,
): ColumnOrGroup<Person, DataGridNode> {
    const first = index * 3;
    const months: Column<Person, DataGridNode>[] = [0, 1, 2].map((offset) => ({
        key: `${year}-${first + offset + 1}`,
        name: MONTHS[first + offset],
        width: 76,
        groupShow: "expanded",
        getValue: (row) => sales(row, year, first + offset),
        renderCell: ({ value }) => units(value),
        meta: { numeric: true },
    }));
    return {
        key: `${year}-q${index + 1}`,
        name: `Q${index + 1}`,
        collapsible: true,
        groupShow: "expanded",
        children: [
            ...months,
            {
                key: `${year}-q${index + 1}-total`,
                name: "Total",
                width: 88,
                getValue: (row) => sum(row, year, first, first + 3),
                renderCell: ({ value }) => units(value),
                meta: { numeric: true, total: true },
            },
        ],
    };
}

/** A year: its quarters while it is open, its total while it is closed. */
function year(value: number): ColumnOrGroup<Person, DataGridNode> {
    return {
        key: String(value),
        name: String(value),
        collapsible: true,
        children: [
            ...[0, 1, 2, 3].map((index) => quarter(value, index)),
            {
                key: `${value}-total`,
                name: "Total",
                width: 96,
                groupShow: "collapsed",
                getValue: (row) => sum(row, value, 0, 12),
                renderCell: ({ value: total }) => units(total),
                meta: { numeric: true, total: true },
            },
        ],
    };
}

// the rep pinned at the start, then each year under its quarters and months: three header rows
const columns: ColumnOrGroup<Person, DataGridNode>[] = [
    { key: "name", name: "Rep", width: 180, pinned: "start" },
    ...YEARS.map(year),
];

/** Every collapsible group's key: what "Collapse all" collapses. */
const ALL_GROUPS = YEARS.flatMap((value) => [
    String(value),
    ...[1, 2, 3, 4].map((index) => `${value}-q${index}`),
]);

@Component({
    selector: "example-collapsible-groups",
    imports: [DATA_GRID, ClickableButton, GroupHeader],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <span>Open a year or a quarter from its header</span>
                <button
                    kitClickable
                    size="sm"
                    variant="outline"
                    [class]="styles.toolbarStart"
                    (click)="setCollapsed([])"
                >
                    Expand all
                </button>
                <button
                    kitClickable
                    size="sm"
                    variant="outline"
                    (click)="setCollapsed(ALL_GROUPS)"
                >
                    Collapse all
                </button>
            </div>
            <div
                dataGridRoot
                [columns]="columns"
                [rows]="rows"
                [rowKey]="rowKey"
                [rowHeight]="34"
                [defaultCollapsedGroupKeys]="COLLAPSED"
                [gridRef]="gridRef"
                [class]="styles.root"
            >
                <div dataGridGrid aria-label="Sales" [class]="styles.grid">
                    <div *dataGridHeader [class]="styles.header">
                        <ng-template [dataGridHeaderRows]="columns" let-row>
                            <div [dataGridHeaderRow]="row" [class]="styles.headerRow(row)">
                                <ng-template [dataGridHeaderCells]="columns" let-cell>
                                    <!-- its look by its state -->
                                    <div
                                        [dataGridHeaderCell]="cell"
                                        #headerCell="dataGridHeaderCell"
                                        [class]="styles.headerCell(headerCell.state())"
                                    >
                                        @if (cell.group) {
                                            <span
                                                [dataGridGroupLabel]="cell"
                                                exampleGroupHeader
                                                [class]="styles.label"
                                            ></span>
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
                                        [class]="cell.column.meta?.total ? styles.total : cell.column.meta?.numeric ? styles.numeric : styles.cell"
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
export default class CollapsibleGroups {
    protected readonly styles = styles;
    protected readonly ALL_GROUPS = ALL_GROUPS;

    readonly rows = rows;

    readonly columns = columns;

    // 2025 starts closed, its total showing; 2026 open, its first quarter closed
    readonly COLLAPSED = ["2025", "2026-q1"];

    readonly gridRef = createDataGridRef<Person>();

    protected setCollapsed(groupKeys: readonly string[]) {
        this.gridRef.current?.model.run("column-groups.set", { groupKeys });
    }

    readonly rowKey = (row: Person) => row.id;
}
