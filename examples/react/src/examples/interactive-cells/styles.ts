import type { RowState } from "@fragiola/data-grid-react";
import { cn } from "#/lib/cn";

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

/** the app's own hint of the keys, above the grid */
export const hint =
    "palette-surface flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-palette-accent/85 font-(family-name:--dg-font)";

export const key =
    "rounded-sm border border-palette-line bg-palette-soft px-1.5 py-0.5 font-(family-name:--dg-numeric-font) text-[0.6875rem] text-palette-contrast";

export const count = "ms-auto tabular-nums";

export const field =
    "h-8 w-full rounded-sm border border-palette-line bg-palette-base px-2 text-sm";

export const select = "h-8 w-full";

export const link =
    "text-palette-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-palette-ring";

export const actions = "flex gap-0.5";

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

export const headerCell = cn(
    "flex items-center px-(--dg-cell-padding) outline-none",
    "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]",
);

export const row = (state: RowState) =>
    cn(
        "border-b-(length:--dg-gridline) border-(--dg-gridline-color) transition-colors duration-(--dg-motion) hover:bg-(--dg-row-hover-bg)",
        state.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

/**
 * the active cell's outline sits inside it, so neighbours never cover it; while its controls have
 * the keys (`data-interacting`), it is tinted and its outline solid
 */
export const cell = cn(
    "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
    "data-interacting:bg-palette-soft data-interacting:[outline-style:solid]",
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]",
);
