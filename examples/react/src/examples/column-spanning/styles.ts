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

export const headerRow =
    "bg-(--dg-header-bg) text-palette-accent border-b-(length:--dg-gridline) border-(--dg-gridline-color)";

const active =
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]";

/**
 * a pinned cell is opaque and above the cells that scroll under it (stacking is the app's), a
 * shadow on its part's edge
 */
const pinned = (state: {
    pinned: boolean;
    pinnedEdge: boolean;
    pinnedSide: "start" | "end" | undefined;
}) =>
    state.pinned && [
        "z-1 bg-palette-base",
        state.pinnedEdge &&
            (state.pinnedSide === "end"
                ? "shadow-[-6px_0_8px_-6px_color-mix(in_oklab,var(--palette-contrast)_35%,transparent)]"
                : "shadow-[6px_0_8px_-6px_color-mix(in_oklab,var(--palette-contrast)_35%,transparent)]"),
    ];

/** a header cell spanning two hours (`aria-colspan`) centres its range over them */
export const headerCell = (state: HeaderCellState) =>
    cn(
        "flex items-center px-(--dg-cell-padding) outline-none",
        "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
        "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
        state.columnSpan > 1 && "justify-center",
        active,
        pinned(state),
        state.pinned &&
            "[background-image:linear-gradient(var(--dg-header-bg),var(--dg-header-bg))]",
    );

export const row = (state: RowState) =>
    cn(
        "group/row border-b-(length:--dg-gridline) border-(--dg-gridline-color) hover:bg-(--dg-row-hover-bg)",
        state.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

/** the active cell's outline sits inside it: a booking's covers the hours it spans */
export const cell = (state: CellState) =>
    cn(
        "flex items-center overflow-hidden whitespace-nowrap px-1 outline-none",
        "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
        active,
        pinned(state),
        state.pinned && "px-(--dg-cell-padding)",
    );

/** the hours booked line up on the right, in the theme's numeric font */
export const numeric = (state: CellState) =>
    cn(
        cell(state),
        "justify-end font-(family-name:--dg-numeric-font) tabular-nums",
    );

/** a booking fills the cell it spans, a tint of the theme's accent */
export const booking = cn(
    "flex h-full min-w-0 flex-1 flex-col justify-center rounded-(--dg-radius) px-2 my-1",
    "bg-[color-mix(in_oklab,var(--palette-accent)_14%,transparent)] text-palette-contrast",
);

export const title = "truncate font-medium";

export const time =
    "truncate text-[0.85em] font-(family-name:--dg-numeric-font) tabular-nums opacity-70";
