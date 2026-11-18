import type { CellInfo, RowInfo } from "@fragiola/data-grid-vue";
import type { RowDragHandleState } from "@fragiola/data-grid-vue/row-reorder";
import { cn } from "#/lib/cn";

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

/** the app's own toolbar: the search, the keys, the live region, the buttons */
export const toolbar =
    "palette-surface flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-palette-accent/85 font-(family-name:--dg-font)";

export const icon = "size-4 opacity-70";

export const search = "w-48";

export const key =
    "rounded-sm border border-palette-line bg-palette-soft px-1.5 py-0.5 font-(family-name:--dg-numeric-font) text-[0.6875rem] text-palette-contrast";

/** the live region, shown too: what the last move did, or why rows do not move */
export const status = "ms-auto min-w-0 truncate text-palette-contrast";

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

export const headerRow =
    "bg-(--dg-header-bg) text-palette-accent border-b-(length:--dg-gridline) border-(--dg-gridline-color)";

const active =
    "data-active:focus-within:outline-(length:--dg-active-width) data-active:focus-within:outline-(--dg-active-line) data-active:focus-within:[outline-style:var(--dg-active-style)] data-active:focus-within:[outline-offset:calc(var(--dg-active-width)*-1)]";

/**
 * a pinned cell (`data-pinned`) is opaque and above the cells that scroll under it (stacking is the
 * app's)
 */
const pinned = "data-pinned:z-1 data-pinned:bg-palette-base";

export const headerCell = cn(
    "flex items-center gap-1.5 px-(--dg-cell-padding) outline-none",
    "data-sortable:cursor-pointer data-sortable:select-none data-sortable:hover:text-palette-contrast",
    "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
    active,
    pinned,
    "data-pinned:[background-image:linear-gradient(var(--dg-header-bg),var(--dg-header-bg))]",
);

export const sortIcon = "size-3.5 shrink-0";

/**
 * What a drag shows, all from the row's `data-*`: the dragged row dimmed, and the drop indicator,
 * a line inside the target on the side the row would land; by the row (`DataGrid.Rows` hands it
 * to its slot), every other one tinted.
 */
export const row = (row: RowInfo) =>
    cn(
        "group/row border-b-(length:--dg-gridline) border-(--dg-gridline-color) hover:bg-(--dg-row-hover-bg)",
        row.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
        "data-dragging:opacity-50",
        "data-[drop-target=before]:shadow-[inset_0_3px_0_var(--dg-active-line)]",
        "data-[drop-target=after]:shadow-[inset_0_-3px_0_var(--dg-active-line)]",
    );

/** by the cell (`DataGrid.Cells` hands it to its slot) */
export const cell = (cell: Pick<CellInfo, "rowIndex">) =>
    cn(
        "flex items-center gap-2 overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
        active,
        pinned,
        cell.rowIndex % 2 === 1 &&
            "data-pinned:[background-image:linear-gradient(var(--dg-row-alt-bg),var(--dg-row-alt-bg))]",
        "data-pinned:group-hover/row:[background-image:linear-gradient(var(--dg-row-hover-bg),var(--dg-row-hover-bg))]",
    );

/** the rank: the row's place, in the theme's numeric font */
export const rank = "font-(family-name:--dg-numeric-font) tabular-nums";

/**
 * The handle: a grip that takes the row (a hand over it, a closed one while it is held), quiet
 * until its row is hovered; dimmed where rows do not move (the grid sorted). `touch-none`: a
 * touch drags it instead of panning the page.
 */
export const handle = (state: RowDragHandleState) =>
    cn(
        "flex shrink-0 touch-none select-none items-center rounded-sm",
        state.reorderable
            ? "cursor-grab opacity-40 group-hover/row:opacity-100 data-dragging:cursor-grabbing data-dragging:opacity-100"
            : "cursor-not-allowed opacity-15",
    );

export const grip = "size-4";
