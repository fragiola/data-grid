"use client";

import {
    type Column,
    DataGrid,
    type DataGridRef,
    headerCellContent,
    useColumnWindow,
    useDataGridRef,
    useRowWindow,
} from "@fragiola/data-grid-react";
import { columnPinning } from "@fragiola/data-grid-react/column-pinning";
import { columnResize } from "@fragiola/data-grid-react/column-resize";
import { navigation } from "@fragiola/data-grid-react/navigation";
import { type SortColumn, sorting } from "@fragiola/data-grid-react/sorting";
import {
    Summary,
    SummaryCell,
    SummaryCells,
    SummaryRow,
    SummaryRows,
    summaryRows,
} from "@fragiola/data-grid-react/summary-rows";
import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { Select } from "#/components/ui/select";
import { formatNumber } from "../_kit/data";
import {
    changeOf,
    changeRatioOf,
    createMarketFeed,
    type FeedStats,
    formatAmount,
    formatCompact,
    formatPercent,
    formatPrice,
    type Instrument,
    type MarketFeed,
    positionValueOf,
    profitOf,
    type Totals,
    totalsOf,
} from "../_kit/market";
import {
    Delta,
    DeltaPill,
    PriceCell,
    Resizer,
    SortIndicator,
    TickerCell,
    Timeline,
    TypeBadge,
    VolumeCell,
} from "./cells";
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
function columnsOf(totals: { readonly current: Totals }): Column<Instrument>[] {
    return [
        {
            key: "ticker",
            name: "Ticker",
            width: 280,
            pinned: "start",
            sortable: true,
            resizable: true,
            renderCell: ({ row }) => <TickerCell instrument={row} />,
            renderSummaryCell: () => (
                <span className={styles.summaryLabel}>
                    Portfolio · {formatNumber(INSTRUMENTS)} instruments
                </span>
            ),
        },
        {
            key: "timeline",
            name: "Timeline",
            width: 130,
            resizable: true,
            renderCell: ({ row }) => <Timeline history={row.history} />,
        },
        {
            key: "type",
            name: "Instrument",
            width: 120,
            sortable: true,
            resizable: true,
            renderCell: ({ row }) => <TypeBadge type={row.type} />,
        },
        {
            key: "price",
            name: "Price",
            width: 120,
            sortable: true,
            resizable: true,
            renderCell: ({ row }) => <PriceCell instrument={row} />,
        },
        {
            key: "change",
            name: "Change",
            width: 120,
            sortable: true,
            resizable: true,
            renderCell: ({ row }) => (
                <Delta value={changeOf(row)}>
                    {formatPercent(changeRatioOf(row))}
                </Delta>
            ),
            renderSummaryCell: () => (
                <span>
                    <Delta value={1}>{String(totals.current.gainers)}</Delta>{" "}
                    <Delta value={-1}>{String(totals.current.losers)}</Delta>
                </span>
            ),
        },
        {
            key: "profit",
            name: "P&L",
            width: 200,
            sortable: true,
            resizable: true,
            renderCell: ({ row }) => {
                const profit = profitOf(row);
                return (
                    <DeltaPill
                        delta={profit}
                        value={formatPercent(
                            profit / (row.cost * row.quantity),
                        )}
                        tone={profit >= 0 ? 0 : 1}
                    />
                );
            },
            renderSummaryCell: () => (
                <Delta value={totals.current.profit}>
                    {formatAmount(totals.current.profit)}
                </Delta>
            ),
        },
        {
            key: "value",
            name: "Total value",
            width: 210,
            sortable: true,
            resizable: true,
            renderCell: ({ row }) => {
                const day = changeOf(row) * row.quantity;
                return (
                    <DeltaPill
                        delta={day}
                        value={formatAmount(positionValueOf(row))}
                        tone={2}
                    />
                );
            },
            renderSummaryCell: () => formatAmount(totals.current.value),
        },
        {
            key: "volume",
            name: "Volume",
            width: 150,
            sortable: true,
            resizable: true,
            renderCell: ({ row }) => (
                <VolumeCell
                    volume={row.volume}
                    label={formatCompact(row.volume)}
                />
            ),
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

export default function LiveMarket() {
    // the market and its feed: app state, outside the grid. Every frame the feed moves some
    // instruments (new objects) and says which; the grid is told those rows changed
    const [feed] = useState(() =>
        createMarketFeed({ count: INSTRUMENTS, rate: 2000 }),
    );
    const [playing, setPlaying] = useState(true);
    const [rate, setRate] = useState(feed.rate);
    const gridRef = useDataGridRef<Instrument, typeof FEATURES>();
    // the totals the summary cells read, worked out again with every batch
    const totals = useRef<Totals>(totalsOf(feed.market));
    const columns = useMemo(() => columnsOf(totals), []);

    // the grid sorts by a click on a header; the app orders the rows (by index into the market),
    // again every second while it plays, so a sorted column stays sorted as prices move
    const [sortColumns, setSortColumns] = useState<readonly SortColumn[]>([]);
    const [order, setOrder] = useState(() => orderOf(feed.market, []));
    useEffect(() => {
        setOrder(orderOf(feed.market, sortColumns));
        if (sortColumns.length === 0 || !playing) return;
        const timer = setInterval(
            () => setOrder(orderOf(feed.market, sortColumns)),
            1000,
        );
        return () => clearInterval(timer);
    }, [feed, sortColumns, playing]);
    // where each instrument shows (the inverse of the order): a batch's rows by its instruments
    const rowOf = useMemo(() => {
        const rows = new Int32Array(order.length);
        order.forEach((instrument, row) => {
            rows[instrument] = row;
        });
        return rows;
    }, [order]);
    // a new order is a new getter: the grid takes it as a new source
    const getRow = useMemo(
        () => (index: number) => {
            const instrument = order[index];
            return instrument === undefined
                ? undefined
                : feed.market[instrument];
        },
        [feed, order],
    );

    // each batch: the rows from the first moved to the last moved changed (the grid renders the
    // ones on screen), and the summary's figures
    useEffect(
        () =>
            feed.subscribe((moved) => {
                const grid = gridRef.current;
                if (!grid) return;
                let start = Number.POSITIVE_INFINITY;
                let end = -1;
                for (const instrument of moved) {
                    const row = rowOf[instrument] ?? 0;
                    if (row < start) start = row;
                    if (row > end) end = row;
                }
                grid.model.run("rows.changed", { start, end: end + 1 });
                totals.current = totalsOf(feed.market);
                grid.model.run("summary-rows.changed", {});
            }),
        [feed, gridRef, rowOf],
    );
    useEffect(() => {
        if (playing) feed.play();
        else feed.pause();
        return () => feed.pause();
    }, [feed, playing]);

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <Clickable.Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPlaying((current) => !current)}
                >
                    {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
                    {playing ? "Pause" : "Play"}
                </Clickable.Button>
                <Select.Root
                    items={RATES}
                    value={String(rate)}
                    onValueChange={(value) => {
                        const next = Number(value);
                        feed.setRate(next);
                        setRate(next);
                    }}
                >
                    <Select.Trigger
                        className={styles.rateSelect}
                        aria-label="Price changes a second"
                    >
                        <span className={styles.rateLabel}>Rate</span>
                        <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                        {Object.entries(RATES).map(([value, label]) => (
                            <Select.Item key={value} value={value}>
                                {label}
                            </Select.Item>
                        ))}
                    </Select.Content>
                </Select.Root>
                <Readout feed={feed} gridRef={gridRef} />
            </div>
            <DataGrid.Root
                features={FEATURES}
                columns={columns}
                rowCount={order.length}
                getRow={getRow}
                gridRef={gridRef}
                rowKey={(row) => row.id}
                rowHeight={40}
                headerRowHeight={40}
                summaryRows={{ bottom: 1 }}
                summaryRowHeight={40}
                sortColumns={sortColumns}
                onSortColumnsChange={setSortColumns}
                className={styles.root}
            >
                <DataGrid.Grid aria-label="Portfolio" className={styles.grid}>
                    <DataGrid.Header className={styles.header}>
                        <DataGrid.HeaderRow className={styles.headerRow}>
                            <DataGrid.HeaderCells<Instrument>>
                                {(cell) => (
                                    <DataGrid.HeaderCell
                                        cell={cell}
                                        className={(state) =>
                                            styles.headerCell({
                                                ...state,
                                                numeric: NUMERIC.has(cell.key),
                                            })
                                        }
                                    >
                                        {headerCellContent(cell)}
                                        <SortIndicator columnKey={cell.key} />
                                        <Resizer cell={cell} />
                                    </DataGrid.HeaderCell>
                                )}
                            </DataGrid.HeaderCells>
                        </DataGrid.HeaderRow>
                    </DataGrid.Header>
                    <DataGrid.Body>
                        <DataGrid.Rows<Instrument>>
                            {(row) => (
                                <DataGrid.Row row={row} className={styles.row}>
                                    <DataGrid.Cells<Instrument>>
                                        {(cell) => (
                                            <DataGrid.Cell
                                                cell={cell}
                                                className={(state) =>
                                                    styles.cell({
                                                        ...state,
                                                        numeric: NUMERIC.has(
                                                            cell.column.key,
                                                        ),
                                                    })
                                                }
                                            />
                                        )}
                                    </DataGrid.Cells>
                                </DataGrid.Row>
                            )}
                        </DataGrid.Rows>
                    </DataGrid.Body>
                    {/* after the body: it stays at the view's bottom edge */}
                    <Summary position="bottom" className={styles.summary}>
                        <SummaryRows>
                            {(row) => (
                                <SummaryRow
                                    row={row}
                                    className={styles.summaryRow}
                                >
                                    <SummaryCells<Instrument>>
                                        {(cell) => (
                                            <SummaryCell
                                                cell={cell}
                                                className={(state) =>
                                                    styles.summaryCell({
                                                        ...state,
                                                        numeric: NUMERIC.has(
                                                            cell.column.key,
                                                        ),
                                                    })
                                                }
                                            />
                                        )}
                                    </SummaryCells>
                                </SummaryRow>
                            )}
                        </SummaryRows>
                    </Summary>
                </DataGrid.Grid>
            </DataGrid.Root>
        </div>
    );
}

/**
 * The feed's figures (price changes and frames a second, from the feed twice a second) and the
 * cells the grid renders (from its windows): this re-renders, the grid does not.
 */
function Readout({
    feed,
    gridRef,
}: {
    feed: MarketFeed;
    gridRef: DataGridRef<Instrument, typeof FEATURES>;
}) {
    const [stats, setStats] = useState<FeedStats>({
        updatesPerSecond: 0,
        framesPerSecond: 0,
    });
    useEffect(() => feed.onStats(setStats), [feed]);
    const rows = useRowWindow(gridRef);
    const columns = useColumnWindow(gridRef);
    const rendered =
        (rows.rendered.end - rows.rendered.start) *
        (columns.rendered.end - columns.rendered.start);
    return (
        <p className={styles.readout}>
            <span>
                <span className={styles.liveFigure} data-testid="updates">
                    {formatNumber(stats.updatesPerSecond)}
                </span>{" "}
                updates/s
            </span>
            <span>
                <span className={styles.liveFigure} data-testid="fps">
                    {stats.framesPerSecond}
                </span>{" "}
                fps
            </span>
            <span>
                <span className={styles.figure}>
                    {formatNumber(INSTRUMENTS)}
                </span>{" "}
                rows
            </span>
            <span>
                rendered:{" "}
                <span className={styles.figure} data-testid="rendered-cells">
                    {formatNumber(rendered)}
                </span>{" "}
                cells
            </span>
        </p>
    );
}
