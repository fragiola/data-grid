import type { ExampleMeta } from "../meta-types";

export default {
    title: "Companies CRM",
    description:
        "A CRM table: logos, chips, badges and links in the cells, rows the grid selects and the app deletes, and sorting in memory.",
    category: "real-world",
    order: 1,
    features: [
        "renderCell",
        "renderHeaderCell",
        "aria-sort",
        "rowSelection",
        "useSelectAll",
        "external sort",
    ],
    docs: "/docs/concepts/data-loading",
    height: 600,
} satisfies ExampleMeta;
