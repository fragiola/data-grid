import type { ExampleMeta } from "../meta-types";

export default {
    title: "Loading by window",
    description:
        "A million rows, scrollable end to end from the start: the grid reports the rows in view, and the app loads only those, wherever the scrollbar lands.",
    category: "data-loading",
    order: 2,
    features: [
        "rowCount",
        "getRow",
        "onRowWindowChange",
        "data-loading",
        "range cache",
    ],
    docs: "/docs/concepts/data-loading",
    height: 560,
} satisfies ExampleMeta;
