import type { ExampleMeta } from "../meta-types";

export default {
    title: "Keyboard navigation",
    description:
        "The active cell, moved by the arrows, Home and End, Ctrl+Home and Ctrl+End, and the page keys; controlled, and mirrored outside the grid.",
    category: "keyboard",
    order: 1,
    features: [
        "activePosition",
        "onActivePositionChange",
        "data-active",
        "roving tabindex",
    ],
    docs: "/docs/concepts/keyboard",
} satisfies ExampleMeta;
