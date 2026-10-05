import type {
    CellState,
    HeaderCellState,
    HeaderRowState,
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

/** the columns' row (-1) closes the header with a line; the groups' row sits above it */
export const headerRow = (state: HeaderRowState) =>
    cn(
        "bg-(--dg-header-bg) text-palette-accent",
        state.rowIndex === -1 &&
            "border-b-(length:--dg-gridline) border-(--dg-gridline-color)",
    );

const active =
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]";

/**
 * a pinned cell is opaque and above the cells that scroll under it (stacking is the app's): the
 * base colour, then the tint of its row or header painted over it
 */
const pinned = "z-1 bg-palette-base";

/**
 * a pinned part's edge casts a shadow over the columns scrolling under it: the last column pinned
 * at the start on its right, the first pinned at the end on its left
 */
const pinnedEdge = (state: { pinnedSide: "start" | "end" | undefined }) =>
    state.pinnedSide === "end"
        ? "shadow-[-6px_0_8px_-6px_color-mix(in_oklab,var(--palette-contrast)_35%,transparent)]"
        : "shadow-[6px_0_8px_-6px_color-mix(in_oklab,var(--palette-contrast)_35%,transparent)]";

/** a group centred over its columns, a line under it */
export const headerCell = (state: HeaderCellState) =>
    cn(
        "flex px-(--dg-cell-padding) outline-none",
        "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
        "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
        state.group
            ? "items-center justify-center border-b-(length:--dg-gridline) text-palette-contrast"
            : "items-center",
        active,
        state.pinned && [
            pinned,
            "[background-image:linear-gradient(var(--dg-header-bg),var(--dg-header-bg))]",
        ],
        state.pinnedEdge && pinnedEdge(state),
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
        "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
        "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
        active,
        state.pinned && [
            pinned,
            state.rowIndex % 2 === 1 &&
                "[background-image:linear-gradient(var(--dg-row-alt-bg),var(--dg-row-alt-bg))]",
            "group-hover/row:[background-image:linear-gradient(var(--dg-row-hover-bg),var(--dg-row-hover-bg))]",
        ],
        state.pinnedEdge && pinnedEdge(state),
    );

/** numbers line up on the right, in the theme's numeric font (the summary pinned at the end) */
export const numeric = (state: CellState) =>
    cn(
        cell(state),
        "justify-end font-(family-name:--dg-numeric-font) tabular-nums",
    );
