import type { ExampleMeta } from "../meta-types";

export default {
    title: "Context menu",
    description:
        "A right click, a long press or the menu key on a row opens the app's own menu to insert a row above or below it or delete it; focus comes back to the grid's active cell.",
    category: "row-operations",
    order: 11,
    features: [
        "onContextMenu",
        "active-position.set",
        "rows",
        "ContextMenu",
        "focus return",
    ],
    docs: "/docs/concepts/keyboard",
} satisfies ExampleMeta;
