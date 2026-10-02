import type { ExampleMeta } from "../meta-types";

export default {
    title: "Pinned columns",
    description:
        "A pinned group of two columns stays at the start while three years of monthly scores scroll under it, with a divider on the pinned edge.",
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
