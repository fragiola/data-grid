import type { ExampleMeta } from "../meta-types";

export default {
    title: "Automatic widths",
    description:
        "Flex columns share the width the grid has left and follow it, a column fits its content at the start, and a double click or the app's button fits columns to what they show.",
    category: "columns",
    order: 3,
    features: [
        "flex",
        "autoSize",
        "fit-columns",
        "column-auto-widths",
        "columnWidths",
        "useColumnResizer",
    ],
    docs: "/docs/concepts/auto-widths",
} satisfies ExampleMeta;
