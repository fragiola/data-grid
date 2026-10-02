import type { ExampleMeta } from "../meta-types";

export default {
    title: "Grouped headers",
    description:
        "Columns under group headers, two levels deep and wide enough to virtualize: groups stay over their columns while they scroll, and the arrows climb from a column to its group.",
    category: "virtualization",
    order: 4,
    features: [
        "ColumnGroup",
        "DataGrid.HeaderRows",
        "data-group",
        "aria-colspan",
        "column virtualization",
    ],
    docs: "/docs/concepts/column-groups",
} satisfies ExampleMeta;
