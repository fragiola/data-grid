import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    inject,
    signal,
    type TemplateRef,
    ViewChild,
} from "@angular/core";
import {
    type CellTemplateProps,
    type Column,
    contextOf,
    createDataGridRef,
    DATA_GRID,
    type DataGridNode,
    injectColumnWindow,
    injectRowWindow,
    type TemplateContext,
    templateContent,
} from "@fragiola/data-grid-angular";
import { columnPinning } from "@fragiola/data-grid-angular/column-pinning";
import {
    columnResize,
    DataGridColumnResizer,
} from "@fragiola/data-grid-angular/column-resize";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import {
    DataGridSorting,
    type SortColumn,
    sorting,
} from "@fragiola/data-grid-angular/sorting";
import {
    SUMMARY_ROWS,
    summaryRows,
} from "@fragiola/data-grid-angular/summary-rows";
import {
    LucideArrowDown,
    LucideArrowUp,
    LucidePause,
    LucidePlay,
} from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { SELECT_PARTS } from "#/components/ui/select";
import { formatNumber } from "../_kit/data";
import {
    changeOf,
    changeRatioOf,
    createMarketFeed,
    formatAmount,
    formatCompact,
    formatPercent,
    formatPrice,
    type Instrument,
    positionValueOf,
    profitOf,
    type Totals,
    totalsOf,
} from "../_kit/market";
import {
    Delta,
    DeltaPill,
    PriceCell,
    TickerCell,
    Timeline,
    VolumeCell,
} from "./cells";
import { Readout } from "./readout";
import * as styles from "./styles";

// the features the grid installs: sorting (the header's clicks; the app orders the rows), cell
// navigation (the keys, the active cell, the tab stop), the ticker pinned at the start, column
// resizing (the handles) and a summary row at the bottom edge
const FEATURES = [
    sorting(),
    navigation(),
    columnPinning(),
    columnResize(),
    summaryRows(),
];

const INSTRUMENTS = 1000;

/** The feed's rates, in price changes a second. */
const RATES: Record<string, string> = {
    "100": "100 / s",
    "1000": "1,000 / s",
    "2000": "2,000 / s",
    "10000": "10,000 / s",
};

const RATE_ITEMS = Object.entries(RATES).map(([value, label]) => ({
    value,
    label,
}));

/** The columns whose figures line up on the right. */
const NUMERIC = new Set([
    "price",
    "change",
    "profit",
    "value",
    "volume",
    "bid",
    "ask",
    "quantity",
]);

/** How each sortable column orders two instruments. */
const ORDERS: Record<string, (a: Instrument, b: Instrument) => number> = {
    ticker: (a, b) => a.ticker.localeCompare(b.ticker),
    type: (a, b) => a.type.localeCompare(b.type),
    price: (a, b) => a.price - b.price,
    change: (a, b) => changeRatioOf(a) - changeRatioOf(b),
    profit: (a, b) => profitOf(a) - profitOf(b),
    value: (a, b) => positionValueOf(a) - positionValueOf(b),
    volume: (a, b) => a.volume - b.volume,
};

/** The order the rows show the market in: an index into it for each row. */
function orderOf(
    market: readonly Instrument[],
    sortColumns: readonly SortColumn[],
): number[] {
    const order = market.map((_, index) => index);
    const [sort] = sortColumns;
    const compare = sort && ORDERS[sort.columnKey];
    if (!sort || !compare) return order;
    const sign = sort.direction === "ascending" ? 1 : -1;
    return order.sort((a, b) => {
        const x = market[a];
        const y = market[b];
        return x && y ? sign * compare(x, y) : 0;
    });
}

type InstrumentCell = TemplateRef<
    TemplateContext<CellTemplateProps<Instrument>>
>;
/** a summary cell's context: the portfolio's totals when it rendered */
interface TotalsContext {
    readonly totals: Totals;
}
type TotalsCell = TemplateRef<TemplateContext<TotalsContext>>;

@Component({
    selector: "example-live-market",
    imports: [
        DATA_GRID,
        SUMMARY_ROWS,
        DataGridSorting,
        DataGridColumnResizer,
        ClickableButton,
        SELECT_PARTS,
        LucideArrowDown,
        LucideArrowUp,
        LucidePause,
        LucidePlay,
        Delta,
        DeltaPill,
        PriceCell,
        TickerCell,
        Timeline,
        VolumeCell,
        Readout,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <button kitClickable size="sm" variant="outline" (click)="playing.set(!playing())">
                    @if (playing()) {
                        <svg lucidePause aria-hidden="true"></svg>
                        Pause
                    } @else {
                        <svg lucidePlay aria-hidden="true"></svg>
                        Play
                    }
                </button>
                <button
                    [kitSelectTrigger]="rateList"
                    [items]="RATES"
                    [value]="rate()"
                    (valueChange)="setRate($event)"
                    aria-label="Price changes a second"
                    [class]="styles.rateSelect"
                >
                    <span [class]="styles.rateLabel">Rate</span>
                    <span kitSelectValue></span>
                </button>
                <ng-template #rateList>
                    <div kitSelectContent>
                        @for (item of RATE_ITEMS; track item.value) {
                            <div [kitSelectItem]="item.value">{{ item.label }}</div>
                        }
                    </div>
                </ng-template>
                <p
                    exampleReadout
                    [feed]="feed"
                    [instruments]="INSTRUMENTS"
                    [rowWindow]="rowWindow"
                    [columnWindow]="columnWindow"
                ></p>
            </div>
            <div
                dataGridRoot
                [features]="features"
                [columns]="columns"
                [rowCount]="order().length"
                [getRow]="getRow()"
                [gridRef]="gridRef"
                [rowKey]="rowKey"
                [rowHeight]="40"
                [headerRowHeight]="40"
                dataGridSummaryRows
                [summaryRows]="summaryRows"
                [summaryRowHeight]="40"
                dataGridSorting
                [sortColumns]="sortColumns()"
                (sortColumnsChange)="sortColumns.set($event)"
                [class]="styles.root"
            >
                <ng-template #tickerCell [dataGridTemplate]="cellContext" let-row="row">
                    <span exampleTickerCell [instrument]="row"></span>
                </ng-template>
                <ng-template #tickerSummary [dataGridTemplate]="totalsContext">
                    <span [class]="styles.summaryLabel">
                        Portfolio · {{ formatNumber(INSTRUMENTS) }} instruments
                    </span>
                </ng-template>
                <ng-template #timelineCell [dataGridTemplate]="cellContext" let-row="row">
                    <svg exampleTimeline [history]="row.history"></svg>
                </ng-template>
                <ng-template #typeCell [dataGridTemplate]="cellContext" let-row="row">
                    <span [class]="styles.typeBadge(row.type)">{{ row.type }}</span>
                </ng-template>
                <ng-template #priceCell [dataGridTemplate]="cellContext" let-row="row">
                    <span examplePriceCell [instrument]="row"></span>
                </ng-template>
                <ng-template #changeCell [dataGridTemplate]="cellContext" let-row="row">
                    <span [exampleDelta]="changeOf(row)">{{ formatPercent(changeRatioOf(row)) }}</span>
                </ng-template>
                <ng-template #changeSummary [dataGridTemplate]="totalsContext" let-totals="totals">
                    <span>
                        <span [exampleDelta]="1">{{ totals.gainers }}</span>&ngsp;<span [exampleDelta]="-1">{{ totals.losers }}</span>
                    </span>
                </ng-template>
                <ng-template #profitCell [dataGridTemplate]="cellContext" let-row="row">
                    <span
                        exampleDeltaPill
                        [delta]="profitOf(row)"
                        [value]="formatPercent(profitOf(row) / (row.cost * row.quantity))"
                        [tone]="profitOf(row) >= 0 ? 0 : 1"
                    ></span>
                </ng-template>
                <ng-template #profitSummary [dataGridTemplate]="totalsContext" let-totals="totals">
                    <span [exampleDelta]="totals.profit">{{ formatAmount(totals.profit) }}</span>
                </ng-template>
                <ng-template #valueCell [dataGridTemplate]="cellContext" let-row="row">
                    <span
                        exampleDeltaPill
                        [delta]="changeOf(row) * row.quantity"
                        [value]="formatAmount(positionValueOf(row))"
                        [tone]="2"
                    ></span>
                </ng-template>
                <ng-template #volumeCell [dataGridTemplate]="cellContext" let-row="row">
                    <span exampleVolumeCell [volume]="row.volume" [label]="formatCompact(row.volume)"></span>
                </ng-template>
                <div dataGridGrid aria-label="Portfolio" [class]="styles.grid">
                    <div *dataGridHeader [class]="styles.header">
                        <div dataGridHeaderRow [class]="styles.headerRow">
                            <ng-template [dataGridHeaderCells]="columns" let-cell>
                                <div
                                    [dataGridHeaderCell]="cell"
                                    #header="dataGridHeaderCell"
                                    [class]="styles.headerCell(NUMERIC.has(cell.key))"
                                >
                                    <ng-container *dataGridCellContent />
                                    <!-- a sorted column's direction (the grid sorts; the arrow is the app's) -->
                                    @switch (header.state()?.sortDirection) {
                                        @case ("ascending") {
                                            <svg lucideArrowUp aria-hidden="true" [class]="styles.sortIcon"></svg>
                                        }
                                        @case ("descending") {
                                            <svg lucideArrowDown aria-hidden="true" [class]="styles.sortIcon"></svg>
                                        }
                                    }
                                    <!--
                                        its resize handle (the grid's separator: drag, keys, double-click to
                                        fit). Its props make it a separator, a focusable one (the APG's
                                        splitter), which an <hr> cannot be
                                    -->
                                    <div
                                        *dataGridColumnResizer="cell"
                                        [attr.aria-label]="'Resize ' + (cell.column?.name ?? cell.key)"
                                        [class]="styles.resizer"
                                    ></div>
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
                                        [class]="styles.cell(cell, NUMERIC.has(cell.column.key))"
                                    >
                                        <ng-container *dataGridCellContent />
                                    </div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                    <!-- after the body: it stays at the view's bottom edge -->
                    <div *dataGridSummary="'bottom'" [class]="styles.summary">
                        <ng-template dataGridSummaryRows let-row>
                            <div [dataGridSummaryRow]="row" [class]="styles.summaryRow">
                                <ng-template [dataGridSummaryCells]="columns" let-cell>
                                    <div
                                        [dataGridSummaryCell]="cell"
                                        [class]="styles.summaryCell(NUMERIC.has(cell.column.key))"
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
export default class LiveMarket {
    protected readonly styles = styles;
    protected readonly RATES = RATES;
    protected readonly RATE_ITEMS = RATE_ITEMS;
    protected readonly NUMERIC = NUMERIC;
    protected readonly INSTRUMENTS = INSTRUMENTS;
    protected readonly formatNumber = formatNumber;
    protected readonly formatPercent = formatPercent;
    protected readonly formatAmount = formatAmount;
    protected readonly formatCompact = formatCompact;
    protected readonly changeOf = changeOf;
    protected readonly changeRatioOf = changeRatioOf;
    protected readonly profitOf = profitOf;
    protected readonly positionValueOf = positionValueOf;
    protected readonly cellContext = contextOf<CellTemplateProps<Instrument>>();
    protected readonly totalsContext = contextOf<TotalsContext>();

    @ViewChild("tickerCell", { static: true })
    private readonly tickerCell!: InstrumentCell;
    @ViewChild("tickerSummary", { static: true })
    private readonly tickerSummary!: TotalsCell;
    @ViewChild("timelineCell", { static: true })
    private readonly timelineCell!: InstrumentCell;
    @ViewChild("typeCell", { static: true })
    private readonly typeCell!: InstrumentCell;
    @ViewChild("priceCell", { static: true })
    private readonly priceCell!: InstrumentCell;
    @ViewChild("changeCell", { static: true })
    private readonly changeCell!: InstrumentCell;
    @ViewChild("changeSummary", { static: true })
    private readonly changeSummary!: TotalsCell;
    @ViewChild("profitCell", { static: true })
    private readonly profitCell!: InstrumentCell;
    @ViewChild("profitSummary", { static: true })
    private readonly profitSummary!: TotalsCell;
    @ViewChild("valueCell", { static: true })
    private readonly valueCell!: InstrumentCell;
    @ViewChild("volumeCell", { static: true })
    private readonly volumeCell!: InstrumentCell;

    readonly features = FEATURES;
    readonly summaryRows = { bottom: 1 };
    readonly rowKey = (row: Instrument) => row.id;

    // the market and its feed: app state, outside the grid. Every frame the feed moves some
    // instruments (new objects) and says which; the grid is told those rows changed
    protected readonly feed = createMarketFeed({
        count: INSTRUMENTS,
        rate: 2000,
    });
    protected readonly playing = signal(true);
    protected readonly rate = signal(String(this.feed.rate));
    readonly gridRef = createDataGridRef<Instrument, typeof FEATURES>();
    // the readout follows the grid's windows through the ref: it re-renders, the grid does not
    protected readonly rowWindow = injectRowWindow(this.gridRef);
    protected readonly columnWindow = injectColumnWindow(this.gridRef);
    // the totals the summary cells read, worked out again with every batch
    private readonly totals = { current: totalsOf(this.feed.market) };

    // the grid sorts by a click on a header; the app orders the rows (by index into the market),
    // again every second while it plays, so a sorted column stays sorted as prices move
    readonly sortColumns = signal<readonly SortColumn[]>([]);
    protected readonly order = signal(orderOf(this.feed.market, []));
    // where each instrument shows (the inverse of the order): a batch's rows by its instruments
    private readonly rowOf = computed(() => {
        const order = this.order();
        const rows = new Int32Array(order.length);
        order.forEach((instrument, row) => {
            rows[instrument] = row;
        });
        return rows;
    });
    // a new order is a new getter: the grid takes it as a new source
    protected readonly getRow = computed(() => {
        const order = this.order();
        const market = this.feed.market;
        return (index: number) => {
            const instrument = order[index];
            return instrument === undefined ? undefined : market[instrument];
        };
    });

    // The columns: their cells read the instrument; the summary cells read the portfolio's totals.
    readonly columns: Column<Instrument, DataGridNode>[] = [
        {
            key: "ticker",
            name: "Ticker",
            width: 280,
            pinned: "start",
            sortable: true,
            resizable: true,
            renderCell: (props) => templateContent(this.tickerCell, props),
            renderSummaryCell: () => this.totalsCell(this.tickerSummary),
        },
        {
            key: "timeline",
            name: "Timeline",
            width: 130,
            resizable: true,
            renderCell: (props) => templateContent(this.timelineCell, props),
        },
        {
            key: "type",
            name: "Instrument",
            width: 120,
            sortable: true,
            resizable: true,
            renderCell: (props) => templateContent(this.typeCell, props),
        },
        {
            key: "price",
            name: "Price",
            width: 120,
            sortable: true,
            resizable: true,
            renderCell: (props) => templateContent(this.priceCell, props),
        },
        {
            key: "change",
            name: "Change",
            width: 120,
            sortable: true,
            resizable: true,
            renderCell: (props) => templateContent(this.changeCell, props),
            renderSummaryCell: () => this.totalsCell(this.changeSummary),
        },
        {
            key: "profit",
            name: "P&L",
            width: 200,
            sortable: true,
            resizable: true,
            renderCell: (props) => templateContent(this.profitCell, props),
            renderSummaryCell: () => this.totalsCell(this.profitSummary),
        },
        {
            key: "value",
            name: "Total value",
            width: 210,
            sortable: true,
            resizable: true,
            renderCell: (props) => templateContent(this.valueCell, props),
            renderSummaryCell: () => formatAmount(this.totals.current.value),
        },
        {
            key: "volume",
            name: "Volume",
            width: 150,
            sortable: true,
            resizable: true,
            renderCell: (props) => templateContent(this.volumeCell, props),
            renderSummaryCell: () => formatCompact(this.totals.current.volume),
        },
        {
            key: "bid",
            name: "Bid",
            width: 110,
            resizable: true,
            renderCell: ({ row }) => formatPrice(row.bid),
        },
        {
            key: "ask",
            name: "Ask",
            width: 110,
            resizable: true,
            renderCell: ({ row }) => formatPrice(row.ask),
        },
        {
            key: "quantity",
            name: "Quantity",
            width: 110,
            resizable: true,
            renderCell: ({ row }) => formatNumber(row.quantity),
        },
        { key: "sector", name: "Sector", width: 140, resizable: true },
    ];

    constructor() {
        // the order again with each sort, and every second while it plays
        effect((onCleanup) => {
            const sortColumns = this.sortColumns();
            this.order.set(orderOf(this.feed.market, sortColumns));
            if (sortColumns.length === 0 || !this.playing()) return;
            const timer = setInterval(
                () => this.order.set(orderOf(this.feed.market, sortColumns)),
                1000,
            );
            onCleanup(() => clearInterval(timer));
        });
        // each batch: the rows from the first moved to the last moved changed (the grid renders
        // the ones on screen), and the summary's figures
        const unsubscribe = this.feed.subscribe((moved) => {
            const grid = this.gridRef.current;
            if (!grid) return;
            const rowOf = this.rowOf();
            let start = Number.POSITIVE_INFINITY;
            let end = -1;
            for (const instrument of moved) {
                const row = rowOf[instrument] ?? 0;
                if (row < start) start = row;
                if (row > end) end = row;
            }
            grid.model.run("rows.changed", { start, end: end + 1 });
            this.totals.current = totalsOf(this.feed.market);
            grid.model.run("summary-rows.changed", {});
        });
        effect(() => {
            if (this.playing()) this.feed.play();
            else this.feed.pause();
        });
        inject(DestroyRef).onDestroy(() => {
            unsubscribe();
            this.feed.dispose();
        });
    }

    protected setRate(value: unknown) {
        const next = Number(value);
        this.feed.setRate(next);
        this.rate.set(String(next));
    }

    /** a summary cell's template, given the totals as they are now */
    private totalsCell(template: TotalsCell) {
        return templateContent(template, { totals: this.totals.current });
    }
}
