import type { ExampleMeta } from "../meta-types";

export default {
    title: "Custom renderers",
    description:
        "Everything is the app's to render: native checkboxes that select rows, its own sort arrows and priorities, cells and rows styled from their data, and a title edited in place.",
    category: "styling",
    order: 2,
    features: [
        "render",
        "renderCell",
        "className(state)",
        "useSelectAll",
        "sortPriority",
        "renderEditCell",
    ],
    docs: "/docs/concepts/primitive-contract",
} satisfies ExampleMeta;
