import type { ExampleMeta } from "../meta-types";

export default {
    title: "Pinned columns",
    description:
        "A person stays pinned at the start and a summary at the end while three years of monthly scores scroll between them, a shadow on each pinned edge.",
    category: "virtualization",
    order: 5,
    features: [
        "pinned",
        "data-pinned",
        "data-pinned-edge",
        "ColumnGroup",
        "column virtualization",
    ],
    docs: "/docs/concepts/pinned-columns",
} satisfies ExampleMeta;
