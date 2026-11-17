import {
    ChangeDetectionStrategy,
    Component,
    computed,
    signal,
} from "@angular/core";
import {
    type CellPosition,
    type Column,
    DATA_GRID,
    type DataGridNode,
} from "@fragiola/data-grid-angular";
import {
    DataGridNavigation,
    navigation,
} from "@fragiola/data-grid-angular/navigation";
import { ClickableButton } from "#/components/atoms/clickable";
import { formatMoney, formatNumber, type Person, people } from "../_kit/data";
import * as styles from "./styles";

const rows = people(5_000);

const columns: Column<Person, DataGridNode>[] = [
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

const KEYS = [
    "←↑→↓",
    "Home",
    "End",
    "Ctrl+Home",
    "Ctrl+End",
    "PageUp",
    "PageDown",
];

@Component({
    selector: "example-keyboard-navigation",
    imports: [DATA_GRID, ClickableButton, DataGridNavigation],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.panel">
                <p data-testid="active">
                    @if (active() && column()) {
                        Active:
                        <span [class]="styles.figure">{{ where() }}</span>, {{ column()?.name }}
                    } @else {
                        No active cell
                    }
                </p>
                <span [class]="styles.keys">
                    @for (key of keys; track key) {
                        <kbd [class]="styles.key">{{ key }}</kbd>
                    }
                </span>
                <span [class]="styles.actions">
                    <button kitClickable size="sm" variant="outline" (click)="first()">
                        First row
                    </button>
                    <button kitClickable size="sm" variant="outline" (click)="last()">
                        Last row
                    </button>
                </span>
            </div>
            <div
                dataGridRoot
                [features]="features"
                [columns]="columns"
                [rows]="rows"
                [rowKey]="rowKey"
                [rowHeight]="36"
                dataGridNavigation
                [(activePosition)]="active"
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
export default class KeyboardNavigation {
    // cell navigation is a feature the grid installs: the keys, the active cell and the tab stop
    readonly features = [navigation()];
    protected readonly styles = styles;
    protected readonly keys = KEYS;

    readonly rows = rows;
    readonly columns = columns;
    readonly rowKey = (row: Person) => row.id;

    // controlled: the grid asks (activePositionChange), the app decides
    readonly active = signal<CellPosition | null>({
        rowIndex: 0,
        columnIndex: 1,
    });
    protected readonly column = computed(() => {
        const active = this.active();
        return active ? columns[active.columnIndex] : undefined;
    });
    protected readonly where = computed(() => {
        const rowIndex = this.active()?.rowIndex ?? 0;
        return rowIndex < 0 ? "header" : `row ${formatNumber(rowIndex + 1)}`;
    });

    first() {
        this.active.set({ rowIndex: 0, columnIndex: 0 });
    }

    last() {
        this.active.set({
            rowIndex: rows.length - 1,
            columnIndex: columns.length - 1,
        });
    }
}
