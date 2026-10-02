import type { ExampleMeta } from "../meta-types";

export default {
    title: "Infinite loading",
    description:
        "Rows arrive a page at a time: when the view nears the end the grid says so, the app loads the next page, and the scroll position stays.",
    category: "data-loading",
    order: 1,
    features: ["onRowsEndReached", "endReachedThreshold", "rows"],
    docs: "/docs/concepts/data-loading",
} satisfies ExampleMeta;
