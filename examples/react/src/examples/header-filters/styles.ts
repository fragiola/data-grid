import type { RowState } from "@fragiola/data-grid-react";
import { cn } from "#/lib/cn";

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

export const toolbar =
    "palette-surface flex flex-wrap items-center gap-3 text-sm text-palette-contrast font-(family-name:--dg-font)";

export const toggle = "flex items-center gap-1.5";

export const count = "ms-auto text-xs text-palette-accent/85 tabular-nums";

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

const active =
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]";

/** the name on top, the filter below: a column of two lines */
export const headerCell = cn(
    "flex flex-col justify-center gap-1.5 px-(--dg-cell-padding) outline-none",
    "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
    "data-sortable:cursor-pointer data-sortable:select-none",
    "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
    active,
    // the cell whose controls have the keys
    "data-interacting:bg-palette-soft",
);

export const title = "flex items-center gap-1.5 truncate";

export const sortIcon = "size-3.5 shrink-0";

/** the filters read as the app's fields, not as header text */
export const textFilter =
    "h-7 w-full cursor-text rounded-sm border border-palette-line bg-palette-base px-2 text-sm font-normal normal-case tracking-normal";

export const selectFilter =
    "h-7 w-full min-w-0 text-sm font-normal normal-case tracking-normal";

export const row = (state: RowState) =>
    cn(
        "border-b-(length:--dg-gridline) border-(--dg-gridline-color) hover:bg-(--dg-row-hover-bg)",
        state.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

/** the active cell's outline sits inside it, so neighbours never cover it */
export const cell = cn(
    "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
    "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
    active,
);

/** no row left: the app's own message in the body */
export const empty =
    "flex items-center justify-center text-sm text-palette-accent/85";
