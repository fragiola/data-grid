"use client";

import { type HeaderCellInfo, useGridView } from "@fragiola/data-grid-react";
import { useColumnResizer } from "@fragiola/data-grid-react/column-resize";
import { sortColumnsOf } from "@fragiola/data-grid-react/sorting";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useMemo } from "react";
import { hash } from "../_kit/data";
import {
    formatAmount,
    formatPrice,
    type Instrument,
    type InstrumentType,
} from "../_kit/market";
import * as styles from "./styles";

// The cells' content: each one reads its instrument, a new object whenever it moves (the timeline
// works its bars out again only for a new history).

/** how long a moved price stays lit, in milliseconds (the flash's fade, `styles.flash`) */
const FLASH = 700;

/** The instrument's logo: its ticker's first letters on a colour of its own (all are fictional). */
export function Logo({ instrument }: { instrument: Instrument }) {
    return (
        <span aria-hidden className={styles.logo(hash(instrument.id, 6))}>
            {instrument.ticker.slice(0, 2)}
        </span>
    );
}

/** The ticker in bold, its name after it. */
export function TickerCell({ instrument }: { instrument: Instrument }) {
    return (
        <span className={styles.ticker}>
            <Logo instrument={instrument} />
            <span className={styles.symbol}>{instrument.ticker}</span>
            <span className={styles.name}>{instrument.name}</span>
        </span>
    );
}

/**
 * The last prices as bars, scaled between their lowest and highest: worked out again only when
 * the history is a new one.
 */
export function Timeline({ history }: { history: readonly number[] }) {
    const bars = useMemo(() => {
        const low = Math.min(...history);
        const range = Math.max(...history) - low || 1;
        return history.map((price, index) => ({
            x: index * 4,
            height: 2 + ((price - low) / range) * 22,
        }));
    }, [history]);
    return (
        <svg
            aria-hidden
            className={styles.timeline}
            viewBox={`0 0 ${history.length * 4} 24`}
            preserveAspectRatio="none"
        >
            {bars.map((bar) => (
                <rect
                    key={bar.x}
                    x={bar.x}
                    y={24 - bar.height}
                    width={3}
                    height={bar.height}
                    className={styles.bar}
                />
            ))}
        </svg>
    );
}

/** The instrument's kind, as a badge of its own colour. */
export function TypeBadge({ type }: { type: InstrumentType }) {
    return <span className={styles.typeBadge(type)}>{type}</span>;
}

/**
 * The price, lit up or down for a moment when it moves: the flash is a layer that fades out
 * once, mounted again (its `key`) by the next move. A row scrolled into view long after its last
 * move shows no flash.
 */
export function PriceCell({ instrument }: { instrument: Instrument }) {
    const fresh = performance.now() - instrument.changedAt < FLASH;
    return (
        <span className={styles.price}>
            {fresh && (
                <span
                    key={instrument.ticks}
                    data-flash={instrument.direction}
                    className={styles.flash(instrument.direction)}
                />
            )}
            <span className={styles.priceValue}>
                {formatPrice(instrument.price)}
            </span>
        </span>
    );
}

/** An arrow up or down, coloured, and a signed figure (nothing for zero). */
export function Delta({
    value,
    children,
}: {
    value: number;
    children: string;
}) {
    const side = value > 0 ? "up" : value < 0 ? "down" : "flat";
    return (
        <span className={styles.delta(side)}>
            {side === "up" && <ArrowUp aria-hidden className={styles.arrow} />}
            {side === "down" && (
                <ArrowDown aria-hidden className={styles.arrow} />
            )}
            {children}
        </span>
    );
}

/** A movement beside a pill: the day's (or the position's) change, then the figure it moves. */
export function DeltaPill({
    delta,
    value,
    tone,
}: {
    delta: number;
    value: string;
    tone: number;
}) {
    return (
        <span className={styles.deltaPill}>
            <Delta value={delta}>{formatAmount(delta)}</Delta>
            <span className={styles.pill(tone)}>{value}</span>
        </span>
    );
}

/** Today's volume, and a bar of it against the busiest the demo expects. */
export function VolumeCell({
    volume,
    label,
}: {
    volume: number;
    label: string;
}) {
    const share = Math.min(volume / 2_000_000, 1);
    return (
        <span className={styles.volume}>
            <span className={styles.volumeTrack}>
                <span
                    className={styles.volumeBar}
                    style={{ inlineSize: `${Math.round(share * 100)}%` }}
                />
            </span>
            <span className={styles.volumeValue}>{label}</span>
        </span>
    );
}

/** A sorted column's direction, after its name in the header (the grid sorts; the arrow is the app's). */
export function SortIndicator({ columnKey }: { columnKey: string }) {
    const sorted = sortColumnsOf(useGridView()).find(
        (entry) => entry.columnKey === columnKey,
    );
    if (!sorted) return null;
    return sorted.direction === "ascending" ? (
        <ArrowUp aria-hidden className={styles.sortIcon} />
    ) : (
        <ArrowDown aria-hidden className={styles.sortIcon} />
    );
}

/** A column's resize handle (the grid's separator: drag, keys, double-click to fit). */
export function Resizer({ cell }: { cell: HeaderCellInfo<Instrument> }) {
    const { state, props } = useColumnResizer(cell);
    if (!state.resizable) return null;
    return (
        // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the hook's props make it a separator, a focusable one (the APG's splitter), which an <hr> cannot be
        <div
            {...props}
            aria-label={`Resize ${cell.column?.name ?? cell.key}`}
            className={styles.resizer}
        />
    );
}
