import type { CellInfo, RowInfo } from "@fragiola/data-grid-angular";
import { cn } from "#/lib/cn";

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

/** the app's own controls: where to scroll, how to align */
export const toolbar =
    "palette-surface flex flex-wrap items-end gap-3 text-sm text-palette-contrast font-(family-name:--dg-font)";

export const field = "w-28";

export const aligns = "flex flex-wrap items-center gap-3 pb-1.5";

export const legend = "float-left me-1 text-palette-accent/80";

export const align = "flex cursor-pointer items-center gap-1.5";

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
 * a pinned cell (`data-pinned`) is opaque and above the cells that scroll under it (stacking is the
 * app's)
 */
const pinned = "data-pinned:z-1 data-pinned:bg-palette-base";

/**
 * the pinned column ends on a firmer line (`data-pinned-edge`), so the columns scrolling under it
 * read as such
 */
const pinnedEdge =
    "data-pinned-edge:border-r-2 data-pinned-edge:border-r-palette-line";

const active =
    "data-active:focus-within:outline-(length:--dg-active-width) data-active:focus-within:outline-(--dg-active-line) data-active:focus-within:[outline-style:var(--dg-active-style)] data-active:focus-within:[outline-offset:calc(var(--dg-active-width)*-1)]";

export const headerCell = cn(
    "flex items-center justify-end px-(--dg-cell-padding) outline-none",
    "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
    "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
    active,
    pinned,
    "data-pinned:[background-image:linear-gradient(var(--dg-header-bg),var(--dg-header-bg))]",
    pinnedEdge,
);

/** by the row (`[dataGridRows]` hands it to its template): every other one tinted */
export const row = (row: RowInfo) =>
    cn(
        "border-b-(length:--dg-gridline) border-(--dg-gridline-color)",
        row.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

/**
 * by the cell (`[dataGridCells]` hands it to its template): the active cell's outline sits
 * inside it, so neighbours never cover it
 */
export const cell = (cell: Pick<CellInfo, "rowIndex">) =>
    cn(
        "flex items-center justify-end overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
        "font-(family-name:--dg-numeric-font) tabular-nums",
        "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
        active,
        pinned,
        "data-pinned:text-palette-accent",
        cell.rowIndex % 2 === 1 &&
            "data-pinned:[background-image:linear-gradient(var(--dg-row-alt-bg),var(--dg-row-alt-bg))]",
        pinnedEdge,
    );
