import type { ExampleMeta } from "../meta-types";

export default {
    title: "Master-detail",
    description:
        "Orders that expand into a detail below their cells: a summary and a grid of the order's items, each grid with its own keys, as wide as the view while the orders scroll sideways, and as tall as computed or measured.",
    category: "real-world",
    order: 3,
    features: [
        "DataGrid.RowDetail",
        "expanded-rows.toggle",
        "detailHeight",
        'detailHeight="auto"',
        "nested DataGrid.Root",
        "pinned",
    ],
    docs: "/docs/guides/master-detail",
    height: 600,
} satisfies ExampleMeta;
