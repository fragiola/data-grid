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
import { formatNumber, measurement } from "../_kit/data";
import { createFakeApi } from "../_kit/fake-api";
import { RequestLog } from "./request-log";
import * as styles from "./styles";
import { createTileCache, type TileCache } from "./tiles";

const ROWS = 100_000;
const COLUMNS = 2_000;
const TILE = { rows: 50, columns: 20 };

/** Every row exists from the start; its cells come with the tiles. */
interface Row {
    index: number;
}

/** Every row exists from the start: the same getter for the grid's whole life. */
const getRow = (index: number): Row => ({ index });

const EMPTY: AxisWindow = {
    visible: { start: 0, end: 0 },
    rendered: { start: 0, end: 0 },
};

function columnsFor(tiles: TileCache): Column<Row, DataGridNode>[] {
    return Array.from(
        { length: COLUMNS },
        (_, i): Column<Row, DataGridNode> => ({
            key: `c${i}`,
            name: `C${formatNumber(i + 1)}`,
            width: 104,
            getValue: (row) => tiles.get(row.index, i),
        }),
    );
}

@Component({
    selector: "example-windowed-columns",
    imports: [DATA_GRID, RequestLog],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.layout">
                <div
                    dataGridRoot
                    [features]="features"
                    [columns]="columns"
                    [rowCount]="ROWS"
                    [getRow]="getRow"
                    [gridRef]="gridRef"
                    [rowHeight]="32"
                    (rowWindowChange)="rowWindowChanged($event)"
                    (columnWindowChange)="columnWindowChanged($event)"
                    [class]="styles.root"
                >
                    <div dataGridGrid aria-label="Measurements" [class]="styles.grid">
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
                                        <div
                                            [dataGridCell]="cell"
                                            [class]="styles.cell"
                                            [attr.data-tile-loaded]="cell.value === undefined ? null : ''"
                                        >
                                            @if (isNumber(cell.value)) {<ng-container>{{ cell.value.toFixed(2) }}</ng-container>} @else {
                                                <span [class]="styles.skeleton"></span>
                                            }
                                        </div>
                                    </ng-template>
                                </div>
                            </ng-template>
                        </div>
                    </div>
                </div>
                <example-request-log [api]="api" />
            </div>
        </div>
    `,
})
export default class WindowedColumns {
    // cell navigation is a feature the grid installs: the keys, the active cell and the tab stop
    readonly features = [navigation()];
    protected readonly styles = styles;
    protected readonly ROWS = ROWS;

    // one server, one cache and their columns for the example's life
    readonly api = createFakeApi(450);
    readonly tiles = createTileCache(
        this.api,
        TILE,
        { rows: ROWS, columns: COLUMNS },
        measurement,
    );
    readonly columns = columnsFor(this.tiles);
    readonly getRow = getRow;
    readonly gridRef = createDataGridRef<Row>();

    // both windows, kept to ask for the tiles once the scroll settles
    private readonly windows = { rows: EMPTY, columns: EMPTY };
    private timer: ReturnType<typeof setTimeout> | undefined;

    constructor() {
        // a tile that arrives fills cells of its rows: the grid is told which rows, and renders
        // only if they are on screen
        const unsubscribe = this.tiles.subscribe((rows) =>
            this.gridRef.current?.model.run("rows.changed", rows),
        );
        // a request still waiting when the example goes away is not sent
        inject(DestroyRef).onDestroy(() => {
            unsubscribe();
            clearTimeout(this.timer);
        });
    }

    protected isNumber(value: unknown): value is number {
        return typeof value === "number";
    }

    protected rowWindowChanged(rows: AxisWindow): void {
        this.windows.rows = rows;
        this.load();
    }

    protected columnWindowChanged(columns: AxisWindow): void {
        this.windows.columns = columns;
        this.load();
    }

    private load(): void {
        clearTimeout(this.timer);
        this.timer = setTimeout(
            () =>
                this.tiles.ensure(
                    this.windows.rows.rendered,
                    this.windows.columns.rendered,
                ),
            80,
        );
    }
}
