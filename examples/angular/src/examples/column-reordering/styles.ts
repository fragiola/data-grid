import type {
    CellInfo,
    HeaderCellInfo,
    HeaderRowInfo,
    RowInfo,
} from "@fragiola/data-grid-angular";
import { cn } from "#/lib/cn";

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

/** the app's own toolbar: the keys, the live region, the reset */
export const toolbar =
    "palette-surface flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-palette-accent/85 font-(family-name:--dg-font)";

export const key =
    "rounded-sm border border-palette-line bg-palette-soft px-1.5 py-0.5 font-(family-name:--dg-numeric-font) text-[0.6875rem] text-palette-contrast";

/** the live region, shown too: what the last move did */
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

/**
 * by the header row (`[dataGridHeaderRows]` hands it to its template): the columns' row (-1) closes the
 * header with a line; the groups' row sits above it
 */
export const headerRow = <TRow>(row: HeaderRowInfo<TRow>) =>
    cn(
        "bg-(--dg-header-bg) text-palette-accent",
        row.rowIndex === -1 &&
            "border-b-(length:--dg-gridline) border-(--dg-gridline-color)",
    );

const active =
    "data-active:focus-within:outline-(length:--dg-active-width) data-active:focus-within:outline-(--dg-active-line) data-active:focus-within:[outline-style:var(--dg-active-style)] data-active:focus-within:[outline-offset:calc(var(--dg-active-width)*-1)]";

/**
 * a pinned cell (`data-pinned`) is opaque and above the cells that scroll under it (stacking is
 * the app's): the base colour, then the tint of its row or header painted over it
 */
const pinned = "data-pinned:z-1 data-pinned:bg-palette-base";

/**
 * the last pinned column (`data-pinned-edge`) ends on a shadow, so the columns scrolling under it
 * read as such
 */
const pinnedEdge =
    "data-pinned-edge:shadow-[6px_0_8px_-6px_color-mix(in_oklab,var(--palette-contrast)_35%,transparent)]";

/**
 * What a drag shows, all from the header cell's `data-*`: a hand over a cell that moves (a
 * closed one while it is held), the dragged cell dimmed, and the drop indicator, a line inside
 * the target on the side the column would land (over a pinned edge's shadow).
 */
const reorder = cn(
    "data-reorderable:cursor-grab data-reorderable:select-none data-reorderable:touch-pan-y data-reorderable:data-dragging:cursor-grabbing",
    "data-dragging:opacity-50",
    "data-[drop-target=before]:shadow-[inset_3px_0_0_var(--dg-active-line)]",
    "data-[drop-target=after]:shadow-[inset_-3px_0_0_var(--dg-active-line)]",
);

/**
 * `group/header`: its handle shows while the cell is hovered. A group is centred over its
 * columns; a column spanning both header rows keeps its label level with the others'. By the
 * cell `[dataGridHeaderCells]` hands to its template.
 */
export const headerCell = <TRow>(cell: HeaderCellInfo<TRow>) =>
    cn(
        "group/header flex min-w-0 gap-1.5 px-(--dg-cell-padding) outline-none",
        "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
        "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
        cell.group
            ? "items-center justify-center border-b-(length:--dg-gridline) text-palette-contrast"
            : "items-center",
        cell.rowSpan > 1 && "items-end pb-2",
        active,
        pinned,
        "data-pinned:[background-image:linear-gradient(var(--dg-header-bg),var(--dg-header-bg))]",
        pinnedEdge,
        reorder,
    );

/** the grip: where a header cell can be taken, quieter than its label */
export const grip = "size-3.5 shrink-0 opacity-40";

export const label = "min-w-0 truncate";

export const sortIcon = "size-3.5 shrink-0";

/**
 * The handle: a strip at the header cell's right edge (the cell is positioned, absolute or
 * sticky), its line hidden until the cell is hovered, the handle focused (F2 on the header) or
 * dragged. `touch-none`: a touch drags it instead of panning the page.
 */
export const resizer = cn(
    "absolute inset-y-0 right-0 w-2 cursor-col-resize touch-none select-none outline-none",
    "after:absolute after:inset-y-1.5 after:right-0 after:w-0.5 after:rounded-full after:bg-(--dg-active-line)",
    "after:opacity-0 after:transition-opacity after:duration-(--dg-motion)",
    "group-hover/header:after:opacity-40 hover:after:opacity-100",
    "focus-visible:after:opacity-100 data-resizing:after:opacity-100",
);

/** by the row (`[dataGridRows]` hands it to its template); `group/row`: a pinned cell shows its row's hover too */
export const row = (row: RowInfo) =>
    cn(
        "group/row border-b-(length:--dg-gridline) border-(--dg-gridline-color) hover:bg-(--dg-row-hover-bg)",
        row.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
    );

/**
 * by the cell `[dataGridCells]` hands to its template: the active cell's outline sits inside it, so
 * neighbours never cover it
 */
export const cell = <TRow>(cell: CellInfo<TRow>) =>
    cn(
        "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
        "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
        active,
        pinned,
        cell.rowIndex % 2 === 1 &&
            "data-pinned:[background-image:linear-gradient(var(--dg-row-alt-bg),var(--dg-row-alt-bg))]",
        "data-pinned:group-hover/row:[background-image:linear-gradient(var(--dg-row-hover-bg),var(--dg-row-hover-bg))]",
        pinnedEdge,
    );

/** numbers line up on the right, in the theme's numeric font */
export const numeric = <TRow>(info: CellInfo<TRow>) =>
    cn(
        cell(info),
        "justify-end font-(family-name:--dg-numeric-font) tabular-nums",
    );
