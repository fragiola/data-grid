import type { ExampleMeta } from "../meta-types";

export default {
    title: "Right to left",
    description:
        "An Arabic table read from the right: the name pinned at the start on the right edge, the salary at the end on the left, the columns between resized and reordered mirrored.",
    category: "columns",
    order: 4,
    features: [
        "direction",
        "pinned: end",
        "data-pinned",
        "column resizing",
        "column reordering",
    ],
    docs: "/docs/concepts/right-to-left",
} satisfies ExampleMeta;
