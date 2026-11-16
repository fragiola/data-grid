import type { ExampleMeta } from "../meta-types";

export default {
    title: "Scroll to a cell",
    description:
        "A row, a column or a cell scrolled into view from outside the grid, at the nearest edge, the start, the centre or the end, or made active: the engine's actions through a grid ref.",
    category: "virtualization",
    order: 7,
    features: [
        "gridRef",
        "scroll-to-cell",
        "align",
        "active-position.set",
        "pinned",
    ],
    docs: "/docs/concepts/model-and-engine",
} satisfies ExampleMeta;
