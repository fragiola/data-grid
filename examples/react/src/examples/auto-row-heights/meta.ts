import type { ExampleMeta } from "../meta-types";

export default {
    title: "Auto row heights",
    description:
        "A hundred thousand people whose rows are as tall as their notes: measured as they render, the view staying where it is while the rows above it are.",
    category: "virtualization",
    order: 6,
    features: [
        'rowHeight="auto"',
        "estimatedRowHeight",
        "ResizeObserver",
        "useLocalRows",
        "pinned",
    ],
    docs: "/docs/concepts/measured-heights",
} satisfies ExampleMeta;
