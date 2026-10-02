import type { ExampleMeta } from "../meta-types";

export default {
    title: "Grouped headers",
    description:
        "Columns under group headers, wide enough to virtualize: groups stay over their columns as they scroll, and the arrows climb from a column to its group.",
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
