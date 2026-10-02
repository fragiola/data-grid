import type { ExampleMeta } from "../meta-types";

export default {
    title: "Companies CRM",
    description:
        "A CRM table: logos, chips, badges and links in the cells, with selection, sorting and deleting written in the app over its rows.",
    category: "real-world",
    order: 1,
    features: [
        "renderCell",
        "renderHeaderCell",
        "aria-sort",
        "selection",
        "external sort",
    ],
    docs: "/docs/concepts/data-loading",
    height: 600,
} satisfies ExampleMeta;
