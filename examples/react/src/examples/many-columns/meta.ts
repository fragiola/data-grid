import type { ExampleMeta } from "../meta-types";

export default {
    title: "Thousands of columns",
    description:
        "Five thousand columns, virtualized like the rows: the grid reports the columns in view and the few rendered around them.",
    category: "virtualization",
    order: 2,
    features: ["column virtualization", "onColumnWindowChange", "overscan"],
    docs: "/docs/concepts/virtualization",
} satisfies ExampleMeta;
