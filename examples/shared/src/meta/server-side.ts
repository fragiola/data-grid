import type { ExampleMeta } from "../meta-types";

export default {
    title: "Server-side",
    description:
        "The same features without rows in memory: the grid's sort, team filter, search and page go to a server, and the grid shows the page that comes back.",
    category: "row-operations",
    order: 3,
    features: [
        "sorting()",
        "filtering()",
        "search()",
        "pagination()",
        "columnFilters",
        "totalRowCount",
        "server",
    ],
    docs: "/docs/concepts/rows-in-memory",
} satisfies ExampleMeta;
