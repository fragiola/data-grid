import type { RowState } from "@fragiola/data-grid-react";
import { cn } from "#/lib/cn";

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

export const toolbar =
    "palette-surface flex flex-wrap items-center gap-2 text-sm text-palette-contrast font-(family-name:--dg-font)";

export const icon = "size-4 opacity-70";

export const search = "w-52";

export const select = "w-40 flex-none";

export const count = "ms-auto text-xs text-palette-accent/85 tabular-nums";

export const layout = "flex min-h-0 flex-1 gap-3";

/** the request log: what the app asked its server for */
export const log = cn(
    "palette-surface flex w-64 shrink-0 flex-col gap-1 overflow-hidden rounded-(--dg-radius) border-(length:--dg-border) border-palette-line bg-palette-base p-2",
    "text-xs text-palette-accent/85 font-(family-name:--dg-font)",
);

export const logTitle = "font-(--dg-header-weight) text-palette-contrast";

export const logList = "flex min-h-0 flex-col gap-0.5 overflow-hidden";

export const logItem = "truncate font-(family-name:--dg-numeric-font)";

/** the page on screen dims while the next one loads: it is still the last answer */
export const body = (loading: boolean) =>
    cn("transition-opacity duration-(--dg-motion)", loading && "opacity-50");

export const pager =
    "palette-surface flex items-center justify-end gap-2 text-sm text-palette-contrast font-(family-name:--dg-font)";

export const pageOf = "min-w-28 text-center tabular-nums";

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
    // a sortable header cell sorts on a click: it reads as one, and its text is not selected
    "data-sortable:cursor-pointer data-sortable:select-none data-sortable:hover:text-palette-contrast",
    "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]",
);

export const row = (state: RowState) =>
    cn(
        "border-b-(length:--dg-gridline) border-(--dg-gridline-color) transition-colors duration-(--dg-motion) hover:bg-(--dg-row-hover-bg)",
        state.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

/** the active cell's outline sits inside it, so neighbours never cover it */
export const cell = cn(
    "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]",
);
