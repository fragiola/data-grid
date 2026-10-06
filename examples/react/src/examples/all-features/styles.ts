import type {
    CellState,
    FillHandleState,
    HeaderCellState,
    RowState,
} from "@fragiola/data-grid-react";
import { cn } from "#/lib/cn";

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

/** the app's own toolbar: the keys, the live region */
export const toolbar =
    "palette-surface flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-palette-accent/85 font-(family-name:--dg-font)";

export const key =
    "rounded-sm border border-palette-line bg-palette-soft px-1.5 py-0.5 font-(family-name:--dg-numeric-font) text-[0.6875rem] text-palette-contrast";

/** the live region, shown too: what the last edit, paste or fill wrote */
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

/** opaque and above the rows: they scroll under it */
export const header = "z-10 bg-palette-base";

export const headerRow =
    "group/header bg-(--dg-header-bg) text-palette-accent border-b-(length:--dg-gridline) border-(--dg-gridline-color)";

const active =
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]";

/** a pinned cell is opaque and above the cells that scroll under it (stacking is the app's) */
const pinned = "z-1 bg-palette-base";

export const headerCell = (state: HeaderCellState) =>
    cn(
        "flex items-center gap-1.5 px-(--dg-cell-padding) outline-none",
        "data-sortable:cursor-pointer data-sortable:select-none",
        "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
        active,
        state.pinned && [
            pinned,
            "[background-image:linear-gradient(var(--dg-header-bg),var(--dg-header-bg))]",
        ],
    );

export const sortIcon = "size-3.5 shrink-0";

/** a resizer at the header cell's end edge, shown on hover, focus and drag */
export const resizer = cn(
    "absolute inset-y-0 end-0 w-2 cursor-col-resize touch-none select-none outline-none",
    "after:absolute after:inset-y-1.5 after:end-0 after:w-0.5 after:rounded-full after:bg-(--dg-active-line)",
    "after:opacity-0 group-hover/header:after:opacity-40 hover:after:opacity-100",
    "focus-visible:after:opacity-100 data-resizing:after:opacity-100",
);

export const row = (state: RowState) =>
    cn(
        "border-b-(length:--dg-gridline) border-(--dg-gridline-color)",
        state.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

/**
 * The range and the fill on a layer over the cell (a pinned cell's background tinted too); the
 * edited cell holds its editor edge to edge
 */
const marks = [
    "after:pointer-events-none after:absolute after:inset-0 after:border-(--dg-active-line)",
    "data-selected-cell:after:bg-[color-mix(in_oklch,var(--dg-active-line)_12%,transparent)]",
    "data-[range-edge~=top]:after:border-t-2",
    "data-[range-edge~=bottom]:after:border-b-2",
    "data-[range-edge~=start]:after:border-s-2",
    "data-[range-edge~=end]:after:border-e-2",
    "data-fill-target:after:border data-fill-target:after:border-dashed",
    "data-editing:px-0.5 data-editing:bg-palette-base data-editing:after:hidden",
];

export const cell = (state: CellState) =>
    cn(
        "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none select-none",
        state.columnIndex === 2 &&
            "justify-end font-(family-name:--dg-numeric-font) tabular-nums",
        active,
        marks,
        state.pinned && [
            pinned,
            state.rowIndex % 2 === 1 &&
                "[background-image:linear-gradient(var(--dg-row-alt-bg),var(--dg-row-alt-bg))]",
        ],
    );

/** an editor fills its cell */
export const editor = "h-full min-h-0 w-full rounded-sm px-2 text-sm";

export const select = "h-full w-full";

/** the fill handle: a square at its cell's bottom-end corner */
export const handle = (state: FillHandleState) =>
    cn(
        "absolute end-0 bottom-0 z-2 size-2 cursor-crosshair touch-none bg-(--dg-active-line)",
        state.filling && "opacity-60",
    );
