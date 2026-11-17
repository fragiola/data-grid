import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import {
    type ColumnOrder,
    type ColumnOrGroup,
    createDataGridRef,
    DATA_GRID,
    type DataGridNode,
} from "@fragiola/data-grid-angular";
import { columnPinning } from "@fragiola/data-grid-angular/column-pinning";
import {
    columnReorder,
    DataGridColumnReorder,
} from "@fragiola/data-grid-angular/column-reorder";
import { columnResize } from "@fragiola/data-grid-angular/column-resize";
import {
    DataGridLocalRows,
    injectLocalRows,
} from "@fragiola/data-grid-angular/local";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import { sorting } from "@fragiola/data-grid-angular/sorting";
import { LucideRotateCcw } from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { formatMoney, type Person, people } from "../_kit/data";
import { ReorderHeader } from "./header-cell";
import { injectMoveAnnouncements } from "./inject-move-announcements";
import * as styles from "./styles";

const all = people(1_000);

// "#" stays where it is declared: it is not reorderable (its siblings may still land beside it).
// Name and Team are pinned: they trade places with each other, never with the columns that
// scroll. A group moves whole, and its columns move inside it. Each column resizes too.
const columns: ColumnOrGroup<Person, DataGridNode>[] = [
    {
        key: "id",
        name: "#",
        width: 64,
        pinned: "start",
        meta: { numeric: true },
    },
    {
        key: "name",
        name: "Name",
        width: 180,
        pinned: "start",
        reorderable: true,
        sortable: true,
        resizable: true,
    },
    {
        key: "team",
        name: "Team",
        width: 130,
        pinned: "start",
        reorderable: true,
        sortable: true,
        resizable: true,
    },
    {
        key: "contact",
        name: "Contact",
        reorderable: true,
        children: [
            {
                key: "email",
                name: "Email",
                width: 260,
                reorderable: true,
                resizable: true,
            },
            {
                key: "city",
                name: "City",
                width: 140,
                reorderable: true,
                sortable: true,
                resizable: true,
            },
        ],
    },
    {
        key: "employment",
        name: "Employment",
        reorderable: true,
        children: [
            {
                key: "joined",
                name: "Joined",
                width: 120,
                reorderable: true,
                sortable: true,
                resizable: true,
            },
            {
                key: "salary",
                name: "Salary",
                width: 130,
                reorderable: true,
                sortable: true,
                resizable: true,
                renderCell: ({ row }) => formatMoney(row.salary),
                meta: { numeric: true },
            },
        ],
    },
];

// Each header cell draws its grip, label, sort arrow and resize handle (`header-cell.ts`).

@Component({
    selector: "example-column-reordering",
    imports: [
        DATA_GRID,
        DataGridColumnReorder,
        DataGridLocalRows,
        ClickableButton,
        LucideRotateCcw,
        ReorderHeader,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <span>
                    Drag a header, or <kbd [class]="styles.key">Ctrl/⌘</kbd
                    ><kbd [class]="styles.key">Shift</kbd
                    ><kbd [class]="styles.key">←</kbd
                    ><kbd [class]="styles.key">→</kbd> on one
                </span>
                <span>
                    <kbd [class]="styles.key">Esc</kbd> while dragging cancels
                </span>
                <!-- the app's live region: a polite status, its text the app's own -->
                <span role="status" [class]="styles.status">{{ announcement() }}</span>
                <button
                    kitClickable
                    size="sm"
                    variant="outline"
                    [disabled]="order().length === 0"
                    (click)="reset()"
                >
                    <svg lucideRotateCcw aria-hidden="true"></svg>
                    Reset order
                </button>
            </div>
            <div
                dataGridRoot
                dataGridColumnReorder
                [features]="features"
                [dataGridLocalRows]="local"
                [columns]="columns"
                [rowKey]="rowKey"
                [rowHeight]="36"
                [columnOrder]="order()"
                (columnOrderChange)="setOrder($event)"
                [gridRef]="gridRef"
                [class]="styles.root"
            >
                <div dataGridGrid aria-label="People" [class]="styles.grid">
                    <div *dataGridHeader [class]="styles.header">
                        <ng-template [dataGridHeaderRows]="columns" let-row>
                            <div [dataGridHeaderRow]="row" [class]="styles.headerRow(row)">
                                <ng-template [dataGridHeaderCells]="columns" let-cell>
                                    <div
                                        [dataGridHeaderCell]="cell"
                                        exampleReorderHeader
                                        [class]="styles.headerCell(cell)"
                                    ></div>
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
export default class ColumnReordering {
    protected readonly styles = styles;

    readonly columns = columns;
    readonly rowKey = (row: Person) => row.id;

    // the grid moves the columns; the app keeps the order (to reset it, to save it) and says
    // what moved in its own words
    readonly order = signal<ColumnOrder>([]);
    readonly announcement = signal("");
    readonly gridRef = createDataGridRef<Person>();
    // a move the person asked for: told once the grid shows it
    private readonly moving = { current: false };
    // a click on a sortable header still sorts: the rows in memory, ordered by the app the features
    // the grid installs: sorting (the local rows' sort needs it, or no column sorts), cell
    // navigation (the keys, the active cell, the tab stop), column resizing (its handles, keys and
    // fits), column reordering (a header cell's drag and keys), pinned columns (without it, every
    // column scrolls)
    readonly features = [
        sorting(),
        navigation(),
        columnResize(),
        columnReorder(),
        columnPinning(),
    ];
    readonly local = injectLocalRows(all, columns);

    constructor() {
        injectMoveAnnouncements(this.gridRef, this.moving, (message) =>
            this.announcement.set(message),
        );
    }

    protected setOrder(next: ColumnOrder): void {
        this.moving.current = true;
        this.order.set(next);
    }

    protected reset(): void {
        // the columns go back to the order they are declared in
        this.order.set([]);
        this.announcement.set("Columns back in their declared order.");
    }
}
