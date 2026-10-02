import type { ExampleMeta } from "../meta-types";

export default {
    title: "Sorting",
    description:
        "Sortable columns toggled from the header by mouse or keyboard, Ctrl or ⌘ adding a column: the grid keeps the sort, the app orders its rows by it.",
    category: "row-operations",
    order: 1,
    features: [
        "sortable",
        "sortColumns",
        "onSortColumnsChange",
        "aria-sort",
        "data-sort",
        "data-sort-priority",
    ],
    docs: "/docs/concepts/sorting",
} satisfies ExampleMeta;
