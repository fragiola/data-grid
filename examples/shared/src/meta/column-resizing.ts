import type { ExampleMeta } from "../meta-types";

export default {
    title: "Column resizing",
    description:
        "Handles dragged or moved with the arrows resize columns within their limits, a group's columns together, pinned ones too, with the widths kept by the app.",
    category: "columns",
    order: 1,
    features: [
        "resizable",
        "minWidth / maxWidth",
        "columnWidths",
        "useColumnResizer",
        "headerCellContent",
        "data-resizing",
        "role=separator",
    ],
    docs: "/docs/concepts/column-resizing",
} satisfies ExampleMeta;
