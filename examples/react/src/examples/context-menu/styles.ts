import type { CellState, RowState } from "@fragiola/data-grid-react";
import { cn } from "#/lib/cn";

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

/** the app's own toolbar: the hint, the live region */
export const toolbar =
    "palette-surface flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-palette-accent/85 font-(family-name:--dg-font)";

export const key =
    "rounded-sm border border-palette-line bg-palette-soft px-1.5 py-0.5 font-(family-name:--dg-numeric-font) text-[0.6875rem] text-palette-contrast";

/** the live region, shown too: what the last action did */
export const status = "ms-auto min-w-0 truncate text-palette-contrast";

/** the menu's trigger holds the grid: it takes the frame's room */
export const trigger = "flex min-h-0 flex-1 flex-col";

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

const active =
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]";

export const headerCell = cn(
    "flex items-center px-(--dg-cell-padding) outline-none",
    "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
    active,
);

export const row = (state: RowState) =>
    cn(
        "border-b-(length:--dg-gridline) border-(--dg-gridline-color) hover:bg-(--dg-row-hover-bg)",
        state.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

/** the row the open menu acts on is tinted, so the reader sees which one it is */
export const cell = (_state: CellState, target: boolean) =>
    cn(
        "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
        active,
        target &&
            "bg-[color-mix(in_oklch,var(--dg-active-line)_12%,transparent)]",
    );

/** the destructive item reads as one */
export const danger = "palette-danger text-palette-contrast";
