import type { ExampleMeta } from "../meta-types";

export default {
    title: "Rows in memory",
    description:
        "A thousand people in memory, searched, filtered by column, sorted and paged by one hook: its props go to the grid, its controls to the toolbar and the pager.",
    category: "row-operations",
    order: 2,
    features: [
        "useLocalRows",
        "filter",
        "search",
        "pageSize",
        "sortColumns",
        "DataGrid.Empty",
    ],
    docs: "/docs/concepts/rows-in-memory",
} satisfies ExampleMeta;
