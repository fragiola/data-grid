import type {
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
 * A group: its label centred over its columns, a line under it; its padding is its label's, which
 * keeps it where the label sticks to the view's start, and nothing in it clips (an `overflow`
 * would hold the label in place). A column spanning both header rows keeps its label at the
 * bottom, level with the other columns'. By the cell `[dataGridHeaderCells]` hands to its template.
 */
export const headerCell = <TRow>(cell: HeaderCellInfo<TRow>) =>
    cn(
        "flex outline-none",
        "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
        "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
        cell.group
            ? "items-center justify-center border-b-(length:--dg-gridline) text-palette-contrast"
            : "items-center px-(--dg-cell-padding)",
        cell.rowSpan > 1 && "items-end pb-2",
        active,
    );

/** a group's label: as wide as its name (it moves inside its cell) */
export const label = "whitespace-nowrap px-(--dg-cell-padding)";

/** by the row (`[dataGridRows]` hands it to its template): every other one tinted */
export const row = (row: RowInfo) =>
    cn(
        "border-b-(length:--dg-gridline) border-(--dg-gridline-color) hover:bg-(--dg-row-hover-bg)",
        row.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

/** the active cell's outline sits inside it, so neighbours never cover it */
export const cell = cn(
    "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
    "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
    active,
);

/** numbers line up on the right, in the theme's numeric font */
export const numeric = cn(
    cell,
    "justify-end font-(family-name:--dg-numeric-font) tabular-nums",
);
