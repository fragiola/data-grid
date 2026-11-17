import type { CellInfo, RowInfo } from "@fragiola/data-grid-vue";
import { cn } from "#/lib/cn";

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

export const readout =
    "palette-surface flex flex-wrap gap-x-4 gap-y-1 text-xs text-palette-accent/85 font-(family-name:--dg-font)";

export const figure =
    "font-(family-name:--dg-numeric-font) tabular-nums text-palette-contrast";

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
 * the app's): the base colour, then the tint its row or header shows through
 */
const pinned = "data-pinned:z-1 data-pinned:bg-palette-base";

/**
 * the last pinned column (`data-pinned-edge`) ends on a firmer line, so the columns scrolling
 * under it read as such
 */
const pinnedEdge =
    "data-pinned-edge:border-r-2 data-pinned-edge:border-r-palette-line";

export const headerCell = cn(
    "flex items-center px-(--dg-cell-padding) outline-none",
    "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
    "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
    "data-active:focus-within:outline-(length:--dg-active-width) data-active:focus-within:outline-(--dg-active-line) data-active:focus-within:[outline-style:var(--dg-active-style)] data-active:focus-within:[outline-offset:calc(var(--dg-active-width)*-1)]",
    pinned,
    "data-pinned:[background-image:linear-gradient(var(--dg-header-bg),var(--dg-header-bg))]",
    pinnedEdge,
);

/**
 * `group/row`: a pinned cell shows its row's hover too; by the row (`DataGrid.Rows` hands it to
 * its slot)
 */
export const row = (row: RowInfo) =>
    cn(
        "group/row border-b-(length:--dg-gridline) border-(--dg-gridline-color) hover:bg-(--dg-row-hover-bg)",
        row.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

/**
 * the active cell's outline sits inside it, so neighbours never cover it; by the cell
 * (`DataGrid.Cells` hands it to its slot): a pinned one on an odd row takes the row's tint
 */
export const cell = <TRow>(cell: CellInfo<TRow>) =>
    cn(
        "flex items-center justify-end overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
        "font-(family-name:--dg-numeric-font) tabular-nums",
        "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
        "data-active:focus-within:outline-(length:--dg-active-width) data-active:focus-within:outline-(--dg-active-line) data-active:focus-within:[outline-style:var(--dg-active-style)] data-active:focus-within:[outline-offset:calc(var(--dg-active-width)*-1)]",
        pinned,
        cell.rowIndex % 2 === 1 &&
            "data-pinned:[background-image:linear-gradient(var(--dg-row-alt-bg),var(--dg-row-alt-bg))]",
        "data-pinned:group-hover/row:[background-image:linear-gradient(var(--dg-row-hover-bg),var(--dg-row-hover-bg))]",
        pinnedEdge,
    );
