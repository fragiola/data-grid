import type { ExampleMeta } from "../meta-types";

export default {
    title: "Loading and errors",
    description:
        "Skeleton rows while the first load runs, an error in the grid's empty state with a retry, and a refetch that keeps the rows on screen.",
    category: "data-loading",
    order: 4,
    features: [
        "rowCount",
        "getRow",
        "data-loading",
        "DataGrid.Empty",
        "aria-busy",
        "retry",
    ],
    docs: "/docs/guides/loading-and-errors",
} satisfies ExampleMeta;
