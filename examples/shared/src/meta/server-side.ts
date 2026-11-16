import type { ExampleMeta } from "../meta-types";

export default {
    title: "Server-side",
    description:
        "The same controls in the external mode: the sort, a team filter, a search and the page go to a server, and the grid shows the page that comes back.",
    category: "row-operations",
    order: 3,
    features: ["sortColumns", "onSortColumnsChange", "rows", "server"],
    docs: "/docs/concepts/rows-in-memory",
} satisfies ExampleMeta;
