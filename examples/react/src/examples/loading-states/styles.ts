import type { RowState } from "@fragiola/data-grid-react";
import { cn } from "#/lib/cn";

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

/** the app's own toolbar: the status, the refetch and the failure switch */
export const toolbar =
    "palette-surface flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-palette-accent/85 font-(family-name:--dg-font)";

export const fail = "flex items-center gap-2 text-palette-contrast";

export const status = "ms-auto tabular-nums";

/** a refetch that failed while rows are on screen: a banner above the grid, its retry inside */
export const banner = cn(
    "palette-danger flex items-center gap-3 rounded-(--dg-radius) bg-palette-soft px-3 py-2",
    "text-xs text-palette-contrast font-(family-name:--dg-font)",
);

/** the scroll container: the theme's frame, font and size */
export const root = cn(
    "palette-raised min-h-0 flex-1 bg-palette-base text-palette-contrast",
    "rounded-(--dg-radius) border-(length:--dg-border) border-palette-line shadow-(--dg-shadow)",
    "font-(family-name:--dg-font) text-(length:--dg-font-size)",
);

/** the grid is the tab stop until a cell is active */
export const grid =
    "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--dg-active-line)";

/** the header's background: the rows scroll under it (its layer is the grid's) */
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

/** the rows dim while a refetch runs (the grid is `aria-busy`): they are about to change */
export const body = (refreshing: boolean) =>
    cn("transition-opacity duration-(--dg-motion)", refreshing && "opacity-60");

export const row = (state: RowState) =>
    cn(
        "border-b-(length:--dg-gridline) border-(--dg-gridline-color) hover:bg-(--dg-row-hover-bg)",
        state.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

export const cell = cn(
    "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]",
);

/** a row not loaded yet (`data-loading`): a bar where its value will be */
export const skeleton =
    "h-3 w-4/5 animate-pulse rounded-sm bg-(--dg-loading-bg) motion-reduce:animate-none";

/** the error, in the grid's empty state (its cell, as tall as the body): centred, a retry */
export const error =
    "flex h-full flex-col items-center justify-center gap-3 p-6 text-center";

export const errorTitle = "text-base font-semibold";

export const errorText = "max-w-72 text-sm text-palette-contrast/70";
