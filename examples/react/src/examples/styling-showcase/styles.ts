import type {
    CellState,
    HeaderCellState,
    RowState,
} from "@fragiola/data-grid-react";
import { cn } from "#/lib/cn";
import type { Status, Tag } from "../_kit/portfolio";

// Three looks for the same markup. A preset is only class strings, per part, per column and per
// value: switching one swaps classes, never elements. Colours come from the Fragiola palettes
// (each theme tunes them) and, for Neon, from fixed glowing colours. Every class is a complete
// literal: Tailwind finds classes by reading this file.

export const frame = "flex h-full min-h-0 flex-col gap-2 p-3";

export const toolbar =
    "palette-surface flex flex-wrap items-center gap-2 text-xs text-palette-accent/85 font-(family-name:--dg-font)";

export const presetButton =
    "aria-pressed:bg-palette-soft aria-pressed:text-palette-contrast";

export const legend = "me-1";

/** The columns a preset colours on their own. */
export type ColumnKey =
    | "id"
    | "name"
    | "owner"
    | "status"
    | "score"
    | "delta"
    | "shipped"
    | "tag";

export interface Preset {
    title: string;
    /** a preset may space its rows differently: the grid takes it as `rowHeight` */
    rowHeight: number;
    root: string;
    header: string;
    headerRow: string;
    headerCell: (state: HeaderCellState, column: ColumnKey) => string;
    row: (state: RowState, status: Status | undefined) => string;
    cell: (state: CellState, column: ColumnKey) => string;
    /** a heatmap cell, by its score (0–100) */
    heat: (score: number) => string;
    /** a signed change: better, worse or flat */
    delta: (delta: number) => string;
    shipped: (shipped: boolean) => string;
    status: (status: Status) => string;
    tag: (tag: Tag) => string;
}

/** 0–19 → 0, …, 80–100 → 4: the heatmap's five steps. */
export function heatStep(score: number): 0 | 1 | 2 | 3 | 4 {
    const step = Math.min(4, Math.max(0, Math.floor(score / 20)));
    return step as 0 | 1 | 2 | 3 | 4;
}

const ACTIVE_OUTLINE =
    "outline-none data-active:outline-2 data-active:-outline-offset-2";

// ── Spreadsheet: gridlines, compact, monospaced numbers ──────────────────────

const spreadsheetColumn: Record<ColumnKey, string> = {
    id: "palette-purple bg-palette-soft text-palette-accent",
    name: "",
    owner: "",
    status: "",
    score: "",
    delta: "font-mono tabular-nums justify-end",
    shipped: "justify-center",
    tag: "",
};

const spreadsheetHeat = [
    "palette-green bg-palette-base/5",
    "palette-green bg-palette-base/20",
    "palette-green bg-palette-base/40",
    "palette-green bg-palette-base/65 text-palette-contrast",
    "palette-green bg-palette-base text-palette-contrast",
];

const spreadsheet: Preset = {
    title: "Spreadsheet",
    rowHeight: 30,
    root: "palette-raised min-h-0 flex-1 border border-palette-line bg-palette-base text-palette-contrast font-mono text-xs",
    header: "z-10 bg-palette-base",
    headerRow: "palette-surface bg-palette-soft border-b-2 border-palette-line",
    headerCell: (_state, column) =>
        cn(
            "flex items-center border-e border-palette-line px-2 font-semibold uppercase tracking-wide outline-none",
            column === "id" && "palette-purple bg-palette-soft",
        ),
    row: (state, status) =>
        cn(
            "border-b border-palette-line hover:bg-palette-soft",
            status === "blocked" && "palette-danger bg-palette-soft",
            status !== "blocked" &&
                state.rowIndex % 2 === 1 &&
                "bg-palette-soft/40",
        ),
    cell: (_state, column) =>
        cn(
            "flex items-center overflow-hidden whitespace-nowrap border-e border-palette-line px-2",
            // a spreadsheet cursor: blue, with a tint
            "data-active:outline-[oklch(0.58_0.2_255)] data-active:bg-[oklch(0.58_0.2_255/0.1)]",
            ACTIVE_OUTLINE,
            spreadsheetColumn[column],
        ),
    heat: (score) =>
        cn(
            "font-mono tabular-nums justify-end",
            spreadsheetHeat[heatStep(score)],
        ),
    delta: (delta) =>
        delta > 0
            ? "palette-green text-palette-accent"
            : delta < 0
              ? "palette-danger text-palette-accent"
              : "text-palette-accent/60",
    shipped: (shipped) =>
        shipped
            ? "palette-green text-palette-accent"
            : "text-palette-accent/50",
    status: (status) =>
        ({
            "on-track": "palette-green text-palette-accent",
            "at-risk": "palette-orange text-palette-accent",
            blocked: "palette-danger font-bold text-palette-accent",
        })[status],
    tag: () => "rounded-sm border border-palette-line px-1",
};

// ── Cards: each row a rounded card, airy, no gridlines ───────────────────────

const cardsHeat = [
    "palette-blue bg-palette-base/10",
    "palette-blue bg-palette-base/25",
    "palette-blue bg-palette-base/45",
    "palette-blue bg-palette-base/70 text-palette-contrast",
    "palette-blue bg-palette-base text-palette-contrast",
];

const cards: Preset = {
    title: "Cards",
    rowHeight: 56,
    root: "palette-surface min-h-0 flex-1 rounded-[18px] bg-palette-base text-palette-contrast font-(family-name:--dg-font) text-sm",
    header: "z-10 bg-palette-base",
    headerRow: "text-palette-accent/80",
    headerCell: () =>
        "flex items-center px-4 text-xs font-medium tracking-wide outline-none data-active:underline",
    // the card is a pseudo-element inset in the row: the cells paint above it, the gap shows
    row: (state, status) =>
        cn(
            "palette-raised before:absolute before:inset-x-2 before:inset-y-1 before:rounded-[14px] before:bg-palette-base before:shadow-sm before:transition-shadow hover:before:shadow-md",
            // the status is the card's border only: a palette class here would repaint the card
            status === "blocked" &&
                "before:ring-2 before:ring-[oklch(0.62_0.21_20)]",
            status === "at-risk" &&
                "before:ring-2 before:ring-[oklch(0.78_0.15_70)]",
            state.active && "before:shadow-lg",
        ),
    cell: (_state, column) =>
        cn(
            "flex items-center overflow-hidden whitespace-nowrap px-4",
            "data-active:outline-palette-ring data-active:rounded-[10px]",
            ACTIVE_OUTLINE,
            column === "name" && "font-semibold",
            column === "id" && "text-palette-accent/70",
            column === "delta" && "justify-end tabular-nums",
            column === "shipped" && "justify-center",
        ),
    // an inset bar: the background is clipped to the content box, inside the card
    heat: (score) =>
        cn(
            "justify-center tabular-nums py-3 [background-clip:content-box]",
            cardsHeat[heatStep(score)],
        ),
    delta: (delta) =>
        delta > 0
            ? "palette-green text-palette-accent before:content-['▲_']"
            : delta < 0
              ? "palette-danger text-palette-accent before:content-['▼_']"
              : "text-palette-accent/60",
    shipped: (shipped) =>
        shipped
            ? "palette-green rounded-full bg-palette-soft px-2 text-palette-accent"
            : "text-palette-accent/40",
    status: (status) =>
        cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium bg-palette-soft text-palette-accent",
            {
                "on-track": "palette-green",
                "at-risk": "palette-orange",
                blocked: "palette-rose",
            }[status],
        ),
    tag: (tag) =>
        cn(
            "rounded-full px-2.5 py-0.5 text-xs bg-palette-soft text-palette-accent",
            {
                design: "palette-purple",
                platform: "palette-blue",
                growth: "palette-green",
                data: "palette-orange",
                mobile: "palette-rose",
            }[tag],
        ),
};

// ── Neon: dark, glowing, saturated (fixed colours: it is a look, not a theme) ─

const neonHeat = [
    "bg-[oklch(0.25_0.05_300)] text-[oklch(0.75_0.1_300)]",
    "bg-[oklch(0.32_0.1_310)] text-[oklch(0.85_0.12_310)]",
    "bg-[oklch(0.42_0.17_330)] text-[oklch(0.95_0.05_330)]",
    "bg-[oklch(0.55_0.24_350)] text-[oklch(1_0_0)] shadow-[0_0_10px_oklch(0.65_0.26_350/0.7)]",
    "bg-[oklch(0.68_0.26_10)] text-[oklch(1_0_0)] shadow-[0_0_14px_oklch(0.7_0.27_10/0.9)]",
];

const neon: Preset = {
    title: "Neon",
    rowHeight: 40,
    root: "min-h-0 flex-1 rounded-[10px] border border-[oklch(0.7_0.2_200)] bg-[oklch(0.14_0.03_280)] text-[oklch(0.92_0.03_200)] shadow-[0_0_24px_oklch(0.7_0.2_200/0.35)] font-mono text-xs",
    header: "z-10 bg-[oklch(0.14_0.03_280)]",
    headerRow:
        "border-b border-[oklch(0.75_0.25_330)] bg-[oklch(0.18_0.06_300)] shadow-[0_2px_12px_oklch(0.75_0.25_330/0.5)]",
    headerCell: (_state, column) =>
        cn(
            "flex items-center px-3 font-bold uppercase tracking-[0.15em] outline-none",
            column === "score"
                ? "text-[oklch(0.85_0.2_350)]"
                : "text-[oklch(0.85_0.17_200)]",
            "data-active:text-[oklch(1_0_0)] data-active:[text-shadow:0_0_8px_oklch(0.85_0.17_200)]",
        ),
    row: (state, status) =>
        cn(
            "border-b border-[oklch(0.3_0.08_280)] hover:bg-[oklch(0.2_0.06_280)]",
            status === "blocked" &&
                "bg-[oklch(0.22_0.09_15)] shadow-[inset_3px_0_0_oklch(0.7_0.25_15)]",
            state.active && "bg-[oklch(0.22_0.07_200)]",
        ),
    cell: (_state, column) =>
        cn(
            "flex items-center overflow-hidden whitespace-nowrap px-3",
            "data-active:outline-[oklch(0.85_0.2_140)] data-active:shadow-[0_0_14px_oklch(0.85_0.2_140/0.8)]",
            ACTIVE_OUTLINE,
            column === "id" && "text-[oklch(0.8_0.18_140)]",
            column === "delta" && "justify-end",
            column === "shipped" && "justify-center",
        ),
    heat: (score) =>
        cn("justify-end tabular-nums font-bold", neonHeat[heatStep(score)]),
    delta: (delta) =>
        delta > 0
            ? "text-[oklch(0.85_0.22_145)] [text-shadow:0_0_6px_oklch(0.85_0.22_145)]"
            : delta < 0
              ? "text-[oklch(0.72_0.25_20)] [text-shadow:0_0_6px_oklch(0.72_0.25_20)]"
              : "text-[oklch(0.6_0.03_280)]",
    shipped: (shipped) =>
        shipped ? "text-[oklch(0.85_0.22_145)]" : "text-[oklch(0.45_0.05_280)]",
    status: (status) =>
        cn(
            "rounded-sm px-2 py-0.5 text-[0.65rem] font-bold uppercase border",
            {
                "on-track":
                    "border-[oklch(0.85_0.22_145)] text-[oklch(0.85_0.22_145)]",
                "at-risk":
                    "border-[oklch(0.85_0.17_85)] text-[oklch(0.85_0.17_85)]",
                blocked:
                    "border-[oklch(0.72_0.25_20)] text-[oklch(0.72_0.25_20)] shadow-[0_0_8px_oklch(0.72_0.25_20/0.8)]",
            }[status],
        ),
    tag: (tag) =>
        cn(
            "rounded-sm px-2 py-0.5 text-[0.65rem] uppercase",
            {
                design: "bg-[oklch(0.35_0.15_310)] text-[oklch(0.9_0.1_310)]",
                platform: "bg-[oklch(0.35_0.12_240)] text-[oklch(0.9_0.1_240)]",
                growth: "bg-[oklch(0.35_0.12_150)] text-[oklch(0.9_0.12_150)]",
                data: "bg-[oklch(0.38_0.12_70)] text-[oklch(0.92_0.1_80)]",
                mobile: "bg-[oklch(0.35_0.15_15)] text-[oklch(0.9_0.1_15)]",
            }[tag],
        ),
};

export const PRESETS = { spreadsheet, cards, neon } as const;

export type PresetName = keyof typeof PRESETS;

/** The presets, in the switcher's order. */
export const PRESET_NAMES: readonly PresetName[] = [
    "spreadsheet",
    "cards",
    "neon",
];

const COLUMN_KEYS: readonly ColumnKey[] = [
    "id",
    "name",
    "owner",
    "status",
    "score",
    "delta",
    "shipped",
    "tag",
];

/** A column's key as one the presets know (an unknown key styles as a plain column). */
export function columnKey(key: string): ColumnKey {
    return COLUMN_KEYS.find((known) => known === key) ?? "name";
}

/** A body cell's classes: the preset's cell look, plus the heatmap step for the score column. */
export function cellClass(
    preset: Preset,
    column: ColumnKey,
    score: number | undefined,
) {
    return (state: CellState) =>
        cn(
            preset.cell(state, column),
            column === "score" && score !== undefined && preset.heat(score),
        );
}
