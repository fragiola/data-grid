import type {
    CellState,
    HeaderCellState,
    RowState,
} from "@fragiola/data-grid-react";
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
 * a pinned cell is opaque and above the cells that scroll under it (stacking is the app's): the
 * base colour, then the tint its row or header shows through
 */
const pinned = "z-1 bg-palette-base";

/** the last pinned column ends on a firmer line, so the columns scrolling under it read as such */
const pinnedEdge = "border-r-2 border-r-palette-line";

export const headerCell = (state: HeaderCellState) =>
    cn(
        "flex items-center px-(--dg-cell-padding) outline-none",
        "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
        "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
        "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]",
        state.pinned && [
            pinned,
            "[background-image:linear-gradient(var(--dg-header-bg),var(--dg-header-bg))]",
        ],
        state.pinnedEdge && pinnedEdge,
    );

/** `group/row`: a pinned cell shows its row's hover too */
export const row = (state: RowState) =>
    cn(
        "group/row border-b-(length:--dg-gridline) border-(--dg-gridline-color) hover:bg-(--dg-row-hover-bg)",
        state.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

/** the active cell's outline sits inside it, so neighbours never cover it */
export const cell = (state: CellState) =>
    cn(
        "flex items-center justify-end overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
        "font-(family-name:--dg-numeric-font) tabular-nums",
        "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
        "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]",
        state.pinned && [
            pinned,
            state.rowIndex % 2 === 1 &&
                "[background-image:linear-gradient(var(--dg-row-alt-bg),var(--dg-row-alt-bg))]",
            "group-hover/row:[background-image:linear-gradient(var(--dg-row-hover-bg),var(--dg-row-hover-bg))]",
        ],
        state.pinnedEdge && pinnedEdge,
    );
