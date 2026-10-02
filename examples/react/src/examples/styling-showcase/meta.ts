import type { ExampleMeta } from "../meta-types";

export default {
    title: "Styling showcase",
    description:
        "One grid, any look: colours per column, per row and per cell, a heatmap, and three presets that restyle the same markup.",
    category: "styling",
    order: 0,
    features: [
        "className(state)",
        "data-active",
        "per-column styles",
        "heatmap",
        "presets",
    ],
    docs: "/docs/guides/styling-tailwind",
    height: 560,
} satisfies ExampleMeta;
