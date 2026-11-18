<script setup lang="ts">
import {
    type Column,
    type HeaderCellInfo,
    headerCellContent,
    typedDataGrid,
    useDataGridRef,
} from "@fragiola/data-grid-vue";
import { columnPinning } from "@fragiola/data-grid-vue/column-pinning";
import { columnResize } from "@fragiola/data-grid-vue/column-resize";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { type SortColumn, sorting } from "@fragiola/data-grid-vue/sorting";
import {
    summaryRows,
    typedSummaryRows,
} from "@fragiola/data-grid-vue/summary-rows";
import { Pause, Play } from "@lucide/vue";
import {
    computed,
    type FunctionalComponent,
    h,
    onBeforeUnmount,
    ref,
    shallowRef,
    type VNodeChild,
    watch,
} from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { Select } from "#/components/ui/select";
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
import Delta from "./delta.vue";
import DeltaPill from "./delta-pill.vue";
import PriceCell from "./price-cell.vue";
import Readout from "./readout.vue";
import Resizer from "./resizer.vue";
import SortIndicator from "./sort-indicator.vue";
import * as styles from "./styles";
import TickerCell from "./ticker-cell.vue";
import Timeline from "./timeline.vue";
import TypeBadge from "./type-badge.vue";
import VolumeCell from "./volume-cell.vue";

// the features the grid installs: sorting (the header's clicks; the app orders the rows), cell
// navigation (the keys, the active cell, the tab stop), the ticker pinned at the start, column
// resizing (the handles) and a summary row at the bottom edge
const features = [
    sorting(),
    navigation(),
    columnPinning(),
    columnResize(),
    summaryRows(),
] as const;

// The parts typed by the row type and the features (the summary's by the row): a template
// cannot pass them as type arguments.
const DataGrid = typedDataGrid<Instrument, typeof features>();
const Summary = typedSummaryRows<Instrument>();

const INSTRUMENTS = 1000;

/** The feed's rates, in price changes a second. */
const RATES: Record<string, string> = {
    "100": "100 / s",
    "1000": "1,000 / s",
    "2000": "2,000 / s",
    "10000": "10,000 / s",
};

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

/** The columns: their cells read the instrument; the summary cells read the portfolio's totals. */
function columnsOf(totals: {
    readonly current: Totals;
}): Column<Instrument, VNodeChild>[] {
    return [
        {
            key: "ticker",
            name: "Ticker",
            width: 280,
            pinned: "start",
            sortable: true,
            resizable: true,
            renderCell: ({ row }) => h(TickerCell, { instrument: row }),
            renderSummaryCell: () =>
                h(
                    "span",
                    { class: styles.summaryLabel },
                    `Portfolio · ${formatNumber(INSTRUMENTS)} instruments`,
                ),
        },
        {
            key: "timeline",
            name: "Timeline",
            width: 130,
            resizable: true,
            renderCell: ({ row }) => h(Timeline, { history: row.history }),
        },
        {
            key: "type",
            name: "Instrument",
            width: 120,
            sortable: true,
            resizable: true,
            renderCell: ({ row }) => h(TypeBadge, { type: row.type }),
        },
        {
            key: "price",
            name: "Price",
            width: 120,
            sortable: true,
            resizable: true,
            renderCell: ({ row }) => h(PriceCell, { instrument: row }),
        },
        {
            key: "change",
            name: "Change",
            width: 120,
            sortable: true,
            resizable: true,
            renderCell: ({ row }) =>
                h(Delta, { value: changeOf(row) }, () =>
                    formatPercent(changeRatioOf(row)),
                ),
            renderSummaryCell: () =>
                h("span", [
                    h(Delta, { value: 1 }, () =>
                        String(totals.current.gainers),
                    ),
                    " ",
                    h(Delta, { value: -1 }, () =>
                        String(totals.current.losers),
                    ),
                ]),
        },
        {
            key: "profit",
            name: "P&L",
            width: 200,
            sortable: true,
            resizable: true,
            renderCell: ({ row }) => {
                const profit = profitOf(row);
                return h(DeltaPill, {
                    delta: profit,
                    value: formatPercent(profit / (row.cost * row.quantity)),
                    tone: profit >= 0 ? 0 : 1,
                });
            },
            renderSummaryCell: () =>
                h(Delta, { value: totals.current.profit }, () =>
                    formatAmount(totals.current.profit),
                ),
        },
        {
            key: "value",
            name: "Total value",
            width: 210,
            sortable: true,
            resizable: true,
            renderCell: ({ row }) =>
                h(DeltaPill, {
                    delta: changeOf(row) * row.quantity,
                    value: formatAmount(positionValueOf(row)),
                    tone: 2,
                }),
            renderSummaryCell: () => formatAmount(totals.current.value),
        },
        {
            key: "volume",
            name: "Volume",
            width: 150,
            sortable: true,
            resizable: true,
            renderCell: ({ row }) =>
                h(VolumeCell, {
                    volume: row.volume,
                    label: formatCompact(row.volume),
                }),
            renderSummaryCell: () => formatCompact(totals.current.volume),
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
}

/** A header cell's own content: its column's `renderHeaderCell`, else its name. */
const HeaderContent: FunctionalComponent<{
    cell: HeaderCellInfo<Instrument>;
}> = (props) => headerCellContent(props.cell);

// the market and its feed: app state, outside the grid (never made reactive). Every frame the
// feed moves some instruments (new objects) and says which; the grid is told those rows changed
const feed = createMarketFeed({ count: INSTRUMENTS, rate: 2000 });
const playing = ref(true);
const rate = ref(feed.rate);
const gridRef = useDataGridRef<Instrument, typeof features>();
// the totals the summary cells read, worked out again with every batch
const totals: { current: Totals } = { current: totalsOf(feed.market) };
const columns = columnsOf(totals);

// the grid sorts by a click on a header; the app orders the rows (by index into the market),
// again every second while it plays, so a sorted column stays sorted as prices move
const sortColumns = shallowRef<readonly SortColumn[]>([]);
const order = shallowRef(orderOf(feed.market, []));
watch(
    [sortColumns, playing],
    ([sort, play], _, onCleanup) => {
        order.value = orderOf(feed.market, sort);
        if (sort.length === 0 || !play) return;
        const timer = setInterval(() => {
            order.value = orderOf(feed.market, sort);
        }, 1000);
        onCleanup(() => clearInterval(timer));
    },
    { immediate: true },
);
// where each instrument shows (the inverse of the order): a batch's rows by its instruments
const rowOf = computed(() => {
    const rows = new Int32Array(order.value.length);
    order.value.forEach((instrument, row) => {
        rows[instrument] = row;
    });
    return rows;
});
// a new order is a new getter: the grid takes it as a new source
const getRow = computed(() => {
    const current = order.value;
    return (index: number) => {
        const instrument = current[index];
        return instrument === undefined ? undefined : feed.market[instrument];
    };
});

// each batch: the rows from the first moved to the last moved changed (the grid renders the
// ones on screen), and the summary's figures
onBeforeUnmount(
    feed.subscribe((moved) => {
        const grid = gridRef.current;
        if (!grid) return;
        const rows = rowOf.value;
        let start = Number.POSITIVE_INFINITY;
        let end = -1;
        for (const instrument of moved) {
            const row = rows[instrument] ?? 0;
            if (row < start) start = row;
            if (row > end) end = row;
        }
        grid.model.run("rows.changed", { start, end: end + 1 });
        totals.current = totalsOf(feed.market);
        grid.model.run("summary-rows.changed", {});
    }),
);
watch(
    playing,
    (play) => {
        if (play) feed.play();
        else feed.pause();
    },
    { immediate: true },
);
onBeforeUnmount(() => feed.pause());

const rowKey = (row: Instrument) => row.id;
const setSortColumns = (next: readonly SortColumn[]) => {
    sortColumns.value = next;
};
const setRate = (value: unknown) => {
    const next = Number(value);
    feed.setRate(next);
    rate.value = next;
};
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <Clickable.Button
                size="sm"
                variant="outline"
                @click="playing = !playing"
            >
                <Pause v-if="playing" aria-hidden="true" />
                <Play v-else aria-hidden="true" />
                {{ playing ? "Pause" : "Play" }}
            </Clickable.Button>
            <Select.Root
                :items="RATES"
                :model-value="String(rate)"
                @update:model-value="setRate"
            >
                <Select.Trigger
                    :class="styles.rateSelect"
                    aria-label="Price changes a second"
                >
                    <span :class="styles.rateLabel">Rate</span>
                    <Select.Value />
                </Select.Trigger>
                <Select.Content>
                    <Select.Item
                        v-for="(label, value) in RATES"
                        :key="value"
                        :value="value"
                    >
                        {{ label }}
                    </Select.Item>
                </Select.Content>
            </Select.Root>
            <Readout :feed="feed" :grid-ref="gridRef" :instruments="INSTRUMENTS" />
        </div>
        <DataGrid.Root
            :features="features"
            :columns="columns"
            :row-count="order.length"
            :get-row="getRow"
            :grid-ref="gridRef"
            :row-key="rowKey"
            :row-height="40"
            :header-row-height="40"
            :summary-rows="{ bottom: 1 }"
            :summary-row-height="40"
            :sort-columns="sortColumns"
            :on-sort-columns-change="setSortColumns"
            :class="styles.root"
        >
            <DataGrid.Grid aria-label="Portfolio" :class="styles.grid">
                <DataGrid.Header :class="styles.header">
                    <DataGrid.HeaderRow :class="styles.headerRow">
                        <DataGrid.HeaderCells v-slot="{ cell }">
                            <DataGrid.HeaderCell
                                :cell="cell"
                                :class="
                                    styles.headerCell({
                                        numeric: NUMERIC.has(cell.key),
                                    })
                                "
                            >
                                <HeaderContent :cell="cell" />
                                <SortIndicator :column-key="cell.key" />
                                <Resizer :cell="cell" />
                            </DataGrid.HeaderCell>
                        </DataGrid.HeaderCells>
                    </DataGrid.HeaderRow>
                </DataGrid.Header>
                <DataGrid.Body>
                    <DataGrid.Rows v-slot="{ row }">
                        <DataGrid.Row :row="row" :class="styles.row(row)">
                            <DataGrid.Cells v-slot="{ cell }">
                                <DataGrid.Cell
                                    :cell="cell"
                                    :class="
                                        styles.cell({
                                            rowIndex: cell.rowIndex,
                                            numeric: NUMERIC.has(cell.column.key),
                                        })
                                    "
                                />
                            </DataGrid.Cells>
                        </DataGrid.Row>
                    </DataGrid.Rows>
                </DataGrid.Body>
                <!-- after the body: it stays at the view's bottom edge -->
                <Summary.Summary position="bottom" :class="styles.summary">
                    <Summary.SummaryRows v-slot="{ row }">
                        <Summary.SummaryRow
                            :row="row"
                            :class="styles.summaryRow"
                        >
                            <Summary.SummaryCells v-slot="{ cell }">
                                <Summary.SummaryCell
                                    :cell="cell"
                                    :class="
                                        styles.summaryCell({
                                            numeric: NUMERIC.has(cell.column.key),
                                        })
                                    "
                                />
                            </Summary.SummaryCells>
                        </Summary.SummaryRow>
                    </Summary.SummaryRows>
                </Summary.Summary>
            </DataGrid.Grid>
        </DataGrid.Root>
    </div>
</template>
