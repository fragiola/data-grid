import type { ExampleMeta } from "../meta-types";

export default {
    title: "Hello grid",
    description:
        "The smallest themed grid: a hundred rows, six columns and the keyboard, assembled from the primitives and styled from outside.",
    category: "getting-started",
    order: 1,
    features: ["DataGrid.Root", "columns", "rows", "renderCell", "data-active"],
    docs: "/docs/getting-started/first-grid",
} satisfies ExampleMeta;
