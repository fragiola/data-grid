import type { ExampleMeta } from "../meta-types";

export default {
    title: "Column reordering",
    description:
        "Header cells dragged or moved with the keys reorder columns and whole groups among their siblings, pinned ones among the pinned, the order kept by the app.",
    category: "columns",
    order: 2,
    features: [
        "reorderable",
        "columnOrder",
        "data-drop-target",
        "data-dragging",
        "Ctrl/⌘+Shift+←/→",
        "live region",
    ],
    docs: "/docs/concepts/column-reordering",
} satisfies ExampleMeta;
