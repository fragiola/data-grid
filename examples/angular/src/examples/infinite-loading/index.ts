import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import {
    type Column,
    DATA_GRID,
    type DataGridNode,
} from "@fragiola/data-grid-angular";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import { formatMoney, formatNumber, type Person, person } from "../_kit/data";
import { createFakeApi } from "../_kit/fake-api";
import * as styles from "./styles";

const TOTAL = 1_000;
const PAGE = 50;

@Component({
    selector: "example-infinite-loading",
    imports: [DATA_GRID],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <!-- the grid tells when the view's last row is within 15 rows of the end -->
            <div
                dataGridRoot
                [features]="features"
                [columns]="columns"
                [rows]="rows()"
                [rowKey]="rowKey"
                [rowHeight]="36"
                (rowsEndReached)="loadMore()"
                [endReachedThreshold]="15"
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
            <p [class]="styles.status" role="status" data-testid="status">
                @if (loading()) {
                    <span [class]="styles.spinner" aria-hidden="true"></span>
                }
                <span>
                    Loaded
                    <span [class]="styles.figure" data-testid="loaded">{{ formatNumber(rows().length) }}</span>
                    of {{ formatNumber(TOTAL) }} rows{{ loading() ? " · loading the next page…" : "" }}
                </span>
            </p>
        </div>
    `,
})
export default class InfiniteLoading {
    // cell navigation is a feature the grid installs: the keys, the active cell and the tab stop
    readonly features = [navigation()];
    protected readonly styles = styles;
    protected readonly formatNumber = formatNumber;
    protected readonly TOTAL = TOTAL;

    readonly columns: Column<Person, DataGridNode>[] = [
        { key: "id", name: "#", width: 72 },
        { key: "name", name: "Name", width: 180 },
        { key: "email", name: "Email", width: 260 },
        { key: "city", name: "City", width: 140 },
        {
            key: "salary",
            name: "Salary",
            width: 120,
            renderCell: ({ row }) => formatMoney(row.salary),
        },
    ];

    private readonly api = createFakeApi(600);
    protected readonly rows = signal<Person[]>([]);
    protected readonly loading = signal(false);
    // what is in flight and what comes next: plain state, read by the method the grid calls
    private readonly next = { page: 0, busy: false, done: false };

    constructor() {
        // the first page
        this.loadMore();
    }

    loadMore(): void {
        const next = this.next;
        if (next.busy || next.done) return;
        next.busy = true;
        this.loading.set(true);
        this.api.fetchPage(next.page, PAGE, TOTAL, person).then((page) => {
            next.page += 1;
            next.busy = false;
            next.done = page.length < PAGE || next.page * PAGE >= TOTAL;
            this.rows.update((current) => [...current, ...page]);
            this.loading.set(false);
        });
    }

    readonly rowKey = (row: Person) => row.id;
}
