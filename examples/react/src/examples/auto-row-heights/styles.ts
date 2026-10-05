import type {
    CellState,
    HeaderCellState,
    RowState,
} from "@fragiola/data-grid-react";
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

/** opaque and above the rows: they scroll under it */
export const header = "z-10 bg-palette-base";

export const headerRow = cn(
    "bg-(--dg-header-bg) text-palette-accent",
    "border-b-(length:--dg-gridline) border-(--dg-gridline-color)",
);

const active =
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]";

/** a pinned cell is opaque and above the cells that scroll under it (stacking is the app's) */
const pinned = (state: { pinned: boolean }) =>
    state.pinned && "z-1 bg-palette-base";

export const headerCell = (state: HeaderCellState) =>
    cn(
        "flex items-center px-(--dg-cell-padding) outline-none",
        "data-sortable:cursor-pointer data-sortable:select-none data-sortable:hover:text-palette-contrast",
        "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
        active,
        pinned(state),
        state.pinned &&
            "[background-image:linear-gradient(var(--dg-header-bg),var(--dg-header-bg))]",
    );

/** a row's line is part of its height: the grid measures the whole row */
export const row = (state: RowState) =>
    cn(
        "border-b-(length:--dg-gridline) border-(--dg-gridline-color) hover:bg-(--dg-row-hover-bg)",
        state.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

/**
 * the cells set the row's height: their text wraps (no `nowrap`), and their padding counts; they
 * start at the row's top, every one as tall as the tallest
 */
export const cell = (state: CellState) =>
    cn(
        "flex items-start px-(--dg-cell-padding) py-2 leading-5 outline-none",
        active,
        pinned(state),
        state.pinned &&
            state.rowIndex % 2 === 1 &&
            "[background-image:linear-gradient(var(--dg-row-alt-bg),var(--dg-row-alt-bg))]",
    );

export const skills = "flex flex-wrap gap-1";

export const skill =
    "rounded-full border border-palette-line px-2 text-xs leading-5 text-palette-accent";
