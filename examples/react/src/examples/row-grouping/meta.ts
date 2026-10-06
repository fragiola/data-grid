import type { ExampleMeta } from "../meta-types";

export default {
    title: "Row grouping",
    description:
        "Five hundred people grouped by team, or by team then city, each group with its count and payroll; sorted, searched and selected inside the groups, archived people left out.",
    category: "row-operations",
    order: 7,
    features: [
        "useLocalRows",
        "groupBy",
        "aggregates",
        "useGroupToggle",
        "renderGroupCell",
        "treegrid",
        "rowSelection",
    ],
    docs: "/docs/concepts/row-grouping",
} satisfies ExampleMeta;
