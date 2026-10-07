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

/** opaque: the rows scroll under it (its place above them is the grid's) */
export const header = "bg-palette-base";

export const headerRow = cn(
    "bg-(--dg-header-bg) text-palette-accent",
    "border-b-(length:--dg-gridline) border-(--dg-gridline-color)",
);

const active =
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]";

export const headerCell = (state: HeaderCellState) =>
    cn(
        "flex items-center gap-1.5 px-(--dg-cell-padding) outline-none",
        "data-sortable:cursor-pointer data-sortable:select-none",
        "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
        // the checkbox column's cell centres its box
        state.columnIndex === 0 && "justify-center",
        active,
    );

/** the app's sort status: a triangle and, sorting on several columns, a small priority */
export const sortStatus =
    "flex items-center text-[0.7em] text-palette-contrast";

export const priority = "ms-0.5 text-palette-accent/70 tabular-nums";

/** a native checkbox, tinted with the theme's line colour */
export const checkbox = "size-4 cursor-pointer accent-(--dg-active-line)";

/** a completed task is tinted; a selected row reads stronger (its `data-selected`) */
export const row = (state: RowState, completed: boolean) =>
    cn(
        "border-b-(length:--dg-gridline) border-(--dg-gridline-color) hover:bg-(--dg-row-hover-bg)",
        state.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
        completed && "palette-green bg-palette-soft text-palette-contrast",
        "data-selected:bg-[color-mix(in_oklch,var(--dg-active-line)_14%,transparent)]",
    );

/** a high priority stands out in its cell; the edited cell holds its editor edge to edge */
export const cell = (state: CellState, high: boolean) =>
    cn(
        "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
        state.columnIndex === 0 && "justify-center",
        high && "palette-danger font-semibold text-palette-contrast",
        "data-editing:px-0.5",
        active,
    );

/** an editor fills its cell */
export const editor = "h-full min-h-0 w-full rounded-sm px-2 text-sm";
