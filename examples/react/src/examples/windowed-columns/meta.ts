import type { ExampleMeta } from "../meta-types";

export default {
    title: "Loading by tiles",
    description:
        "The window in two dimensions: the rows and the columns in view decide which tiles of a 100,000 × 2,000 dataset the app fetches.",
    category: "data-loading",
    order: 3,
    features: [
        "onRowWindowChange",
        "onColumnWindowChange",
        "rows.changed",
        "getValue",
        "tiles",
    ],
    docs: "/docs/concepts/data-loading",
    height: 560,
} satisfies ExampleMeta;
