import { cn } from "#/lib/cn";
import type { Task } from "../_kit/tasks";

export const frame = "flex h-full min-h-0 gap-3 p-3";

export const sidebar = cn(
    "palette-raised flex w-52 shrink-0 flex-col gap-4 overflow-y-auto rounded-(--dg-radius) border-(length:--dg-border) border-palette-line bg-palette-base p-3",
    "font-(family-name:--dg-font) text-sm text-palette-contrast",
);

export const sidebarHeader = "flex items-center justify-between gap-2";

export const shown = "text-xs text-palette-accent/85 tabular-nums";

export const facet = "flex flex-col gap-1.5";

export const facetTitle =
    "mb-1 text-xs font-semibold uppercase tracking-wide text-palette-accent";

export const option = "flex cursor-pointer items-center gap-2";

export const optionLabel = "flex-1";

export const optionCount = "text-xs text-palette-accent/70 tabular-nums";

/** the scroll container: the theme's frame, font and size */
export const root = cn(
    "palette-raised min-h-0 min-w-0 flex-1 bg-palette-base text-palette-contrast",
    "rounded-(--dg-radius) border-(length:--dg-border) border-palette-line shadow-(--dg-shadow)",
    "font-(family-name:--dg-font) text-(length:--dg-font-size)",
);

/** the grid is the tab stop until a cell is active */
export const grid =
    "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--dg-active-line)";

/** opaque and above the rows: they scroll under it */
export const header = "z-10 bg-palette-base";

export const headerRow = cn(
    "bg-(--dg-header-bg) text-palette-accent",
    "border-b-(length:--dg-gridline) border-(--dg-gridline-color)",
);

export const headerCell = cn(
    "flex items-center px-(--dg-cell-padding) outline-none",
    "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
    "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]",
);

export const row =
    "border-b-(length:--dg-gridline) border-(--dg-gridline-color) hover:bg-(--dg-row-hover-bg)";

export const cell = cn(
    "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
    "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]",
);

const PRIORITY_TONES: Record<Task["priority"], string> = {
    High: "palette-orange",
    Medium: "palette-orange",
    Low: "palette-purple",
};

/** a priority chip; High is filled, Medium soft, Low another hue */
export const priority = (value: Task["priority"]) =>
    cn(
        "rounded-full px-2.5 py-0.5 text-xs",
        PRIORITY_TONES[value],
        value === "High"
            ? "bg-palette-soft text-palette-accent font-semibold"
            : "bg-palette-soft/70 text-palette-accent",
    );

export const stars = "flex gap-0.5";

/** a filled star in the theme's highlight, an empty one in the lines' colour */
export const star = (filled: boolean) =>
    filled
        ? "palette-orange size-4 fill-palette-base text-palette-base"
        : "size-4 fill-palette-line text-palette-line";
