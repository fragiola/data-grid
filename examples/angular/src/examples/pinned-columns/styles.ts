import type {
    CellInfo,
    HeaderCellInfo,
    HeaderRowInfo,
    RowInfo,
} from "@fragiola/data-grid-angular";
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

/**
 * by the header row (`[dataGridHeaderRows]` hands it to its template): the columns' row (-1) closes the
 * header with a line; the groups' row sits above it
 */
export const headerRow = <TRow>(row: HeaderRowInfo<TRow>) =>
    cn(
        "bg-(--dg-header-bg) text-palette-accent",
        row.rowIndex === -1 &&
            "border-b-(length:--dg-gridline) border-(--dg-gridline-color)",
    );

const active =
    "data-active:focus-within:outline-(length:--dg-active-width) data-active:focus-within:outline-(--dg-active-line) data-active:focus-within:[outline-style:var(--dg-active-style)] data-active:focus-within:[outline-offset:calc(var(--dg-active-width)*-1)]";

/**
 * a pinned cell (`data-pinned`) is opaque and above the cells that scroll under it (stacking is
 * the app's): the base colour, then the tint of its row or header painted over it
 */
const pinned = "data-pinned:z-1 data-pinned:bg-palette-base";

/**
 * a pinned part's edge (`data-pinned-edge`) casts a shadow over the columns scrolling under it:
 * the last column pinned at the start on its right, the first pinned at the end on its left
 */
const pinnedEdge = cn(
    "data-pinned-edge:data-[pinned=end]:shadow-[-6px_0_8px_-6px_color-mix(in_oklab,var(--palette-contrast)_35%,transparent)]",
    "data-pinned-edge:data-[pinned=start]:shadow-[6px_0_8px_-6px_color-mix(in_oklab,var(--palette-contrast)_35%,transparent)]",
);

/**
 * by the cell `[dataGridHeaderCells]` hands to its template: a group centred over its columns, a line
 * under it
 */
export const headerCell = <TRow>(cell: HeaderCellInfo<TRow>) =>
    cn(
        "flex px-(--dg-cell-padding) outline-none",
        "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
        "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
        cell.group
            ? "items-center justify-center border-b-(length:--dg-gridline) text-palette-contrast"
            : "items-center",
        active,
        pinned,
        "data-pinned:[background-image:linear-gradient(var(--dg-header-bg),var(--dg-header-bg))]",
        pinnedEdge,
    );

/** by the row (`[dataGridRows]` hands it to its template); `group/row`: a pinned cell shows its row's hover too */
export const row = (row: RowInfo) =>
    cn(
        "group/row border-b-(length:--dg-gridline) border-(--dg-gridline-color) hover:bg-(--dg-row-hover-bg)",
        row.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

/**
 * by the cell `[dataGridCells]` hands to its template: the active cell's outline sits inside it, so
 * neighbours never cover it
 */
export const cell = <TRow>(cell: CellInfo<TRow>) =>
    cn(
        "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
        "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
        active,
        pinned,
        cell.rowIndex % 2 === 1 &&
            "data-pinned:[background-image:linear-gradient(var(--dg-row-alt-bg),var(--dg-row-alt-bg))]",
        "data-pinned:group-hover/row:[background-image:linear-gradient(var(--dg-row-hover-bg),var(--dg-row-hover-bg))]",
        pinnedEdge,
    );

/** numbers line up on the right, in the theme's numeric font (the summary pinned at the end) */
export const numeric = <TRow>(info: CellInfo<TRow>) =>
    cn(
        cell(info),
        "justify-end font-(family-name:--dg-numeric-font) tabular-nums",
    );
