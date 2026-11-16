import type { ExampleMeta } from "../meta-types";

export default {
    title: "Animated row heights",
    description:
        "Three row heights to choose from, and the rows ease into the new one: the grid lays them out again, a CSS transition on each row's top and height animates it.",
    category: "virtualization",
    order: 8,
    features: ["rowHeight", "transition", "prefers-reduced-motion"],
    docs: "/docs/getting-started/sizing",
} satisfies ExampleMeta;
