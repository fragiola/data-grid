import type { RowInfo } from "@fragiola/data-grid-vue";
import { cn } from "#/lib/cn";

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

export const toolbar = "flex items-center justify-between gap-2";

export const count = "text-xs text-palette-contrast/70 tabular-nums";

/** the scroll container: the theme's frame, font and size */
export const root = cn(
    "palette-raised min-h-0 flex-1 bg-palette-base text-palette-contrast",
    "rounded-(--dg-radius) border-(length:--dg-border) border-palette-line shadow-(--dg-shadow)",
    "font-(family-name:--dg-font) text-(length:--dg-font-size)",
);

/** the grid is the tab stop until a cell is active (and while it is empty) */
export const grid =
    "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--dg-active-line)";

/** opaque: the rows scroll under it (its place above them is the grid's) */
export const header = "bg-palette-base";

/** while empty, the header loses its rule: the empty area reads as one with it */
export const headerRow = cn(
    "bg-(--dg-header-bg) text-palette-accent",
    "border-b-(length:--dg-gridline) border-(--dg-gridline-color) in-data-empty:border-transparent",
);

export const headerCell = cn(
    "flex items-center px-(--dg-cell-padding) outline-none",
    "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
    "data-active:focus-within:outline-(length:--dg-active-width) data-active:focus-within:outline-(--dg-active-line) data-active:focus-within:[outline-style:var(--dg-active-style)] data-active:focus-within:[outline-offset:calc(var(--dg-active-width)*-1)]",
);

/** by the row (`DataGrid.Rows` hands it to its slot): every other one tinted */
export const row = (row: RowInfo) =>
    cn(
        "border-b-(length:--dg-gridline) border-(--dg-gridline-color) transition-colors duration-(--dg-motion) hover:bg-(--dg-row-hover-bg)",
        row.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

export const cell = cn(
    "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
    "data-active:focus-within:outline-(length:--dg-active-width) data-active:focus-within:outline-(--dg-active-line) data-active:focus-within:[outline-style:var(--dg-active-style)] data-active:focus-within:[outline-offset:calc(var(--dg-active-width)*-1)]",
);

/** the empty state's cell (as tall as the visible body): the content centred in it */
export const empty =
    "flex h-full flex-col items-center justify-center gap-3 p-6 text-center";

export const illustration = cn(
    "grid size-16 place-items-center rounded-full",
    "bg-(--dg-row-alt-bg) text-palette-accent [&_svg]:size-8",
);

export const emptyTitle = "text-base font-semibold";

export const emptyText = "max-w-72 text-sm text-palette-contrast/70";
