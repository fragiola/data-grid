import type { RowInfo, SummaryRowInfo } from "@fragiola/data-grid-angular";
import { cn } from "#/lib/cn";

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

export const toolbar =
    "palette-surface flex flex-wrap items-center gap-2 text-sm text-palette-contrast font-(family-name:--dg-font)";

export const icon = "size-4 opacity-70";

export const search = "w-56";

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

export const headerRow =
    "bg-(--dg-header-bg) text-palette-accent border-b-(length:--dg-gridline) border-(--dg-gridline-color)";

const active =
    "data-active:focus-within:outline-(length:--dg-active-width) data-active:focus-within:outline-(--dg-active-line) data-active:focus-within:[outline-style:var(--dg-active-style)] data-active:focus-within:[outline-offset:calc(var(--dg-active-width)*-1)]";

/**
 * a pinned cell (`data-pinned`) is opaque and above the cells that scroll under it (stacking is
 * the app's)
 */
const pinned = "data-pinned:z-1 data-pinned:bg-palette-base";

export const headerCell = cn(
    "flex items-center px-(--dg-cell-padding) outline-none",
    "data-sortable:cursor-pointer data-sortable:select-none data-sortable:hover:text-palette-contrast",
    "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
    active,
    pinned,
    "data-pinned:[background-image:linear-gradient(var(--dg-header-bg),var(--dg-header-bg))]",
);

/** by the row (`[dataGridRows]` hands it to its template): every other one tinted */
export const row = (row: RowInfo) =>
    cn(
        "border-b-(length:--dg-gridline) border-(--dg-gridline-color) hover:bg-(--dg-row-hover-bg)",
        row.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

export const cell = cn(
    "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
    active,
    pinned,
);

/** the summary rows stay over the rows that scroll under them: opaque and above, as the header */
export const summary = "bg-palette-base";

/**
 * by the summary row (`[dataGridSummaryRows]` hands it to its template): a line between it and the
 * body, a border below the top one, a shadow above the bottom one (a top border would push its
 * cells, placed from the row's inner edge, down past the view's bottom edge)
 */
export const summaryRow = (row: SummaryRowInfo) =>
    cn(
        "bg-(--dg-header-bg) font-semibold tabular-nums",
        row.position === "top"
            ? "border-b-(length:--dg-gridline) border-(--dg-gridline-color)"
            : "shadow-[0_calc(var(--dg-gridline)*-1)_0_var(--dg-gridline-color)]",
    );

export const summaryCell = cn(
    "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
    active,
    pinned,
    "data-pinned:[background-image:linear-gradient(var(--dg-header-bg),var(--dg-header-bg))]",
);
