import type { ExampleMeta } from "../meta-types";

export default {
    title: "All features",
    description:
        "A task sheet that edits in place, selects ranges, copies and pastes them, fills from a handle, sorts, pins its first column and resizes the others, every value written by the app.",
    category: "real-world",
    order: 4,
    features: [
        "renderEditCell",
        "onCellEdit",
        "cellSelection",
        "onRangePaste",
        "useFillHandle",
        "onFill",
        "useLocalRows",
        "useColumnResizer",
        "pinned",
    ],
    docs: "/docs/concepts/editing",
} satisfies ExampleMeta;
