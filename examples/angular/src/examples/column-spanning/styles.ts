import type { HeaderCellInfo, RowInfo } from "@fragiola/data-grid-angular";
import { cn } from "#/lib/cn";

export const frame = "flex h-full min-h-0 flex-col p-3";

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
 * the app's), a shadow on its part's edge (`data-pinned-edge`)
 */
const pinned = cn(
    "data-pinned:z-1 data-pinned:bg-palette-base",
    "data-pinned-edge:data-[pinned=end]:shadow-[-6px_0_8px_-6px_color-mix(in_oklab,var(--palette-contrast)_35%,transparent)]",
    "data-pinned-edge:data-[pinned=start]:shadow-[6px_0_8px_-6px_color-mix(in_oklab,var(--palette-contrast)_35%,transparent)]",
);

/**
 * by the cell `[dataGridHeaderCells]` hands to its template: a header cell spanning two hours
 * (`aria-colspan`) centres its range over them
 */
export const headerCell = <TRow>(cell: HeaderCellInfo<TRow>) =>
    cn(
        "flex items-center px-(--dg-cell-padding) outline-none",
        "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
        "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
        cell.columnSpan > 1 && "justify-center",
        active,
        pinned,
        "data-pinned:[background-image:linear-gradient(var(--dg-header-bg),var(--dg-header-bg))]",
    );

/** by the row (`[dataGridRows]` hands it to its template): every other one tinted */
export const row = (row: RowInfo) =>
    cn(
        "group/row border-b-(length:--dg-gridline) border-(--dg-gridline-color) hover:bg-(--dg-row-hover-bg)",
        row.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

/** the active cell's outline sits inside it: a booking's covers the hours it spans */
export const cell = cn(
    "flex items-center overflow-hidden whitespace-nowrap px-1 outline-none",
    "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
    active,
    pinned,
    "data-pinned:px-(--dg-cell-padding)",
);

/** the hours booked line up on the right, in the theme's numeric font */
export const numeric = cn(
    cell,
    "justify-end font-(family-name:--dg-numeric-font) tabular-nums",
);

/** a booking fills the cell it spans, a tint of the theme's accent */
export const booking = cn(
    "flex h-full min-w-0 flex-1 flex-col justify-center rounded-(--dg-radius) px-2 my-1",
    "bg-[color-mix(in_oklab,var(--palette-accent)_14%,transparent)] text-palette-contrast",
);

export const title = "truncate font-medium";

export const time =
    "truncate text-[0.85em] font-(family-name:--dg-numeric-font) tabular-nums opacity-70";
