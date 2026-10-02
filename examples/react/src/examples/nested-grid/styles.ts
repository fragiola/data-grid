import type { RowState } from "@fragiola/data-grid-react";
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

export const headerCell = cn(
    "flex items-center px-(--dg-cell-padding) outline-none",
    "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]",
);

export const row = (state: RowState) =>
    cn(
        "border-b-(length:--dg-gridline) border-(--dg-gridline-color) transition-colors duration-(--dg-motion) hover:bg-(--dg-row-hover-bg)",
        state.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

/** the active cell's outline sits inside it, so neighbours never cover it */
export const cell = cn(
    "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]",
);

/** the cell holding a nested grid: content at the top, the grid inside it */
export const itemsCell = cn(
    "flex items-start overflow-hidden px-(--dg-cell-padding) py-2 outline-none",
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]",
);

/** the nested grid: a smaller frame of its own, sized by the row it sits in */
export const innerRoot = cn(
    "palette-surface h-[104px] w-full bg-palette-base text-palette-contrast",
    "rounded-(--dg-radius) border-(length:--dg-border) border-palette-line text-xs",
);

export const innerHeader = "z-10 bg-palette-base";

export const innerHeaderRow =
    "bg-(--dg-header-bg) text-palette-accent border-b border-palette-line";

export const innerHeaderCell =
    "flex items-center px-2 font-(--dg-header-weight) outline-none";

export const innerRow = "border-b border-palette-line/60";

export const innerCell = cn(
    "flex items-center overflow-hidden whitespace-nowrap px-2 outline-none",
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]",
);

export const money = "ms-auto tabular-nums";

/** the items column holds a nested grid; the others are plain cells */
export const cellFor = (columnKey: string) =>
    columnKey === "items" ? itemsCell : cell;
