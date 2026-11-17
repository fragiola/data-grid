import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    inject,
} from "@angular/core";
import {
    type AxisWindow,
    type Column,
    createDataGridRef,
    DATA_GRID,
    type DataGridNode,
} from "@fragiola/data-grid-angular";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import { formatMoney, type Person, person } from "../_kit/data";
import { createFakeApi } from "../_kit/fake-api";
import { createRangeCache } from "../_kit/range-cache";
import { RequestLog } from "./request-log";
import * as styles from "./styles";

const TOTAL = 1_000_000;
const BLOCK = 100;

const columns: Column<Person, DataGridNode>[] = [
    { key: "id", name: "#", width: 96 },
    { key: "name", name: "Name", width: 180 },
    { key: "email", name: "Email", width: 280 },
    { key: "city", name: "City", width: 140 },
    {
        key: "salary",
        name: "Salary",
        width: 120,
        renderCell: ({ row }) => formatMoney(row.salary),
    },
];

@Component({
    selector: "example-windowed-loading",
    imports: [DATA_GRID, RequestLog],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.layout">
                <div
                    dataGridRoot
                    [features]="features"
                    [columns]="columns"
                    [rowCount]="total"
                    [getRow]="cache.get"
                    [gridRef]="gridRef"
                    [rowKey]="rowKey"
                    [rowHeight]="36"
                    (rowWindowChange)="loadRendered($event)"
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
                                            <!-- a loaded cell keeps its default content -->
                                            @if (cell.loaded) {
                                                <ng-container *dataGridCellContent />
                                            } @else {
                                                <span [class]="styles.skeleton"></span>
                                            }
                                        </div>
                                    </ng-template>
                                </div>
                            </ng-template>
                        </div>
                    </div>
                </div>
                <example-request-log [api]="api" [block]="block" [total]="total" />
            </div>
        </div>
    `,
})
export default class WindowedLoading {
    // cell navigation is a feature the grid installs: the keys, the active cell and the tab stop
    readonly features = [navigation()];
    protected readonly styles = styles;

    readonly columns = columns;
    readonly total = TOTAL;
    readonly block = BLOCK;
    readonly rowKey = (row: Person) => row.id;

    readonly api = createFakeApi(500);
    // blocks of 100 rows, each requested once: the app's cache, not the grid's
    readonly cache = createRangeCache(TOTAL, BLOCK, (start, end) =>
        this.api.fetchRows(start, end, person),
    );
    readonly gridRef = createDataGridRef<Person>();

    // load what is rendered once the scroll settles: a thumb dragged across the dataset asks
    // only for where it stops, never for the rows it passed
    private timer: ReturnType<typeof setTimeout> | undefined;

    constructor() {
        // rows that arrive replace their placeholders: the grid is told which, and renders them
        // only if they are on screen. The getter stays the same
        const unsubscribe = this.cache.subscribe((range) =>
            this.gridRef.current?.model.run("rows.changed", range),
        );
        // a request still waiting when the example goes away is not sent
        inject(DestroyRef).onDestroy(() => {
            unsubscribe();
            clearTimeout(this.timer);
        });
    }

    protected loadRendered({ rendered }: AxisWindow): void {
        clearTimeout(this.timer);
        this.timer = setTimeout(
            () => this.cache.ensure(rendered.start, rendered.end),
            80,
        );
    }
}
