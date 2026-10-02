import type { ExampleMeta } from "../meta-types";

export default {
    title: "Variable row height",
    description:
        "A hundred thousand rows of four heights, given by a function of the row index: positions stay exact at any scroll position.",
    category: "virtualization",
    order: 3,
    features: ["rowHeight(index)", "prefix sums", "rowKey"],
    docs: "/docs/concepts/virtualization",
} satisfies ExampleMeta;
