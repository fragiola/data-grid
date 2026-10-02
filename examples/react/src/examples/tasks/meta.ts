import type { ExampleMeta } from "../meta-types";

export default {
    title: "Tasks board",
    description:
        "Tasks with a sidebar of faceted filters, priority chips and star ratings: filtering is the app's, over the rows it gives the grid.",
    category: "real-world",
    order: 2,
    features: ["external filtering", "facets", "renderCell", "rows"],
    docs: "/docs/concepts/data-loading",
    height: 600,
} satisfies ExampleMeta;
