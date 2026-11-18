import type { ExampleMeta } from "../meta-types";

export default {
    title: "Live market",
    description:
        "A trading desk that never sits still: a thousand fictional instruments ticking up to ten thousand times a second, with timelines, flashing prices, badges, a pinned ticker, live sorting and portfolio totals. Only the rows on screen render.",
    category: "real-world",
    order: 1,
    features: [
        "rowCount + getRow",
        "rows.changed",
        "summary-rows.changed",
        "renderCell",
        "renderSummaryCell",
        "external sort",
        "pinned",
        "useColumnResizer",
    ],
    docs: "/docs/concepts/data-loading",
    height: 640,
} satisfies ExampleMeta;
