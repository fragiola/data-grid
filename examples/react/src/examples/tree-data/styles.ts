import type {
    CellState,
    HeaderCellState,
    RowState,
} from "@fragiola/data-grid-react";
import { cn } from "#/lib/cn";

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

/** the mode switch and the keys */
export const modes =
    "palette-surface flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-palette-accent/85 font-(family-name:--dg-font)";

export const mode = "flex items-center gap-2 text-palette-contrast";

export const key =
    "rounded-sm border border-palette-line bg-palette-soft px-1.5 py-0.5 font-(family-name:--dg-numeric-font) text-[0.6875rem] text-palette-contrast";

export const toolbar =
    "palette-surface flex flex-wrap items-center gap-2 text-sm text-palette-contrast font-(family-name:--dg-font)";

export const searchIcon = "size-4 opacity-70";

export const search = "w-48";

export const count = "ms-auto text-xs text-palette-accent/85 tabular-nums";

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
const pinned = (state: { pinned: boolean }) =>
    state.pinned && "z-1 bg-palette-base";

export const headerCell = (state: HeaderCellState) =>
    cn(
        "flex items-center px-(--dg-cell-padding) outline-none",
        "data-sortable:cursor-pointer data-sortable:select-none data-sortable:hover:text-palette-contrast",
        "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
        active,
        pinned(state),
        state.pinned &&
            "[background-image:linear-gradient(var(--dg-header-bg),var(--dg-header-bg))]",
    );

/** a selected row (`data-selected`) tinted blue; a row still loading (`data-loading`) shimmers */
export const row = (state: RowState) =>
    cn(
        "border-b-(length:--dg-gridline) border-(--dg-gridline-color) hover:bg-(--dg-row-hover-bg)",
        state.rowIndex % 2 === 1 && "bg-(--dg-row-alt-bg)",
        "data-selected:palette-blue data-selected:bg-palette-soft",
        "data-loading:animate-pulse",
    );

export const cell = (state: CellState) =>
    cn(
        "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none tabular-nums",
        "data-interacting:[outline-style:solid]",
        active,
        pinned(state),
        !state.loaded &&
            "after:h-3 after:w-2/3 after:rounded-sm after:bg-palette-soft",
    );

/** a name indented by its depth (complete classes: Tailwind reads them) */
const INDENTS = ["", "ps-5", "ps-10", "ps-15", "ps-20"] as const;

export const name = (depth: number) =>
    cn("flex min-w-0 items-center gap-1.5", INDENTS[depth] ?? "ps-20");

export const toggle =
    "grid size-5 flex-none place-items-center rounded-sm text-palette-accent hover:bg-palette-soft hover:text-palette-contrast focus-visible:outline-1 focus-visible:outline-palette-ring";

/** the room a toggle takes, beside an entry that has none: names line up */
export const spacer = "size-5 flex-none";

/** the chevron turns down while its folder is open */
export const chevron = (expanded: boolean) =>
    cn(
        "size-4 transition-transform duration-(--dg-motion)",
        expanded && "rotate-90",
    );

export const icon = (kind: "folder" | "file") =>
    cn(
        "size-4 flex-none",
        kind === "folder" ? "palette-orange text-palette-ring" : "opacity-60",
    );

export const label = "truncate";
