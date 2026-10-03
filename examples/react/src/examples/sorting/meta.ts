import type { ExampleMeta } from "../meta-types";

export default {
    title: "Sorting",
    description:
        "Sortable columns toggled from the header by mouse or keyboard, Ctrl or ⌘ adding a column: one hook keeps the sort and orders the rows in memory.",
    category: "row-operations",
    order: 1,
    features: [
        "useLocalRows",
        "compare",
        "sortable",
        "sortColumns",
        "onSortColumnsChange",
        "aria-sort",
        "data-sort",
        "data-sort-priority",
    ],
    docs: "/docs/concepts/sorting",
} satisfies ExampleMeta;
