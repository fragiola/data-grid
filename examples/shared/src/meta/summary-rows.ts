import type { ExampleMeta } from "../meta-types";

export default {
    title: "Summary rows",
    description:
        "Five hundred people with an average row under the header and a total row at the bottom edge, computed by the app over the rows a search leaves.",
    category: "row-operations",
    order: 5,
    features: [
        "summaryRows",
        "DataGrid.Summary",
        "DataGrid.SummaryCells",
        "colSpan",
        "pinned",
        "useLocalRows",
    ],
    docs: "/docs/concepts/summary-rows",
} satisfies ExampleMeta;
