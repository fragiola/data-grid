import type { CellInfo, RowInfo } from "@fragiola/data-grid-angular";
import { cn } from "#/lib/cn";
import type { InstrumentType } from "../_kit/market";

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

export const toolbar =
    "palette-surface flex flex-wrap items-center gap-2 text-sm text-palette-contrast font-(family-name:--dg-font)";

export const rateSelect = "w-44 flex-none gap-2";

export const rateLabel = "text-palette-accent/80";

export const readout =
    "ms-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-palette-accent/85";

export const figure =
    "font-(family-name:--dg-numeric-font) tabular-nums text-palette-contrast";

/** a figure that moves every half second keeps its width */
export const liveFigure = cn(figure, "inline-block min-w-[4ch] text-end");

/** the scroll container: the theme's frame, font and size */
export const root = cn(
    "palette-raised min-h-0 flex-1 bg-palette-base text-palette-contrast",
    "rounded-(--dg-radius) border-(length:--dg-border) border-palette-line shadow-(--dg-shadow)",
    "font-(family-name:--dg-font) text-(length:--dg-font-size)",
);

/** the grid is the tab stop until a cell is active */
export const grid =
    "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--dg-active-line)";

/** opaque: the rows scroll under it (its place above them is the grid's) */
export const header = "bg-palette-base";

export const headerRow = cn(
    "bg-(--dg-header-bg) text-palette-accent",
    "border-b-(length:--dg-gridline) border-(--dg-gridline-color)",
);

/**
 * a pinned cell (`data-pinned`) is opaque and above the cells that scroll under it (stacking is
 * the app's): the base colour, then the tint of its row or header painted over it
 */
const pinned = "data-pinned:z-1 data-pinned:bg-palette-base";

/** the pinned column's edge (`data-pinned-edge`) casts a shadow over the columns scrolling under it */
const pinnedEdge =
    "data-pinned-edge:shadow-[6px_0_8px_-6px_color-mix(in_oklab,var(--palette-contrast)_35%,transparent)]";

const active =
    "data-active:focus-within:outline-(length:--dg-active-width) data-active:focus-within:outline-(--dg-active-line) data-active:focus-within:[outline-style:var(--dg-active-style)] data-active:focus-within:[outline-offset:calc(var(--dg-active-width)*-1)]";

/**
 * a header cell: its sort on a click (`data-sortable`), its resizer's line on hover; by whether
 * its column's figures line up on the right (pinned: its `data-*`)
 */
export const headerCell = (numeric: boolean) =>
    cn(
        "group/header flex items-center gap-1.5 px-(--dg-cell-padding) outline-none",
        "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
        "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
        "data-sortable:cursor-pointer data-sortable:select-none data-sortable:hover:text-palette-contrast",
        numeric && "justify-end",
        active,
        pinned,
        "data-pinned:[background-image:linear-gradient(var(--dg-header-bg),var(--dg-header-bg))]",
        pinnedEdge,
    );

/**
 * A column's resize handle: a strip at its header cell's right edge (the cell is positioned), its
 * line shown on hover, focus or while dragged. `touch-none`: a touch drags it, not the page.
 */
export const resizer = cn(
    "absolute inset-y-0 right-0 w-2 cursor-col-resize touch-none select-none outline-none",
    "after:absolute after:inset-y-2 after:right-0 after:w-0.5 after:rounded-full after:bg-(--dg-active-line)",
    "after:opacity-0 after:transition-opacity after:duration-(--dg-motion)",
    "group-hover/header:after:opacity-40 hover:after:opacity-100",
    "focus-visible:after:opacity-100 data-resizing:after:opacity-100",
);

export const sortIcon = "size-3.5 shrink-0";

/**
 * `group/row`: a pinned cell shows its row's hover too; by the row (`[dataGridRows]` hands it to
 * its template)
 */
export const row = (state: RowInfo) =>
    cn(
        "group/row border-b-(length:--dg-gridline) border-(--dg-gridline-color) hover:bg-(--dg-row-hover-bg)",
        state.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

/**
 * the active cell's outline sits inside it, so neighbours never cover it; by the cell
 * (`[dataGridCells]` hands it to its template) and whether its figures line up on the right
 */
export const cell = <TRow>(state: CellInfo<TRow>, numeric: boolean) =>
    cn(
        "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
        "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
        numeric &&
            "justify-end font-(family-name:--dg-numeric-font) tabular-nums",
        active,
        pinned,
        state.rowIndex % 2 === 1 &&
            "data-pinned:[background-image:linear-gradient(var(--dg-row-alt-bg),var(--dg-row-alt-bg))]",
        "data-pinned:group-hover/row:[background-image:linear-gradient(var(--dg-row-hover-bg),var(--dg-row-hover-bg))]",
        pinnedEdge,
    );

/** the summary row: sticky at the bottom edge, opaque, a firmer line above it */
export const summary = "bg-palette-base";

export const summaryRow = cn(
    "bg-(--dg-header-bg) text-palette-contrast font-(--dg-header-weight)",
    "border-t-(length:--dg-gridline) border-(--dg-gridline-color)",
);

/** by whether its column's figures line up on the right (pinned: its `data-*`) */
export const summaryCell = (numeric: boolean) =>
    cn(
        "flex items-center gap-2 overflow-hidden whitespace-nowrap px-(--dg-cell-padding)",
        "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
        numeric &&
            "justify-end font-(family-name:--dg-numeric-font) tabular-nums",
        pinned,
        "data-pinned:[background-image:linear-gradient(var(--dg-header-bg),var(--dg-header-bg))]",
        pinnedEdge,
    );

export const summaryLabel = "text-palette-accent";

export const ticker = "flex min-w-0 items-center gap-2";

const LOGO_TONES = [
    "palette-blue",
    "palette-purple",
    "palette-green",
    "palette-orange",
    "palette-rose",
    "palette-danger",
];

/** an instrument's logo: two letters on a round of its colour */
export const logo = (tone: number) =>
    cn(
        "grid size-5 shrink-0 place-items-center rounded-full bg-palette-base text-[0.5625rem] font-bold text-palette-contrast",
        LOGO_TONES[tone],
    );

export const symbol = "shrink-0 font-semibold";

export const name = "min-w-0 truncate text-palette-accent";

/** the timeline: bars as tall as the cell allows */
export const timeline = "h-6 w-full";

export const bar = "fill-(--dg-active-line) opacity-80";

const TYPE_TONES: Record<InstrumentType, string> = {
    Stock: "palette-blue",
    ETF: "palette-purple",
    Bond: "palette-green",
    Crypto: "palette-orange",
    FX: "palette-rose",
};

/** an instrument's kind, a badge of its colour */
export const typeBadge = (type: InstrumentType) =>
    cn(
        "rounded-full bg-palette-soft px-2 py-0.5 text-xs font-medium text-palette-accent",
        TYPE_TONES[type],
    );

/** the price's cell content: the flash layer under the figure */
export const price = "relative -mx-1 px-1";

export const priceValue = "relative";

/** a price that just moved: a tint that fades out once (mounted again by the next move) */
export const flash = (direction: "up" | "down") =>
    cn(
        "absolute inset-0 rounded-sm bg-palette-soft",
        "animate-out fade-out fill-mode-forwards duration-700",
        direction === "up" ? "palette-green" : "palette-danger",
    );

/** a signed figure: green up, red down, an arrow before it */
export const delta = (side: "up" | "down" | "flat") =>
    cn(
        "inline-flex items-center gap-0.5 tabular-nums",
        side === "up" && "text-[oklch(0.68_0.17_150)]",
        side === "down" && "text-[oklch(0.65_0.21_25)]",
        side === "flat" && "text-palette-accent",
    );

export const arrow = "size-3.5 shrink-0";

export const deltaPill = "flex items-center gap-2";

const PILL_TONES = ["palette-green", "palette-danger", "palette-surface"];

/** a figure on a pill: green while it gains, red while it loses */
export const pill = (tone: number) =>
    cn(
        "rounded-full bg-palette-soft px-2 py-0.5 text-palette-accent tabular-nums",
        PILL_TONES[tone],
    );

export const volume = "flex w-full items-center gap-2";

export const volumeTrack =
    "h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-palette-soft";

export const volumeBar = "block h-full rounded-full bg-(--dg-active-line)";

export const volumeValue = "w-12 text-end tabular-nums";
