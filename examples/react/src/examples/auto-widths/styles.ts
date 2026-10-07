import type { RowState } from "@fragiola/data-grid-react";
import { cn } from "#/lib/cn";

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

/** the app's own toolbar: the grid's width, the keys, the buttons */
export const toolbar =
    "palette-surface flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-palette-accent/85 font-(family-name:--dg-font)";

export const key =
    "rounded-sm border border-palette-line bg-palette-soft px-1.5 py-0.5 font-(family-name:--dg-numeric-font) text-[0.6875rem] text-palette-contrast";

/** the width slider: a native range input in the theme's accent */
export const slider = "flex items-center gap-2";

export const range = "w-28 accent-(--dg-active-line)";

export const sliderValue =
    "w-9 tabular-nums font-(family-name:--dg-numeric-font) text-palette-contrast";

export const buttons = "ms-auto flex items-center gap-2";

/** what the grid sizes (its automatic widths) and what the app keeps (the widths a person set) */
export const readouts =
    "flex flex-wrap gap-x-4 gap-y-1 text-xs text-palette-accent/85 font-(family-name:--dg-numeric-font) tabular-nums";

export const readout = "min-w-0 truncate text-palette-contrast";

/**
 * the scroll container: the theme's frame, font and size. Its width is the slider's (inline,
 * the one value the app changes); `self-start` keeps it at that width in the column
 */
export const root = cn(
    "palette-raised min-h-0 flex-1 self-start bg-palette-base text-palette-contrast",
    "rounded-(--dg-radius) border-(length:--dg-border) border-palette-line shadow-(--dg-shadow)",
    "font-(family-name:--dg-font) text-(length:--dg-font-size)",
);

/** the grid is the tab stop until a cell is active */
export const grid =
    "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--dg-active-line)";

/** opaque: the rows scroll under it (its place above them is the grid's) */
export const header = "bg-palette-base";

/** the columns' row closes the header with a line */
export const headerRow =
    "bg-(--dg-header-bg) text-palette-accent border-b-(length:--dg-gridline) border-(--dg-gridline-color)";

const active =
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]";

/**
 * `group/header`: its handle shows while the cell is hovered. The cell being resized
 * (`data-resizing`) reads as the one in hand.
 */
export const headerCell = cn(
    "group/header flex min-w-0 items-center px-(--dg-cell-padding) outline-none",
    "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
    "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
    "data-resizing:text-palette-contrast",
    active,
);

/**
 * The handle: a strip at the header cell's right edge (the cell is positioned), its line hidden
 * until the cell is hovered, the handle focused (F2 on the header) or dragged. `touch-none`: a
 * touch drags it instead of panning the page.
 */
export const resizer = cn(
    "absolute inset-y-0 right-0 w-2 cursor-col-resize touch-none select-none outline-none",
    "after:absolute after:inset-y-1.5 after:right-0 after:w-0.5 after:rounded-full after:bg-(--dg-active-line)",
    "after:opacity-0 after:transition-opacity after:duration-(--dg-motion)",
    "group-hover/header:after:opacity-40 hover:after:opacity-100",
    "focus-visible:after:opacity-100 data-resizing:after:opacity-100",
);

export const row = (state: RowState) =>
    cn(
        "border-b-(length:--dg-gridline) border-(--dg-gridline-color) hover:bg-(--dg-row-hover-bg)",
        state.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

/**
 * the active cell's outline sits inside it, so neighbours never cover it; `whitespace-nowrap`:
 * a fit measures a cell's content on one line
 */
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
