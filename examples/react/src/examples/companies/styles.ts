import { cn } from "#/lib/cn";
import type { Category } from "../_kit/companies";

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

export const toolbar =
    "palette-surface flex flex-wrap items-center gap-2 text-sm text-palette-contrast font-(family-name:--dg-font)";

export const sortSelect = "w-64 flex-none gap-2";

export const sortLabel = "text-palette-accent/80";

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

/** opaque and above the rows: they scroll under it */
export const header = "z-10 bg-palette-base";

export const headerRow = cn(
    "bg-(--dg-header-bg) text-palette-accent",
    "border-b-(length:--dg-gridline) border-(--dg-gridline-color)",
);

export const headerCell = cn(
    "flex items-center gap-1.5 px-(--dg-cell-padding) outline-none",
    "font-(--dg-header-weight) [text-transform:var(--dg-header-transform)] tracking-(--dg-header-tracking)",
    "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]",
);

export const headerLabel = "flex items-center gap-1.5";

export const sortButton =
    "flex items-center gap-1.5 rounded-sm text-start hover:text-palette-contrast focus-visible:outline-2 focus-visible:outline-palette-ring";

export const icon = "size-3.5 shrink-0 opacity-80";

export const sortIcon = "size-3.5";

/** a selected row is tinted; the others take the theme's hover */
export const row = (selected: boolean) =>
    cn(
        "border-b-(length:--dg-gridline) border-(--dg-gridline-color)",
        selected
            ? "palette-blue bg-palette-soft"
            : "hover:bg-(--dg-row-hover-bg)",
    );

export const cell = cn(
    "flex items-center overflow-hidden whitespace-nowrap px-(--dg-cell-padding) outline-none",
    "border-r-(length:--dg-gridline) border-(--dg-gridline-color)",
    "data-active:outline-(length:--dg-active-width) data-active:outline-(--dg-active-line) data-active:[outline-style:var(--dg-active-style)] data-active:[outline-offset:calc(var(--dg-active-width)*-1)]",
);

export const company = "flex min-w-0 items-center gap-2";

export const logo = "size-6 rounded-sm";

const LOGO_TONES = [
    "palette-blue bg-palette-base text-palette-contrast",
    "palette-purple bg-palette-base text-palette-contrast",
    "palette-green bg-palette-base text-palette-contrast",
    "palette-orange bg-palette-base text-palette-contrast",
    "palette-rose bg-palette-base text-palette-contrast",
    "palette-danger bg-palette-base text-palette-contrast",
];

/** a logo's colour, picked by the company */
export const logoTone = (tone: number) =>
    cn("rounded-sm text-[0.625rem] font-bold", LOGO_TONES[tone]);

export const truncate = "min-w-0 truncate";

export const outlineChip =
    "truncate rounded-sm border border-palette-line px-1.5 py-0.5 text-xs";

export const chips = "flex min-w-0 gap-1 overflow-hidden";

const CATEGORY_TONES: Record<Category, string> = {
    Automation: "palette-orange",
    B2B: "palette-orange",
    B2C: "palette-orange",
    Consulting: "palette-blue",
    "E-commerce": "palette-rose",
    Enterprise: "palette-purple",
    Finance: "palette-orange",
    "Human Resources": "palette-green",
    "Information Technology": "palette-green",
    Insurance: "palette-surface",
    Marketplace: "palette-green",
    Publishing: "palette-rose",
    SaaS: "palette-green",
    "Venture Capital": "palette-danger",
};

/** a category's chip, coloured by its category */
export const categoryChip = (category: Category) =>
    cn(
        "shrink-0 rounded-sm bg-palette-soft px-1.5 py-0.5 text-xs text-palette-accent",
        CATEGORY_TONES[category],
    );

const RANGE_TONES = [
    "palette-surface",
    "palette-rose",
    "palette-orange",
    "palette-green",
    "palette-blue",
];

/** an employee range's badge, warmer as the company grows */
export const rangeBadge = (step: number) =>
    cn(
        "rounded-sm bg-palette-soft px-1.5 py-0.5 text-xs text-palette-accent tabular-nums",
        RANGE_TONES[step],
    );

const ARR_TONES = [
    "palette-rose",
    "palette-orange",
    "palette-green",
    "palette-blue",
];

export const arrBadge = (step: number) =>
    cn(
        "rounded-sm bg-palette-soft px-1.5 py-0.5 text-xs text-palette-accent tabular-nums",
        ARR_TONES[step],
    );

export const link =
    "truncate text-palette-contrast underline underline-offset-2 hover:text-palette-accent";
