import type {
    CellState,
    HeaderCellState,
    RowState,
} from "@fragiola/data-grid-react";
import { cn } from "#/lib/cn";

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

/** the app's own toolbar: how the details get their heights */
export const toolbar =
    "palette-surface flex flex-wrap items-center gap-4 text-xs text-palette-contrast font-(family-name:--dg-font)";

export const option = "flex items-center gap-2";
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
export const header = "z-20 bg-palette-base";

export const headerRow = cn(
    "bg-(--dg-header-bg) text-palette-accent",
    "border-b-(length:--dg-gridline) border-(--dg-gridline-color)",
);

const active =
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]";

/**
 * a pinned cell is opaque and above the cells that scroll under it (stacking is the app's): the
 * base colour, then its row's tint painted over it; the last one ends on a line
 */
const pinned = "z-1 bg-palette-base";
const pinnedEdge =
    "border-e-(length:--dg-gridline) border-(--dg-gridline-color)";
/** a row's tint over a pinned cell's base (written out whole: Tailwind reads class names as text) */
const TINTS = {
    header: "[background-image:linear-gradient(var(--dg-header-bg),var(--dg-header-bg))]",
    alt: "[background-image:linear-gradient(var(--dg-row-alt-bg),var(--dg-row-alt-bg))]",
    /** from the row's `data-expanded` (`group/row`): a cell's own state does not hold it */
    expanded:
        "group-data-expanded/row:[background-image:linear-gradient(var(--dg-row-hover-bg),var(--dg-row-hover-bg))]",
} as const;

export const headerCell = (state: HeaderCellState) =>
    cn(
        "flex items-center px-(--dg-cell-padding) outline-none",
        "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
        active,
        state.pinned && [pinned, TINTS.header],
        state.pinnedEdge && pinnedEdge,
    );

/** an expanded order is tinted, its detail below it on the base colour */
export const row = (state: RowState) =>
    cn(
        "group/row border-b-(length:--dg-gridline) border-(--dg-gridline-color)",
        state.expanded
            ? "bg-(--dg-row-hover-bg)"
            : state.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

/** the active cell's outline sits inside it, so neighbours never cover it */
export const cell = (state: CellState) =>
    cn(
        "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
        active,
        state.pinned && [
            pinned,
            state.rowIndex % 2 === 1 && TINTS.alt,
            TINTS.expanded,
        ],
        state.pinnedEdge && pinnedEdge,
    );

export const expander = cn(
    "grid size-6 place-items-center rounded-(--dg-radius) text-palette-accent",
    "hover:bg-palette-line/40 [&>svg]:transition-transform [&>svg]:duration-(--dg-motion)",
    "aria-expanded:[&>svg]:rotate-90",
);

/** the detail: as wide as the view (the grid's), on the base colour */
export const detail = cn(
    "overflow-hidden bg-palette-base",
    "border-t-(length:--dg-gridline) border-(--dg-gridline-color)",
);

/** its content, laid out by the app: a summary beside the items */
export const detailContent = "flex h-full items-start gap-6 px-4 py-3";

export const summary = "flex w-52 shrink-0 flex-col gap-1 text-xs";
export const summaryTitle = "text-sm font-(--dg-header-weight)";
export const summaryLine = "flex justify-between gap-2 text-palette-accent";
export const summaryValue = "tabular-nums text-palette-contrast";

export const status = (value: string) =>
    cn(
        "rounded-full border border-palette-line px-2 py-0.5 text-xs",
        value === "Delivered" && "text-palette-accent",
    );

/** the items grid: a smaller frame of its own, sized by its rows */
export const innerRoot = cn(
    "palette-surface bg-palette-base text-palette-contrast",
    "rounded-(--dg-radius) border-(length:--dg-border) border-palette-line text-xs",
);

export const innerHeader = "z-10 bg-palette-base";

export const innerHeaderRow =
    "bg-(--dg-header-bg) text-palette-accent border-b border-palette-line";

export const innerHeaderCell = cn(
    "flex items-center px-2 font-(--dg-header-weight) outline-none",
    active,
);

export const innerRow = "border-b border-palette-line/60";

export const innerCell = cn(
    "flex items-center overflow-hidden whitespace-nowrap px-2 outline-none",
    active,
);

export const money = "ms-auto tabular-nums";
