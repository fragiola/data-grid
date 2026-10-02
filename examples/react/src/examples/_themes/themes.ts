// The example themes, in switcher order. Each has a CSS file next to this one.
// Generated once from the palettes below and then edited by hand; the CSS is the source.

export const THEMES = [
    {
        name: "light",
        title: "Light",
        description: "Neutral and quiet: the reference look.",
        scheme: "light",
        swatch: [
            "oklch(0.96 0.003 250)",
            "oklch(1 0 0)",
            "oklch(0.55 0.2 250)",
            "oklch(0.68 0.17 55)",
        ],
    },
    {
        name: "dark",
        title: "Dark",
        description: "The same shapes as Light, on dark palettes.",
        scheme: "dark",
        swatch: [
            "oklch(0.13 0.01 250)",
            "oklch(0.19 0.01 250)",
            "oklch(0.7 0.18 250)",
            "oklch(0.75 0.16 55)",
        ],
    },
    {
        name: "ide",
        title: "IDE",
        description:
            "A dense data table for a code editor: small type, monospaced numbers, zebra rows, square corners.",
        scheme: "dark",
        swatch: [
            "oklch(0.2 0.006 260)",
            "oklch(0.235 0.006 260)",
            "oklch(0.55 0.16 245)",
            "oklch(0.72 0.15 60)",
        ],
    },
    {
        name: "paper",
        title: "Paper",
        description:
            "Warm and spacious: a serif report with roomy cells, no vertical lines, uppercase headers.",
        scheme: "light",
        swatch: [
            "oklch(0.955 0.014 85)",
            "oklch(0.99 0.006 85)",
            "oklch(0.46 0.09 220)",
            "oklch(0.62 0.14 45)",
        ],
    },
    {
        name: "terminal",
        title: "Terminal",
        description:
            "Phosphor green on black: monospace, uppercase headers, a dashed cursor.",
        scheme: "dark",
        swatch: [
            "oklch(0.13 0.012 150)",
            "oklch(0.16 0.016 150)",
            "oklch(0.85 0.2 145)",
            "oklch(0.8 0.16 75)",
        ],
    },
] as const;

export type ThemeName = (typeof THEMES)[number]["name"];

export const DEFAULT_THEME: ThemeName = "light";

export function isThemeName(value: unknown): value is ThemeName {
    return THEMES.some((theme) => theme.name === value);
}
