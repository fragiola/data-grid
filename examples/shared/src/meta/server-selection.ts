import type { ExampleMeta } from "../meta-types";

export default {
    title: "Selecting on a server",
    description:
        "Every row of a server's ten thousand selected from a page of fifty: a middleware turns the grid's select-all into the app's all-but state, which an export sends as it is.",
    category: "row-operations",
    order: 9,
    features: [
        "rowSelection",
        "selectedRowKeys",
        "selected-rows.select-all",
        "middleware",
        "useDataGrid(gridRef)",
        "server",
    ],
    docs: "/docs/concepts/row-selection",
} satisfies ExampleMeta;
