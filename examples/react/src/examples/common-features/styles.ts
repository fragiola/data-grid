import type {
    CellState,
    HeaderCellState,
    RowState,
    SummaryCellState,
    SummaryRowState,
} from "@fragiola/data-grid-react";
import { cn } from "#/lib/cn";

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

export const toolbar =
    "palette-surface flex flex-wrap items-center justify-end gap-3 text-xs text-palette-accent/85 font-(family-name:--dg-font)";

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
    "group/header bg-(--dg-header-bg) text-palette-accent border-b-(length:--dg-gridline) border-(--dg-gridline-color)";

const active =
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]";

/** a pinned cell is opaque and above the cells that scroll under it (stacking is the app's) */
const pinned = (
    state: Pick<CellState, "pinned" | "pinnedEdge" | "pinnedSide">,
) => [
    state.pinned && "z-1 bg-palette-base",
    // the edge between the pinned columns and the ones scrolling under them
    state.pinnedEdge &&
        (state.pinnedSide === "end"
            ? "border-s-2 border-s-palette-line"
            : "border-e-2 border-e-palette-line"),
];

export const headerCell = (state: HeaderCellState) =>
    cn(
        "flex items-center gap-1.5 px-(--dg-cell-padding) outline-none",
        "data-sortable:cursor-pointer data-sortable:select-none",
        "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
        state.columnIndex === 0 && "justify-center",
        active,
        pinned(state),
        state.pinned &&
            "[background-image:linear-gradient(var(--dg-header-bg),var(--dg-header-bg))]",
    );

export const sortIcon = "size-3.5 shrink-0";

/** a resizer at the header cell's end edge, shown on hover, focus and drag */
export const resizer = cn(
    "absolute inset-y-0 end-0 w-2 cursor-col-resize touch-none select-none outline-none",
    "after:absolute after:inset-y-1.5 after:end-0 after:w-0.5 after:rounded-full after:bg-(--dg-active-line)",
    "after:opacity-0 group-hover/header:after:opacity-40 hover:after:opacity-100",
    "focus-visible:after:opacity-100 data-resizing:after:opacity-100",
);

/** a selected row is tinted (its `data-selected`) */
export const row = (state: RowState) =>
    cn(
        "border-b-(length:--dg-gridline) border-(--dg-gridline-color)",
        state.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
        "data-selected:bg-[color-mix(in_oklch,var(--dg-active-line)_12%,transparent)]",
    );

/** the edited cell holds its editor edge to edge */
export const cell = (state: CellState) =>
    cn(
        "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
        (state.columnIndex === 0 || state.pinnedSide === "end") &&
            "justify-center",
        state.columnIndex === 8 &&
            "justify-end font-(family-name:--dg-numeric-font) tabular-nums",
        "data-editing:px-0.5 data-editing:bg-palette-base",
        active,
        pinned(state),
        state.pinned &&
            state.rowIndex % 2 === 1 &&
            "[background-image:linear-gradient(var(--dg-row-alt-bg),var(--dg-row-alt-bg))]",
    );

/** an editor fills its cell */
export const editor = "h-full min-h-0 w-full rounded-sm px-2 text-sm";

export const select = "h-full w-full";

export const progress = "flex items-center gap-2 tabular-nums";

export const bar = "h-1.5 w-16 accent-(--dg-active-line)";

/** the summary rows stay over the rows that scroll under them: opaque and above, as the header */
export const summary = "bg-palette-base";

/**
 * a line between a summary row and the body: a border below the top one, a shadow above the
 * bottom one (a top border would push its cells down past the view's bottom edge)
 */
export const summaryRow = (state: SummaryRowState) =>
    cn(
        "bg-(--dg-header-bg) font-semibold tabular-nums",
        state.position === "top"
            ? "border-b-(length:--dg-gridline) border-(--dg-gridline-color)"
            : "shadow-[0_calc(var(--dg-gridline)*-1)_0_var(--dg-gridline-color)]",
    );

export const summaryCell = (state: SummaryCellState) =>
    cn(
        "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
        state.columnIndex === 8 && "justify-end",
        state.pinnedSide === "end" && "justify-center",
        active,
        pinned(state),
        state.pinned &&
            "[background-image:linear-gradient(var(--dg-header-bg),var(--dg-header-bg))]",
    );
