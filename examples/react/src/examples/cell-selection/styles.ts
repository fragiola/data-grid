import type {
    CellState,
    HeaderCellState,
    RowState,
} from "@fragiola/data-grid-react";
import { cn } from "#/lib/cn";

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

/** the app's own toolbar: the keys, the selection's sum, the live region */
export const toolbar =
    "palette-surface flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-palette-accent/85 font-(family-name:--dg-font)";

export const key =
    "rounded-sm border border-palette-line bg-palette-soft px-1.5 py-0.5 font-(family-name:--dg-numeric-font) text-[0.6875rem] text-palette-contrast";

/** what the app works out of the range: its size and the sum of its amounts */
export const summary =
    "font-(family-name:--dg-numeric-font) tabular-nums text-palette-contrast";

/** the live region, shown too: what the last paste did */
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
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]";

/** a pinned cell is opaque and above the cells that scroll under it (stacking is the app's) */
const pinned = "z-1 bg-palette-base";

export const headerCell = (state: HeaderCellState) =>
    cn(
        "flex items-center px-(--dg-cell-padding) outline-none",
        "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
        state.columnIndex > 1 && "justify-end",
        active,
        state.pinned && [
            pinned,
            "[background-image:linear-gradient(var(--dg-header-bg),var(--dg-header-bg))]",
        ],
    );

export const row = (state: RowState) =>
    cn(
        "group/row border-b-(length:--dg-gridline) border-(--dg-gridline-color)",
        state.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

/**
 * The range, all from the cell's `data-*`, on a layer over the cell (`after:`, so a pinned cell's
 * opaque background is tinted too): a tint on each cell in it, and a line on the edges it sits on
 * (`data-range-edge` holds them; logical sides, mirrored right to left).
 */
const range = [
    "after:pointer-events-none after:absolute after:inset-0 after:border-(--dg-active-line)",
    "data-selected-cell:after:bg-[color-mix(in_oklch,var(--dg-active-line)_14%,transparent)]",
    "data-[range-edge~=top]:after:border-t-2",
    "data-[range-edge~=bottom]:after:border-b-2",
    "data-[range-edge~=start]:after:border-s-2",
    "data-[range-edge~=end]:after:border-e-2",
];

export const cell = (state: CellState) =>
    cn(
        "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none select-none",
        state.columnIndex > 1 &&
            "justify-end font-(family-name:--dg-numeric-font) tabular-nums",
        active,
        range,
        state.pinned && [
            pinned,
            state.rowIndex % 2 === 1 &&
                "[background-image:linear-gradient(var(--dg-row-alt-bg),var(--dg-row-alt-bg))]",
        ],
    );

/** the computed total: set apart from the amounts a person types or pastes */
export const total = "font-semibold";

export const owner = "truncate text-palette-accent";
