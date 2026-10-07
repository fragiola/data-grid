import type { RowState } from "@fragiola/data-grid-react";
import { cn } from "#/lib/cn";

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

/** the app's own toolbar: the count and the export */
export const toolbar =
    "palette-surface flex flex-wrap items-center gap-2 text-sm text-palette-contrast font-(family-name:--dg-font)";

export const count = "text-xs text-palette-accent/85 tabular-nums";

export const exported = "ms-auto text-xs text-palette-accent/85";

/** what "all" means here: every row of the server's, a link to it from a whole page */
export const banner = cn(
    "palette-blue flex flex-wrap items-center gap-2 rounded-(--dg-radius) bg-palette-soft px-3 py-1.5",
    "text-xs text-palette-contrast font-(family-name:--dg-font)",
);

export const layout = "flex min-h-0 flex-1 gap-3";

/** the request log: what the app asked its server for */
export const log = cn(
    "palette-surface flex w-64 shrink-0 flex-col gap-1 overflow-hidden rounded-(--dg-radius) border-(length:--dg-border) border-palette-line bg-palette-base p-2",
    "text-xs text-palette-accent/85 font-(family-name:--dg-font)",
);

export const logTitle = "font-(--dg-header-weight) text-palette-contrast";

export const logList = "flex min-h-0 flex-col gap-0.5 overflow-hidden";

export const logItem = "truncate font-(family-name:--dg-numeric-font)";

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

/** a selected row (`data-selected`) is tinted */
export const row = (state: RowState) =>
    cn(
        "border-b-(length:--dg-gridline) border-(--dg-gridline-color) transition-colors duration-(--dg-motion) hover:bg-(--dg-row-hover-bg)",
        state.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
        "data-selected:palette-blue data-selected:bg-palette-soft",
    );

/** the active cell's outline sits inside it, so neighbours never cover it */
export const cell = cn(
    "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
    "data-interacting:[outline-style:solid]",
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]",
);
