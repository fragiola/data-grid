import type { ExampleMeta } from "../meta-types";

export default {
    title: "Common features",
    description:
        "One realistic sheet: rows selected by checkbox, columns pinned at both ends, sorted, resized and edited, totals above and below, and an export to CSV from the app's own rows.",
    category: "real-world",
    order: 5,
    features: [
        "rowSelection",
        "isRowSelectable",
        "pinned",
        "sortable",
        "useColumnResizer",
        "renderEditCell",
        "summaryRows",
        "CSV export",
    ],
    docs: "/docs/concepts/row-selection",
} satisfies ExampleMeta;
