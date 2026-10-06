import type { ExampleMeta } from "../meta-types";

export default {
    title: "Tree data",
    description:
        "A project's files as a tree: folders that open with their toggle, Space or the arrows, searched and sorted in memory, or listed by a server as they open.",
    category: "row-operations",
    order: 8,
    features: [
        "useLocalRows",
        "getSubRows",
        "getRowMeta",
        "useGroupToggle",
        "treegrid",
        "rowSelection",
        "lazy loading",
    ],
    docs: "/docs/concepts/tree-data",
} satisfies ExampleMeta;
