import type { ExampleMeta } from "../meta-types";

export default {
    title: "Row selection",
    description:
        "Checkboxes, Shift+click ranges, Shift+Space, Shift+Down and Ctrl+A select rows the grid keeps by key, one or many, with rows that cannot be selected.",
    category: "row-operations",
    order: 4,
    features: [
        "rowSelection",
        "selectedRowKeys",
        "isRowSelectable",
        "useSelectAll",
        "data-selected",
        "aria-selected",
    ],
    docs: "/docs/concepts/row-selection",
} satisfies ExampleMeta;
