import type {
    CellState,
    HeaderCellState,
    HeaderRowState,
    RowState,
} from "@fragiola/data-grid-react";
import { cn } from "#/lib/cn";

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

/** the app's own toolbar: a hint and the buttons that open or close every group */
export const toolbar =
    "palette-surface flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-palette-accent/85 font-(family-name:--dg-font)";

/** the buttons sit at the toolbar's end */
export const toolbarStart = "ms-auto";

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

/** the columns' row (-1) closes the header with a line */
export const headerRow = (state: HeaderRowState) =>
    cn(
        "bg-(--dg-header-bg) text-palette-accent",
        state.rowIndex === -1 &&
            "border-b-(length:--dg-gridline) border-(--dg-gridline-color)",
    );

const active =
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]";

/** the rep is opaque and above the columns that scroll under it (stacking is the app's) */
const pinned = (state: { pinned: boolean; pinnedEdge: boolean }) =>
    state.pinned && [
        "z-1 bg-palette-base",
        state.pinnedEdge &&
            "shadow-[6px_0_8px_-6px_color-mix(in_oklab,var(--palette-contrast)_35%,transparent)]",
    ];

/**
 * A group's cell has no padding of its own: its label does, so the label keeps it where it sticks
 * to the view's start. Nothing in it clips (an `overflow` would hold the label in place). A
 * column spanning header rows keeps its label at the bottom, level with the others'.
 */
export const headerCell = (state: HeaderCellState) =>
    cn(
        "flex items-center outline-none",
        "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
        "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
        state.group
            ? "border-b-(length:--dg-gridline) text-palette-contrast"
            : "px-(--dg-cell-padding) justify-end",
        state.collapsed && "bg-palette-soft",
        state.rowSpan > 1 && "items-end pb-2",
        active,
        pinned(state),
        state.pinned &&
            "justify-start [background-image:linear-gradient(var(--dg-header-bg),var(--dg-header-bg))]",
    );

/** the label: as wide as its content (it moves inside its cell), the toggle before the name */
export const label =
    "inline-flex items-center gap-1 whitespace-nowrap px-(--dg-cell-padding)";

/** the toggle: a chevron pointing at the columns it opens, turned down while open */
export const toggle = cn(
    "grid size-6 place-items-center rounded-(--dg-radius) text-palette-accent",
    "hover:bg-palette-line/40 [&>svg]:size-4 [&>svg]:transition-transform [&>svg]:duration-(--dg-motion)",
    "aria-expanded:[&>svg]:rotate-90 rtl:[&>svg]:-scale-x-100",
);

export const row = (state: RowState) =>
    cn(
        "border-b-(length:--dg-gridline) border-(--dg-gridline-color) hover:bg-(--dg-row-hover-bg)",
        state.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

/** the active cell's outline sits inside it, so neighbours never cover it */
export const cell = (state: CellState) =>
    cn(
        "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
        "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
        active,
        pinned(state),
    );

/** numbers line up on the right, in the theme's numeric font */
export const numeric = (state: CellState) =>
    cn(
        cell(state),
        "justify-end font-(family-name:--dg-numeric-font) tabular-nums",
    );

/** a total stands out: a quarter's or a year's */
export const total = (state: CellState) =>
    cn(numeric(state), "bg-palette-soft/60 font-medium");
