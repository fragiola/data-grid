import type { ExampleMeta } from "../meta-types";

export default {
    title: "Nested grid",
    description:
        "Orders whose items are a grid of their own, inside a cell: each grid keeps its own active cell, keys and focus, and Tab moves between them.",
    category: "real-world",
    order: 3,
    features: ["renderCell", "nested DataGrid.Root", "rowHeight", "focus"],
    docs: "/docs/guides/nested-grids",
    height: 600,
} satisfies ExampleMeta;
