import type { ExampleMeta } from "../meta-types";

export default {
    title: "Header filters",
    description:
        "A filter under each column's name, in its header cell: text fields and selects the grid treats as the cell's controls, the rows filtered and sorted in memory by one hook.",
    category: "row-operations",
    order: 10,
    features: [
        "renderHeaderCell",
        "headerCellContent",
        "interactive cells",
        "headerRowHeight",
        "useLocalRows",
        "filter",
    ],
    docs: "/docs/concepts/rows-in-memory",
} satisfies ExampleMeta;
