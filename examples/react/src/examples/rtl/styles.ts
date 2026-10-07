import type {
    CellState,
    ColumnResizerState,
    HeaderCellState,
    HeaderRowState,
    RowState,
} from "@fragiola/data-grid-react";
import { cn } from "#/lib/cn";

// Every side here is logical (start and end, `border-e`, `end-0`): the grid's root carries `dir`,
// so the lines, the handles and the shadows mirror with it. Only a shadow's offset has no logical
// form: it is given both ways (`ltr:`, `rtl:`).

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

/** the app's own toolbar: the direction, the keys */
export const toolbar =
    "palette-surface flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-palette-accent/85 font-(family-name:--dg-font)";

export const direction = "flex items-center gap-2 text-palette-contrast";

export const key =
    "rounded-sm border border-palette-line bg-palette-soft px-1.5 py-0.5 font-(family-name:--dg-numeric-font) text-[0.6875rem] text-palette-contrast";

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
 * a pinned part's edge casts a shadow over the columns scrolling under it, toward them: after the
 * name pinned at the start, before the salary pinned at the end, whichever side that is
 */
const pinnedEdge = (state: { pinnedSide: "start" | "end" | undefined }) =>
    state.pinnedSide === "end"
        ? "ltr:shadow-[-6px_0_8px_-6px_color-mix(in_oklab,var(--palette-contrast)_35%,transparent)] rtl:shadow-[6px_0_8px_-6px_color-mix(in_oklab,var(--palette-contrast)_35%,transparent)]"
        : "ltr:shadow-[6px_0_8px_-6px_color-mix(in_oklab,var(--palette-contrast)_35%,transparent)] rtl:shadow-[-6px_0_8px_-6px_color-mix(in_oklab,var(--palette-contrast)_35%,transparent)]";

/**
 * What a drag shows: a hand over a cell that moves, the dragged cell dimmed, and the drop
 * indicator, a line inside the target on the side the column would land (its start: the right
 * right to left).
 */
const reorder = cn(
    "data-reorderable:cursor-grab data-reorderable:select-none data-reorderable:touch-pan-y data-reorderable:data-dragging:cursor-grabbing",
    "data-dragging:opacity-50",
    "ltr:data-[drop-target=before]:shadow-[inset_3px_0_0_var(--dg-active-line)]",
    "ltr:data-[drop-target=after]:shadow-[inset_-3px_0_0_var(--dg-active-line)]",
    "rtl:data-[drop-target=before]:shadow-[inset_-3px_0_0_var(--dg-active-line)]",
    "rtl:data-[drop-target=after]:shadow-[inset_3px_0_0_var(--dg-active-line)]",
);

/** `group/header`: its handle shows while the cell is hovered; a group centred over its columns */
export const headerCell = (state: HeaderCellState) =>
    cn(
        "group/header flex min-w-0 px-(--dg-cell-padding) outline-none",
        "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
        "border-e-(length:--dg-gridline) border-(--dg-gridline-color)",
        state.group
            ? "items-center justify-center border-b-(length:--dg-gridline) text-palette-contrast"
            : "items-center",
        state.rowSpan > 1 && "items-end pb-2",
        active,
        state.pinned && [
            pinned,
            "[background-image:linear-gradient(var(--dg-header-bg),var(--dg-header-bg))]",
        ],
        state.pinnedEdge && pinnedEdge(state),
        reorder,
    );

/**
 * The handle: a strip at the edge of the header cell it moves (`state.edge`: the end edge, the
 * left one right to left; the start edge of the salary pinned at the end, its boundary with the
 * columns that scroll; the cell is positioned, absolute or sticky), its line hidden until the
 * cell is hovered, the handle focused or dragged. `touch-none`: a touch drags it instead of
 * panning the page.
 */
export const resizer = (state: ColumnResizerState) =>
    cn(
        "absolute inset-y-0 w-2 cursor-col-resize touch-none select-none outline-none",
        "after:absolute after:inset-y-1.5 after:w-0.5 after:rounded-full after:bg-(--dg-active-line)",
        state.edge === "start" ? "start-0 after:start-0" : "end-0 after:end-0",
        "after:opacity-0 after:transition-opacity after:duration-(--dg-motion)",
        "group-hover/header:after:opacity-40 hover:after:opacity-100",
        "focus-visible:after:opacity-100 data-resizing:after:opacity-100",
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
        "border-e-(length:--dg-gridline) border-(--dg-gridline-color)",
        active,
        state.pinned && [
            pinned,
            state.rowIndex % 2 === 1 &&
                "[background-image:linear-gradient(var(--dg-row-alt-bg),var(--dg-row-alt-bg))]",
            "group-hover/row:[background-image:linear-gradient(var(--dg-row-hover-bg),var(--dg-row-hover-bg))]",
        ],
        state.pinnedEdge && pinnedEdge(state),
    );

/** numbers line up at the end, in the theme's numeric font */
export const numeric = (state: CellState) =>
    cn(
        cell(state),
        "justify-end font-(family-name:--dg-numeric-font) tabular-nums",
    );
