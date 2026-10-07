import type { RowState } from "@fragiola/data-grid-react";
import { cn } from "#/lib/cn";

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

export const toolbar =
    "flex flex-wrap items-center gap-1 text-sm font-(family-name:--dg-font)";

export const legend = "float-left me-2 text-palette-accent/80";

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

export const headerCell = cn(
    "flex items-center px-(--dg-cell-padding) outline-none",
    "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
    active,
);

/**
 * The animation: while a new height is in flight, a row eases from its old top and height to the
 * new ones the grid gives it (its structural style); never during a scroll, and never with
 * reduced motion
 */
export const row = (state: RowState, animating: boolean) =>
    cn(
        "border-b-(length:--dg-gridline) border-(--dg-gridline-color) hover:bg-(--dg-row-hover-bg)",
        animating &&
            "transition-[top,height] duration-300 ease-out motion-reduce:transition-none",
        state.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

/** the content sits at the top of a tall row; what does not fit yet is clipped */
export const cell = cn(
    "flex items-start overflow-hidden px-(--dg-cell-padding) py-1.5 outline-none",
    active,
);

export const stack = "flex min-w-0 flex-col";

export const secondary = "truncate text-xs text-palette-accent/80";
