import type { ExampleMeta } from "../meta-types";

export default {
    title: "Row reordering",
    description:
        "A backlog put in order by dragging a row's handle or with Ctrl or ⌘, Shift and the arrows: the grid tells each move, and the app moves its own rows.",
    category: "row-operations",
    order: 6,
    features: [
        "onRowMove",
        "useRowDragHandle",
        "data-dragging",
        "data-drop-target",
        "useLocalRows",
        "moveRow",
    ],
    docs: "/docs/concepts/row-reordering",
} satisfies ExampleMeta;
